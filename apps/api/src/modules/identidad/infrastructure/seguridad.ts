import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import { Request } from 'express';
import { UsuarioActual, VerificadorSesion } from '../application/verificador-sesion';

const PUBLICO = 'publico';
const ROLES = 'roles';

/** La ruta no exige sesión. */
export const Publico = () => SetMetadata(PUBLICO, true);

/** Solo estos roles pueden usar la ruta. Sin este decorador, basta con tener sesión. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES, roles);

export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().usuario as UsuarioActual);

/** Se aplica a todas las rutas HTTP. */
@Injectable()
export class GuardiaSesion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verificador: VerificadorSesion,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destino = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, destino)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { usuario?: UsuarioActual }>();
    const [esquema, token] = req.headers.authorization?.split(' ') ?? [];
    if (esquema !== 'Bearer' || !token) throw new UnauthorizedException('Inicia sesión para continuar');

    const usuario = await this.verificador.verificar(token);
    if (!usuario) throw new UnauthorizedException('La sesión expiró o ya no es válida. Inicia sesión de nuevo');

    const roles = this.reflector.getAllAndOverride<RolUsuario[] | undefined>(ROLES, destino);
    if (roles && !roles.includes(usuario.rol)) throw new ForbiddenException('Tu rol no tiene permiso para esta acción');

    req.usuario = usuario;
    return true;
  }
}
