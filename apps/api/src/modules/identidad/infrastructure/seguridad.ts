import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../../shared/prisma.service';

export interface UsuarioActual {
  id: string;
  nombre: string;
  rol: RolUsuario;
}

const PUBLICO = 'publico';
const ROLES = 'roles';

/** La ruta no exige sesión. */
export const Publico = () => SetMetadata(PUBLICO, true);

/** Solo estos roles pueden usar la ruta. Sin este decorador, basta con tener sesión. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES, roles);

export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().usuario as UsuarioActual);

/** Se aplica a todas las rutas. Consulta el usuario en cada petición: desactivarlo o cambiarle el rol tiene efecto inmediato. */
@Injectable()
export class GuardiaSesion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destino = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, destino)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { usuario?: UsuarioActual }>();
    const [esquema, token] = req.headers.authorization?.split(' ') ?? [];
    if (esquema !== 'Bearer' || !token) throw new UnauthorizedException('Inicia sesión para continuar');

    let id: string;
    try {
      ({ sub: id } = await this.jwt.verifyAsync<{ sub: string }>(token));
    } catch {
      throw new UnauthorizedException('La sesión expiró. Inicia sesión de nuevo');
    }
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: { id: true, nombre: true, rol: true, activo: true } });
    if (!usuario?.activo) throw new UnauthorizedException('La sesión ya no es válida');

    const roles = this.reflector.getAllAndOverride<RolUsuario[] | undefined>(ROLES, destino);
    if (roles && !roles.includes(usuario.rol)) throw new ForbiddenException('Tu rol no tiene permiso para esta acción');

    req.usuario = { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol };
    return true;
  }
}
