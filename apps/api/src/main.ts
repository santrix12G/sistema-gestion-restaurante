import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';
import { leerConfig } from './shared/config';

async function iniciar() {
  const config = leerConfig();
  const app = await NestFactory.create(AppModule, { rawBody: true }); // rawBody: para validar la firma de Meta
  configurarApp(app, config);
  await app.listen(config.puerto);
  console.log(`API lista en http://localhost:${config.puerto}/api`);
}

void iniciar();
