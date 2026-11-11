import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { leerConfig } from '../../shared/config';
import { AutenticacionService } from './application/autenticacion.service';
import { PersonalService } from './application/personal.service';
import { VerificadorSesion } from './application/verificador-sesion';
import { AutenticacionController } from './infrastructure/autenticacion.controller';
import { PersonalController } from './infrastructure/personal.controller';
import { GuardiaSesion } from './infrastructure/seguridad';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: leerConfig().jwtSecret, signOptions: { expiresIn: '12h' } }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [AutenticacionController, PersonalController],
  providers: [AutenticacionService, PersonalService, VerificadorSesion, { provide: APP_GUARD, useClass: GuardiaSesion }],
  exports: [VerificadorSesion],
})
export class IdentidadModule {}
