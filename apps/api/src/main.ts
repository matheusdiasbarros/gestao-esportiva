import 'reflect-metadata';
import { UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { API_PREFIX } from '@gestao/types';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { flattenValidationErrors } from './common/validation/flatten-validation-errors';
import { EnvironmentVariables, NodeEnv } from './config/env.validation';

async function bootstrap(): Promise<void> {
  // bufferLogs segura os logs do boot até o pino assumir, para nada sair sem formato.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Objeto validado e tipado — nunca ConfigService. Ver config/config.module.ts.
  const env = app.get(EnvironmentVariables);
  const ehProducao = env.NODE_ENV === NodeEnv.Production;

  app.setGlobalPrefix(API_PREFIX);

  // Necessário para o onApplicationShutdown do Redis e o fechamento do pool do TypeORM.
  app.enableShutdownHooks();

  app.enableCors({
    origin: env.API_CORS_ORIGINS.split(',')
      .map((origem) => origem.trim())
      .filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Campo não declarado no DTO é descartado, e a requisição é rejeitada se vier algum.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // 422 e não 400: a requisição está bem formada, o conteúdo é que não passa na regra.
      exceptionFactory: (errors) =>
        new UnprocessableEntityException({
          validationErrors: flattenValidationErrors(errors),
        }),
    }),
  );

  app.useGlobalFilters(new ProblemDetailsFilter());

  if (!ehProducao) {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Gestão Esportiva — API')
        .setDescription('API da plataforma de gestão para profissionais esportivos autônomos.')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, documento);
  }

  const porta = env.API_PORT;
  await app.listen(porta);

  app.get(Logger).log(`API ouvindo em http://localhost:${porta}/${API_PREFIX}`);
}

void bootstrap();
