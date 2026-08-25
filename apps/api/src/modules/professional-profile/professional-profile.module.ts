import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/config.module';
import { IamModule } from '../iam/iam.module';
import { SportsModule } from '../sports/sports.module';
import { Location } from './entities/location.entity';
import { ProfessionalProfile } from './entities/professional-profile.entity';
import { ProfessionalSportPrice } from './entities/professional-sport-price.entity';
import { ProfessionalSport } from './entities/professional-sport.entity';
import { LocationsController } from './locations.controller';
import { PhotosController } from './photos.controller';
import { ProfessionalProfileController } from './professional-profile.controller';
import { ProfessionalSportsController } from './professional-sports.controller';
import { LocationsService } from './services/locations.service';
import { PhotoStorage } from './services/photo-storage';
import { ProfessionalProfileService } from './services/professional-profile.service';
import { ProfessionalSportsService } from './services/professional-sports.service';
import { ProfilePhotoService } from './services/profile-photo.service';
import { ProfissionalAtual } from './services/profissional-atual';

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
      Location,
    ]),
  ],
  controllers: [
    ProfessionalProfileController,
    ProfessionalSportsController,
    LocationsController,
    PhotosController,
  ],
  providers: [
    ProfissionalAtual,
    ProfessionalProfileService,
    ProfessionalSportsService,
    LocationsService,
    PhotoStorage,
    ProfilePhotoService,
  ],
})
export class ProfessionalProfileModule {}
