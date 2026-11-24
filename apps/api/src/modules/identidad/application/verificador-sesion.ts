import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma.service';
import { sesionVigente } from '../domain/sesion';

export interface UsuarioActual {
  id: string;
  nombre: string;
  rol: RolUsuario;
}

/**
 * Valida un token y devuelve el usuario. Consulta la base de datos en cada uso:
 * desactivar a alguien, cambiarle el rol o cambiarle la contraseña tiene efecto inmediato.
 * Lo usan la API REST y el canal en tiempo real.
 */
@Injectable()
export class VerificadorSesion {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async verificar(token: string | undefined): Promise<UsuarioActual | null> {
    if (!token) return null;
    let id: string;
    let emitidoEn: number | undefined;
    try {
      ({ sub: id, iat: emitidoEn } = await this.jwt.verifyAsync<{ sub: string; iat?: number }>(token));
    } catch {
      return null;
    }
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: { id: true, nombre: true, rol: true, activo: true, sesionesDesde: true } });
    return usuario?.activo && sesionVigente(emitidoEn, usuario.sesionesDesde) ? { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } : null;
  }
}
