import { LocationKind, MAX_LOCATIONS_POR_PROFISSIONAL, type LocationRow } from '@gestao/types';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { ehViolacaoDeUnicidade } from '../../../common/database/violacao-de-unicidade';
import { CreateLocationDto, UpdateLocationDto } from '../dto/location.dto';
import { Location } from '../entities/location.entity';

/**
 * Onde o profissional atende.
 *
 * Duas invariantes moram aqui, e as duas têm o banco como juiz final: **exatamente um local
 * principal** quando existe pelo menos um (índice único parcial), e **`STUDENT_HOME` sem
 * endereço** (`CHECK`). O serviço as respeita para que o usuário receba uma mensagem em vez de
 * um erro de banco — não para substituí-las. A defesa é o modelo não ter onde guardar.
 */
@Injectable()
export class LocationsService {
  constructor(@InjectRepository(Location) private readonly locations: Repository<Location>) {}

  /** Principal primeiro, depois por ordem de cadastro. É a ordem do seletor da agenda. */
  async listar(professionalId: string): Promise<LocationRow[]> {
    const linhas = await this.locations.find({
      where: { professionalId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
    return linhas.map((local) => this.emLinha(local));
  }

  async criar(professionalId: string, dto: CreateLocationDto): Promise<LocationRow> {
    const streetAddress = this.enderecoPermitido(dto.kind, dto.streetAddress ?? null);

    const local = await this.locations.manager
      .transaction(async (manager) => {
        const existentes = await manager.countBy(Location, { professionalId });

        if (existentes >= MAX_LOCATIONS_POR_PROFISSIONAL) {
          throw new UnprocessableEntityException({
            validationErrors: [
              {
                field: 'name',
                message: `Você já cadastrou ${MAX_LOCATIONS_POR_PROFISSIONAL} locais. Exclua um para cadastrar outro.`,
              },
            ],
          });
        }

        // O primeiro local vira principal sozinho. Perfil com locais e nenhum principal é um
        // estado que ninguém pediu e que a Fase 6 não saberia usar — ela pré-seleciona o
        // principal ao criar disponibilidade.
        const principal = dto.isPrimary === true || existentes === 0;
        if (principal) await this.desmarcarPrincipal(manager, professionalId);

        const novo = manager.create(Location, {
          id: uuidv7(),
          professionalId,
          name: dto.name,
          kind: dto.kind,
          isPrimary: principal,
          streetAddress,
          neighborhood: dto.neighborhood || null,
          city: dto.city,
          state: dto.state,
          accessNotes: dto.accessNotes || null,
        });

        await manager.insert(Location, novo);
        return novo;
      })
      .catch((erro: unknown) => this.traduzirConflito(erro));

    return this.emLinha(local);
  }

  async atualizar(
    professionalId: string,
    id: string,
    dto: UpdateLocationDto,
  ): Promise<LocationRow> {
    const atualizado = await this.locations.manager
      .transaction(async (manager) => {
        const atual = await manager.findOneBy(Location, { id, professionalId });
        if (!atual) throw this.inexistente();

        const kind = dto.kind ?? atual.kind;

        // Trocar o tipo para "casa do aluno" **apaga** o endereço que estava lá: aquele campo
        // deixa de poder existir, e o `CHECK` recusaria o UPDATE. Mandar o tipo e um endereço
        // na mesma requisição é contradição, e essa recebe 422 em vez de sumiço silencioso.
        const enviouEndereco = dto.streetAddress !== undefined;
        const streetAddress = this.enderecoPermitido(
          kind,
          enviouEndereco ? dto.streetAddress || null : atual.streetAddress,
          enviouEndereco,
        );

        if (dto.isPrimary === false && atual.isPrimary) {
          throw new UnprocessableEntityException({
            validationErrors: [
              {
                field: 'isPrimary',
                message: 'Para trocar o local principal, marque outro local como principal.',
              },
            ],
          });
        }

        const viraPrincipal = dto.isPrimary === true && !atual.isPrimary;
        if (viraPrincipal) await this.desmarcarPrincipal(manager, professionalId);

        await manager.update(
          Location,
          { id },
          {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.kind !== undefined ? { kind } : {}),
            ...(dto.neighborhood !== undefined ? { neighborhood: dto.neighborhood || null } : {}),
            ...(dto.city !== undefined ? { city: dto.city } : {}),
            ...(dto.state !== undefined ? { state: dto.state } : {}),
            ...(dto.accessNotes !== undefined ? { accessNotes: dto.accessNotes || null } : {}),
            ...(viraPrincipal ? { isPrimary: true } : {}),
            streetAddress,
          },
        );

        return manager.findOneByOrFail(Location, { id });
      })
      .catch((erro: unknown) => this.traduzirConflito(erro));

    return this.emLinha(atualizado);
  }

  /**
   * Exclusão lógica, e a promoção de quem fica.
   *
   * Apagar o único local é permitido: nada aponta para local na Fase 3, e o perfil apenas
   * volta a ficar incompleto. Bloquear seria inventar uma trava para proteger uma
   * disponibilidade que ainda não existe. A partir da Fase 6 essa trava passa a fazer sentido,
   * e é lá que ela entra.
   */
  async remover(professionalId: string, id: string): Promise<void> {
    await this.locations.manager.transaction(async (manager) => {
      const alvo = await manager.findOneBy(Location, { id, professionalId });
      if (!alvo) throw this.inexistente();

      await manager.softDelete(Location, { id });
      if (!alvo.isPrimary) return;

      // O principal saiu: promove o mais antigo entre os que ficaram. Deixar o profissional
      // sem principal quebraria o padrão do formulário de agenda por um motivo que ele não
      // pediu — ele apagou um local, não desconfigurou a agenda.
      const proximo = await manager.findOne(Location, {
        where: { professionalId },
        order: { createdAt: 'ASC' },
        select: { id: true },
      });

      if (proximo) await manager.update(Location, { id: proximo.id }, { isPrimary: true });
    });
  }

  /**
   * Desmarca o principal de agora, dentro da transação de quem vai assumir.
   *
   * Não é "por garantia": o índice único parcial recusa dois principais, então o `UPDATE`
   * precisa acontecer **antes** do outro, na mesma transação. Fora dela, uma falha no meio
   * deixaria o profissional sem principal nenhum.
   */
  private async desmarcarPrincipal(manager: EntityManager, professionalId: string): Promise<void> {
    await manager.update(Location, { professionalId, isPrimary: true }, { isPrimary: false });
  }

  /**
   * O endereço, se este tipo de local pode ter um.
   *
   * O endereço da casa do aluno é dado pessoal **do aluno**, e não pertence à configuração de
   * quem dá aula — ele mora na ficha (Fase 5) ou na sessão (Fase 6). Aqui a recusa existe para
   * a pessoa ler uma frase; quem garante mesmo é o `CHECK` da migration.
   */
  private enderecoPermitido(
    kind: LocationKind,
    streetAddress: string | null,
    recusarSeVeio = true,
  ): string | null {
    if (kind !== LocationKind.StudentHome) return streetAddress;

    if (streetAddress && recusarSeVeio) {
      throw new UnprocessableEntityException({
        validationErrors: [
          {
            field: 'streetAddress',
            message:
              'Atendimento na casa do aluno não leva endereço aqui — o endereço é do aluno, e fica na ficha dele.',
          },
        ],
      });
    }
    return null;
  }

  /** Mensagem igual para "não existe" e para "não é seu" — `iam.md` §7, regra transversal 1. */
  private inexistente(): NotFoundException {
    return new NotFoundException('Não encontramos este local na sua conta.');
  }

  /**
   * Dois locais disputando o posto de principal ao mesmo tempo — o mesmo profissional, em duas
   * abas.
   *
   * O índice único parcial resolve, e resolve recusando. Traduzir aqui existe para a pessoa ler
   * uma frase em vez de "erro interno"; escolher um vencedor no lugar dela seria decidir qual
   * das duas abas ela quis.
   */
  private traduzirConflito(erro: unknown): never {
    if (ehViolacaoDeUnicidade(erro, 'uq_locations_principal')) {
      throw new ConflictException(
        'Outro local foi marcado como principal ao mesmo tempo. Recarregue a página e tente de novo.',
      );
    }
    throw erro;
  }

  /**
   * Entidade → contrato, campo a campo.
   *
   * Nunca por serialização automática. `professional_id` e `deleted_at` não têm o que fazer na
   * resposta, e no dia em que a tabela ganhar uma coluna nova é aqui que alguém decide se ela
   * sai — em vez de descobrir que já saiu.
   */
  private emLinha(local: Location): LocationRow {
    return {
      id: local.id,
      name: local.name,
      kind: local.kind,
      isPrimary: local.isPrimary,
      streetAddress: local.streetAddress,
      neighborhood: local.neighborhood,
      city: local.city,
      state: local.state,
      accessNotes: local.accessNotes,
    };
  }
}
