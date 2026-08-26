import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { API_PREFIX } from '@gestao/types';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { criarValidationPipe } from './common/validation/validation-pipe';
import { EnvironmentVariables, NodeEnv } from './config/env.validation';

async function bootstrap(): Promise<void> {
  // bufferLogs segura os logs do boot até o pino assumir, para nada sair sem formato.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  /**
   * Em quantos proxies confiar para descobrir o IP de quem chamou.
   *
   * **Zero**, e escrito de propósito — é o padrão do Express, mas o padrão é invisível e este
   * número decide se o limite de tentativas por IP significa alguma coisa.
   *
   * Hoje a API atende direto, e `req.ip` é o endereço real. **No dia em que ela subir atrás de
   * balanceador, proxy reverso ou Cloudflare, esta linha precisa mudar** — sem isso, `req.ip`
   * passa a ser o endereço do proxy em 100% das requisições, o teto de 60 logins por 5 minutos
   * vira o teto da plataforma inteira, e a defesa se transforma em indisponibilidade contra nós
   * mesmos.
   *
   * E o conserto **não é `true`**. Com `true`, o Express acredita no `X-Forwarded-For` que
   * qualquer um manda, e o atacante ganha um balde novo a cada requisição — o limite por IP
   * passa a valer zero, em silêncio. O valor certo é o **número de saltos confiáveis** entre a
   * internet e este processo.
   */
  app.set('trust proxy', false);

  // Objeto validado e tipado — nunca ConfigService. Ver config/config.module.ts.
  const env = app.get(EnvironmentVariables);
  const ehProducao = env.NODE_ENV === NodeEnv.Production;

  app.setGlobalPrefix(API_PREFIX);

  // Os tokens da web viajam em cookie httpOnly, então a strategy precisa conseguir lê-los.
  app.use(cookieParser());

  // Necessário para o onApplicationShutdown do Redis e o fechamento do pool do TypeORM.
  app.enableShutdownHooks();

  app.enableCors({
    origin: env.API_CORS_ORIGINS.split(',')
      .map((origem) => origem.trim())
      .filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(criarValidationPipe());

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
