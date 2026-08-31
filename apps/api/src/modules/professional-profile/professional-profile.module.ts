import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/config.module';
import { IamModule } from '../iam/iam.module';
import { SportsModule } from '../sports/sports.module';
import { Location } from './entities/location.entity';
import { ProfessionalProfile } from './entities/professional-profile.entity';
import { ProfessionalSportLocation } from './entities/professional-sport-location.entity';
import { ProfessionalSportPrice } from './entities/professional-sport-price.entity';
import { ProfessionalSport } from './entities/professional-sport.entity';
import { Space } from './entities/space.entity';
import { LocationsController } from './locations.controller';
import { PhotosController } from './photos.controller';
import { ProfessionalProfileController } from './professional-profile.controller';
import { ProfessionalSportsController } from './professional-sports.controller';
import { PublicProfileController } from './public-profile.controller';
import { LocationsService } from './services/locations.service';
import { PhotoStorage } from './services/photo-storage';
import { ProfessionalProfileService } from './services/professional-profile.service';
import { ProfessionalSportsService } from './services/professional-sports.service';
import { ProfilePhotoService } from './services/profile-photo.service';
import { ProfissionalAtual } from './services/profissional-atual';
import { PublicProfileService } from './services/public-profile.service';
import { RecursosDoNegocio } from './services/recursos-do-negocio';

/**
 * O perfil profissional: bio, modalidades, preços, locais e foto.
 *
 * **Não é o dono da tabela `professionals`.** Aquela é a âncora de identidade, mora em `iam`, e
 * é o que faz `RolesService` derivar o papel. Este módulo é dono de tudo que a Fase 3
 * acrescentou, e de nada mais (ADR-005 §2).
 *
 * **A dependência é de mão única:** `professional-profile` → `iam` e → `sports`, e nada volta.
 * É o que evita o `forwardRef` que qualquer arranjo com a identidade dependendo do perfil
 * exigiria.
 *
 * De `iam` ele usa duas coisas, as duas exportadas de lá: os decorators de autenticação e o
 * `AccessService`, para saber de quem é a sessão. **Nenhuma consulta daqui toca `users`,
 * `professionals` ou `students`** — um `grep` por essas entidades fora de `iam` precisa
 * continuar voltando vazio, e esse é o teste da ADR inteira.
 */
@Module({
  imports: [
    AppConfigModule,
    IamModule,
    SportsModule,
    TypeOrmModule.forFeature([
      ProfessionalProfile,
      ProfessionalSport,
      ProfessionalSportPrice,
      ProfessionalSportLocation,
      Location,
      Space,
    ]),
  ],
  controllers: [
    ProfessionalProfileController,
    ProfessionalSportsController,
    LocationsController,
    PhotosController,
    PublicProfileController,
  ],
  providers: [
    ProfissionalAtual,
    ProfessionalProfileService,
    ProfessionalSportsService,
    LocationsService,
    PhotoStorage,
    ProfilePhotoService,
    PublicProfileService,
    RecursosDoNegocio,
  ],
  // **A única coisa que este módulo exporta**, e ela é de leitura. O `scheduling` precisa saber
  // se a modalidade, o local e a quadra de uma faixa existem e são deste negócio; a ADR-001
  // proíbe que ele consulte estas tabelas por conta própria. A porta responde "o que existe" —
  // decidir e recusar é de quem monta agenda.
  exports: [RecursosDoNegocio],
})
export class ProfessionalProfileModule {}
