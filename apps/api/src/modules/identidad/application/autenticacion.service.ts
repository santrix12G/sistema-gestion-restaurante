import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../shared/prisma.service';
import { DURACION_SESION, ocultarEmail } from '../domain/sesion';

// Se compara contra este hash cuando el correo no existe, para que la respuesta tarde lo mismo
// y no revele qué correos están registrados.
const HASH_DE_RELLENO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);

@Injectable()
export class AutenticacionService {
  // Registro de auditoría de los inicios de sesión (Anexo 3 de la Resolución 1519 de 2020)
  private readonly logger = new Logger('Autenticacion');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Con `recordar`, la sesión dura un mes en ese equipo; sin ella, un turno de 12 horas */
  async iniciarSesion(email: string, password: string, recordar = false) {
    const correo = email.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({ where: { email: correo } });
    const valida = await bcrypt.compare(password, usuario?.passwordHash ?? HASH_DE_RELLENO);
    if (!usuario || !valida || !usuario.activo) {
      this.logger.warn(`Inicio de sesión fallido para ${ocultarEmail(correo)}`);
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const expiresIn = recordar ? DURACION_SESION.recordada : DURACION_SESION.turno;
    const token = await this.jwt.signAsync({ sub: usuario.id }, { expiresIn });
    this.logger.log(`Inicio de sesión de ${usuario.id} (${usuario.rol}), sesión de ${expiresIn}`);
    return { token, expiraEn: expiresIn, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } };
  }

  async perfil(id: string) {
    return this.prisma.usuario.findUniqueOrThrow({ where: { id }, select: { id: true, nombre: true, email: true, rol: true } });
  }
}
