import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:5173',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);

  console.log(`API running on http://localhost:${port}/api`);
}

bootstrap();