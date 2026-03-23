import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { GraphqlAppModule } from './graphql/graphql-app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: 'localhost',
      port: 3005,
    },
  });

  const config = new DocumentBuilder()
    .setTitle('Sentinel API')
    .setDescription('The Sentinel API description')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);

  // Keep REST and existing consumers backward-compatible.
  // GraphQL is exposed on a separate port (4000).
  try {
    const gqlApp = await NestFactory.create(GraphqlAppModule);
    gqlApp.enableCors();
    await gqlApp.listen(4000);
  } catch (err) {
    // REST should keep running even if GraphQL fails to initialize (e.g. Mongo down).
    // eslint-disable-next-line no-console
    console.error('[GRAPHQL] Failed to start GraphQL on port 4000:', err);
  }
}
bootstrap();
