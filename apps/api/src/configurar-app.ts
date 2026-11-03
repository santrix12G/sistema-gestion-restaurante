import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Config } from './shared/config';
import { ErroresHttpFilter } from './shared/errores-http.filter';

/** Lo comparten main.ts y las pruebas de integración, para probar la API tal como corre. */
export function configurarApp(app: INestApplication, config: Config) {
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({ origin: config.corsOrigins });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ErroresHttpFilter());
  app.enableShutdownHooks();
}
