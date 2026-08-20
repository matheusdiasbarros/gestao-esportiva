import 'reflect-metadata';
import { AccessHolder } from '@gestao/types';
import { DataSource } from 'typeorm';
import { uuidv7 } from 'uuidv7';
import { Professional } from '../../modules/iam/entities/professional.entity';
import { Student } from '../../modules/iam/entities/student.entity';
import { IdentityProvider, UserIdentity } from '../../modules/iam/entities/user-identity.entity';
import { User } from '../../modules/iam/entities/user.entity';
import { PasswordService } from '../../modules/iam/services/password.service';
import dataSource from '../data-source';

/**
 * Dados de desenvolvimento. Fecha a DT-003.
 *
 * **Idempotente**: identificadores são fixos e nada é inserido duas vezes. Rodar de novo em um
 * banco já populado não duplica e não falha — o que importa porque o comando vai ser rodado
 * por reflexo depois de todo `db:reset`.
 *
 * O cenário existe para exercitar as decisões do modelo, não para parecer realista:
 *
 * - **Rodrigo** — profissional, o caso comum.
 * - **Ana** — segunda profissional, para provar que a carteira de um não enxerga a do outro.
 * - **Marina** — conta de aluna com ficha nos **dois** profissionais. É o caso que só funciona
 *   porque `Student` é a ficha e não a pessoa.
 * - **João** — ficha **sem conta**, o aluno que nunca aceitou o convite. Precisa ser
 *   plenamente utilizável assim.
 * - **Carlos** — responsável, cuja conta acessa a ficha da filha.
 * - **Sofia** — ficha de menor, sem conta própria, acessada por Carlos (decisão D9).
 * - **Beatriz** — conta de aluna **sem professor nenhum**, resultado do cadastro aberto (D10).
 *
 * O administrador vem de variável de ambiente. Não existe rota pública que crie um: promover
 * uma conta é operação manual no banco enquanto não houver painel.
 */

/** Versão dos Termos aceita pelos dados de seed. Os Termos reais ainda não existem. */
const TERMOS = 'v0-desenvolvimento';

const ID = {
  rodrigo: '01900000-0000-7000-8000-00000000e001',
  ana: '01900000-0000-7000-8000-00000000e002',
  marina: '01900000-0000-7000-8000-00000000e003',
  carlos: '01900000-0000-7000-8000-00000000e004',
  beatriz: '01900000-0000-7000-8000-00000000e005',
  admin: '01900000-0000-7000-8000-00000000e006',
  profRodrigo: '01900000-0000-7000-8000-00000000f001',
  profAna: '01900000-0000-7000-8000-00000000f002',
  fichaMarinaRodrigo: '01900000-0000-7000-8000-000000010001',
  fichaMarinaAna: '01900000-0000-7000-8000-000000010002',
  fichaJoao: '01900000-0000-7000-8000-000000010003',
  fichaSofia: '01900000-0000-7000-8000-000000010004',
} as const;

async function seed(ds: DataSource): Promise<void> {
  const senhas = new PasswordService();
  const users = ds.getRepository(User);
  const identities = ds.getRepository(UserIdentity);
  const professionals = ds.getRepository(Professional);
  const students = ds.getRepository(Student);

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@gestao.local').toLowerCase();
  const adminSenha = process.env.SEED_ADMIN_PASSWORD ?? 'trocar-esta-senha';
  const senhaPadrao = process.env.SEED_DEFAULT_PASSWORD ?? 'desenvolvimento1';

  const criarConta = async (
    id: string,
    email: string,
    fullName: string,
    birthDate: string,
    senha: string,
    isPlatformAdmin = false,
  ): Promise<void> => {
    if (await users.exists({ where: { id } })) return;

    await users.insert({
      id,
      email: email.toLowerCase(),
      fullName,
      birthDate,
      isPlatformAdmin,
      // Verificadas: o cenário de desenvolvimento não deve esbarrar na verificação toda hora.
      emailVerifiedAt: new Date(),
      pendingEmail: null,
      termsVersion: TERMOS,
      termsAcceptedAt: new Date(),
    });

    // Id aleatório, não derivado: a idempotência já vem da checagem de existência acima, e
    // derivar do id da conta produzia colisão entre contas com sufixos parecidos.
    await identities.insert({
      id: uuidv7(),
      userId: id,
      provider: IdentityProvider.Password,
      providerUid: null,
      passwordHash: await senhas.hash(senha),
      passwordChangedAt: new Date(),
    });
  };

  await criarConta(ID.admin, adminEmail, 'Administrador', '1990-01-01', adminSenha, true);
  await criarConta(
    ID.rodrigo,
    'rodrigo@exemplo.local',
    'Rodrigo Almeida',
    '1994-03-12',
    senhaPadrao,
  );
  await criarConta(ID.ana, 'ana@exemplo.local', 'Ana Ferreira', '1988-07-30', senhaPadrao);
  await criarConta(ID.marina, 'marina@exemplo.local', 'Marina Souza', '1998-11-05', senhaPadrao);
  await criarConta(ID.carlos, 'carlos@exemplo.local', 'Carlos Dias', '1985-02-20', senhaPadrao);
  await criarConta(ID.beatriz, 'beatriz@exemplo.local', 'Beatriz Lima', '2000-09-14', senhaPadrao);

  const criarProfissional = async (id: string, userId: string, slug: string): Promise<void> => {
    if (await professionals.exists({ where: { id } })) return;
    await professionals.insert({ id, userId, signupSlug: slug, signupLinkEnabled: true });
  };

  await criarProfissional(ID.profRodrigo, ID.rodrigo, 'rodrigo-beach-tennis');
  await criarProfissional(ID.profAna, ID.ana, 'ana-tenis');

  const criarFicha = async (ficha: Partial<Student> & { id: string }): Promise<void> => {
    if (await students.exists({ where: { id: ficha.id } })) return;
    await students.insert(ficha);
  };

  // A mesma pessoa, dois profissionais, duas fichas. Rodrigo não sabe que Ana existe.
  await criarFicha({
    id: ID.fichaMarinaRodrigo,
    professionalId: ID.profRodrigo,
    userId: ID.marina,
    fullName: 'Marina',
    email: 'marina@exemplo.local',
    phone: '11999990001',
  });
  await criarFicha({
    id: ID.fichaMarinaAna,
    professionalId: ID.profAna,
    userId: ID.marina,
    fullName: 'Marina Souza',
    email: 'marina@exemplo.local',
    phone: '11999990001',
  });

  // Ficha sem conta: o aluno que só tem WhatsApp e nunca aceitou o convite.
  await criarFicha({
    id: ID.fichaJoao,
    professionalId: ID.profRodrigo,
    fullName: 'João Pereira',
    phone: '11999990002',
  });

  // Menor de idade: quem acessa é o responsável, com a conta dele.
  await criarFicha({
    id: ID.fichaSofia,
    professionalId: ID.profRodrigo,
    userId: ID.carlos,
    fullName: 'Sofia Dias',
    birthDate: '2014-05-09',
    accessHolder: AccessHolder.Guardian,
  });
}

async function main(): Promise<void> {
  const ds = await dataSource.initialize();
  try {
    await seed(ds);
    // `process.stdout` e não `console.log`: o ESLint só libera warn e error, e a regra está
    // certa — o log da API é estruturado, via pino. Aqui é a saída de um script de terminal.
    process.stdout.write('Seeds aplicadas.\n');
  } finally {
    await ds.destroy();
  }
}

void main().catch((erro: unknown) => {
  console.error(erro);
  process.exit(1);
});
