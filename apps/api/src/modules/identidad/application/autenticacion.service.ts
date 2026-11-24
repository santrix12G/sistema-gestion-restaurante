import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DomainError } from '../../../shared/domain-error';
import { PrismaService } from '../../../shared/prisma.service';
import { validarContrasena } from '../domain/personal';
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

    const sesion = await this.emitirSesion(usuario, recordar);
    this.logger.log(`Inicio de sesión de ${usuario.id} (${usuario.rol}), sesión de ${sesion.expiraEn}`);
    return sesion;
  }

  /**
   * Cada quien cambia su propia contraseña con la actual. Se cierran las sesiones de los otros equipos
   * y se devuelve una sesión nueva para que quien la cambió siga dentro.
   * La contraseña actual equivocada responde 400 y no 401: un 401 haría que la web y la app cerraran la sesión.
   */
  async cambiarContrasena(usuarioId: string, actual: string, nueva: string, recordar = false) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (!(await bcrypt.compare(actual, usuario.passwordHash))) {
      this.logger.warn(`Cambio de contraseña rechazado para ${usuario.id}: la actual no coincide`);
      throw new DomainError('validacion', 'La contraseña actual no es correcta');
    }
    validarContrasena(nueva);
    if (await bcrypt.compare(nueva, usuario.passwordHash)) throw new DomainError('validacion', 'La nueva contraseña debe ser distinta de la actual');
    const passwordHash = await bcrypt.hash(nueva, 10);
    // La sesión nueva se firma después de guardar sesionesDesde: su iat no es anterior y sigue valiendo
    await this.prisma.usuario.update({ where: { id: usuario.id }, data: { passwordHash, sesionesDesde: new Date() } });
    this.logger.log(`Contraseña cambiada por ${usuario.id} (${usuario.rol})`);
    return { mensaje: 'Contraseña actualizada. Se cerró la sesión en los demás equipos', ...(await this.emitirSesion(usuario, recordar)) };
  }

  private async emitirSesion(usuario: { id: string; nombre: string; email: string; rol: RolUsuario }, recordar: boolean) {
    const expiresIn = recordar ? DURACION_SESION.recordada : DURACION_SESION.turno;
    const token = await this.jwt.signAsync({ sub: usuario.id }, { expiresIn });
    return { token, expiraEn: expiresIn, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } };
  }

  async perfil(id: string) {
    return this.prisma.usuario.findUniqueOrThrow({ where: { id }, select: { id: true, nombre: true, email: true, rol: true } });
  }
}
