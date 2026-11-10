import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { AutenticacionService } from '../application/autenticacion.service';
import { UsuarioActual } from '../application/verificador-sesion';
import { Publico, Usuario } from './seguridad';

class LoginDto {
  @IsEmail({}, { message: 'Escribe un correo válido' })
  email!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}

@Controller('auth')
export class AutenticacionController {
  constructor(private readonly autenticacion: AutenticacionService) {}

  // Limita los intentos para frenar ataques de fuerza bruta a las contraseñas
  @Publico()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() { email, password }: LoginDto) {
    return this.autenticacion.iniciarSesion(email, password);
  }

  @Get('yo')
  yo(@Usuario() usuario: UsuarioActual) {
    return this.autenticacion.perfil(usuario.id);
  }
}
