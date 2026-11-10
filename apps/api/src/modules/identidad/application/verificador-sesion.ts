import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma.service';

export interface UsuarioActual {
  id: string;
  nombre: string;
  rol: RolUsuario;
}

/**
 * Valida un token y devuelve el usuario. Consulta la base de datos en cada uso:
 * desactivar a alguien o cambiarle el rol tiene efecto inmediato.
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
    try {
      ({ sub: id } = await this.jwt.verifyAsync<{ sub: string }>(token));
    } catch {
      return null;
    }
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: { id: true, nombre: true, rol: true, activo: true } });
    return usuario?.activo ? { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } : null;
  }
}
