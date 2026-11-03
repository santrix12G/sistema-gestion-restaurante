import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../shared/prisma.service';

// Se compara contra este hash cuando el correo no existe, para que la respuesta tarde lo mismo
// y no revele qué correos están registrados.
const HASH_DE_RELLENO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);

@Injectable()
export class AutenticacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async iniciarSesion(email: string, password: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
    const valida = await bcrypt.compare(password, usuario?.passwordHash ?? HASH_DE_RELLENO);
    if (!usuario || !valida || !usuario.activo) throw new UnauthorizedException('Correo o contraseña incorrectos');

    const token = await this.jwt.signAsync({ sub: usuario.id });
    return { token, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } };
  }

  async perfil(id: string) {
    return this.prisma.usuario.findUniqueOrThrow({ where: { id }, select: { id: true, nombre: true, email: true, rol: true } });
  }
}
