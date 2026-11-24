import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { AutenticacionService } from '../application/autenticacion.service';
import { Idioma, RecuperacionService } from '../application/recuperacion.service';
import { UsuarioActual } from '../application/verificador-sesion';
import { MAX_CONTRASENA } from '../domain/personal';
import { VerificadorCaptcha } from './captcha';
import { Publico, Usuario } from './seguridad';

class LoginDto {
  @IsEmail({}, { message: 'Escribe un correo válido' })
  email!: string;

  @IsString()
  @MaxLength(200)
  password!: string;

  /** «Mantener la sesión iniciada» en este equipo */
  @IsOptional()
  @IsBoolean()
  recordar?: boolean;

  /** Respuesta del captcha de Cloudflare Turnstile */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  captcha?: string;
}

class SolicitarRecuperacionDto {
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @MaxLength(120)
  email!: string;

  @IsOptional()
  @IsIn(['es', 'en'])
  idioma?: Idioma;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  captcha?: string;
}

class CambiarContrasenaDto {
  @IsString()
  @MaxLength(MAX_CONTRASENA * 4)
  actual!: string;

  // La longitud y las reglas las valida el dominio
  @IsString()
  @MaxLength(MAX_CONTRASENA * 4)
  nueva!: string;

  /** Si la sesión de este equipo estaba guardada por 30 días, la nueva también */
  @IsOptional()
  @IsBoolean()
  recordar?: boolean;
}

class RestablecerDto {
  @IsString()
  @Length(20, 200, { message: 'El enlace no es válido o ya venció. Pide uno nuevo' })
  token!: string;

  // La longitud y las reglas las valida el dominio
  @IsString()
  @MaxLength(MAX_CONTRASENA * 4)
  password!: string;
}

// Todas las rutas públicas limitan los intentos para frenar ataques de fuerza bruta
@Controller('auth')
export class AutenticacionController {
  constructor(
    private readonly autenticacion: AutenticacionService,
    private readonly recuperacion: RecuperacionService,
    private readonly captcha: VerificadorCaptcha,
  ) {}

  /** Inicio de sesión de la web: exige el captcha si está configurado */
  @Publico()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() { email, password, recordar, captcha }: LoginDto) {
    await this.captcha.exigir(captcha);
    return this.autenticacion.iniciarSesion(email, password, recordar);
  }

  /**
   * Inicio de sesión de la app móvil, que no muestra captcha. En su lugar admite menos intentos por minuto.
   * Las cuentas que entran por aquí son solo del personal; los clientes usan el chatbot.
   */
  @Publico()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login/movil')
  @HttpCode(200)
  loginMovil(@Body() { email, password, recordar }: LoginDto) {
    return this.autenticacion.iniciarSesion(email, password, recordar);
  }

  /** «¿Olvidaste tu contraseña?». Responde igual exista o no la cuenta */
  @Publico()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('recuperar')
  @HttpCode(200)
  async solicitarRecuperacion(@Body() { email, idioma, captcha }: SolicitarRecuperacionDto) {
    await this.captcha.exigir(captcha);
    return this.recuperacion.solicitar(email, idioma);
  }

  @Publico()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('restablecer')
  @HttpCode(200)
  restablecer(@Body() { token, password }: RestablecerDto) {
    return this.recuperacion.restablecer(token, password);
  }

  /** Cualquier usuario con sesión cambia su propia contraseña. Pocos intentos: exige la contraseña actual */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('contrasena')
  @HttpCode(200)
  cambiarContrasena(@Usuario() usuario: UsuarioActual, @Body() { actual, nueva, recordar }: CambiarContrasenaDto) {
    return this.autenticacion.cambiarContrasena(usuario.id, actual, nueva, recordar);
  }

  @Get('yo')
  yo(@Usuario() usuario: UsuarioActual) {
    return this.autenticacion.perfil(usuario.id);
  }
}
