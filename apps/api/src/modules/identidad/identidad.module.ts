import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { leerConfig } from '../../shared/config';
import { AutenticacionService } from './application/autenticacion.service';
import { PersonalService } from './application/personal.service';
import { RecuperacionService } from './application/recuperacion.service';
import { VerificadorSesion } from './application/verificador-sesion';
import { AutenticacionController } from './infrastructure/autenticacion.controller';
import { VerificadorCaptcha } from './infrastructure/captcha';
import { EnviadorCorreo } from './infrastructure/correo';
import { PersonalController } from './infrastructure/personal.controller';
import { GuardiaSesion } from './infrastructure/seguridad';
import { DURACION_SESION } from './domain/sesion';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: leerConfig().jwtSecret, signOptions: { expiresIn: DURACION_SESION.turno } }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      errorMessage: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo',
    }),
  ],
  controllers: [AutenticacionController, PersonalController],
  providers: [AutenticacionService, PersonalService, RecuperacionService, VerificadorCaptcha, EnviadorCorreo, VerificadorSesion, { provide: APP_GUARD, useClass: GuardiaSesion }],
  exports: [VerificadorSesion],
})
export class IdentidadModule {}
