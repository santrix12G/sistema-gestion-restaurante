import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DomainError } from '../../../shared/domain-error';
import { PrismaService } from '../../../shared/prisma.service';
import { normalizarEmail, RolPersonal, ROLES_PERSONAL, validarBorrado, validarContrasena, validarSinPendientes } from '../domain/personal';

export interface NuevaCuenta {
  nombre: string;
  email: string;
  rol: RolPersonal;
  password: string;
}

export type CambiosCuenta = Partial<NuevaCuenta> & { activo?: boolean };

const CAMPOS = { id: true, nombre: true, email: true, rol: true, activo: true, creadoEn: true } satisfies Prisma.UsuarioSelect;

/** Cuentas de meseros y repartidores. Solo el administrador las gestiona. */
@Injectable()
export class PersonalService {
  constructor(private readonly prisma: PrismaService) {}

  /** Activas primero, por nombre, con sus pedidos abiertos y si ya tienen historial */
  async listar() {
    const cuentas = await this.prisma.usuario.findMany({
      where: { rol: { in: ROLES_PERSONAL } },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: { ...CAMPOS, _count: { select: { pedidosCreados: true, entregas: true, historial: true, movimientos: true } } },
    });
    return Promise.all(
      cuentas.map(async ({ _count, ...cuenta }) => ({
        ...cuenta,
        pedidosActivos: await this.pendientes(cuenta.id, cuenta.rol as RolPersonal),
        tieneHistorial: Object.values(_count).some((n) => n > 0),
      })),
    );
  }

  async crear({ nombre, email, rol, password }: NuevaCuenta) {
    validarContrasena(password);
    const passwordHash = await bcrypt.hash(password, 10);
    return this.conCorreoUnico(() =>
      this.prisma.usuario.create({ data: { nombre: nombre.trim(), email: normalizarEmail(email), rol, passwordHash }, select: CAMPOS }),
    );
  }

  async actualizar(id: string, { nombre, email, rol, password, activo }: CambiosCuenta) {
    const actual = await this.obtener(id);
    const cambiaRol = rol !== undefined && rol !== actual.rol;
    if ((activo === false && actual.activo) || cambiaRol) validarSinPendientes(actual.nombre, await this.pendientes(id, actual.rol as RolPersonal));
    if (password !== undefined) validarContrasena(password);

    return this.conCorreoUnico(async () =>
      this.prisma.usuario.update({
        where: { id },
        data: {
          nombre: nombre?.trim(),
          email: email !== undefined ? normalizarEmail(email) : undefined,
          rol,
          activo,
          passwordHash: password !== undefined ? await bcrypt.hash(password, 10) : undefined,
          // Una contraseña nueva cierra las sesiones que la cuenta tenga abiertas
          sesionesDesde: password !== undefined ? new Date() : undefined,
        },
        select: CAMPOS,
      }),
    );
  }

  async eliminar(id: string) {
    const cuenta = await this.obtener(id);
    const { _count } = await this.prisma.usuario.findUniqueOrThrow({
      where: { id },
      select: { _count: { select: { pedidosCreados: true, entregas: true, historial: true, movimientos: true } } },
    });
    validarBorrado(cuenta.nombre, Object.values(_count).reduce((a, b) => a + b, 0));
    await this.prisma.usuario.delete({ where: { id } });
  }

  /** Las cuentas de administrador no se tocan desde aquí: responde como si no existieran */
  private async obtener(id: string) {
    const cuenta = await this.prisma.usuario.findUnique({ where: { id }, select: CAMPOS });
    if (!cuenta || !ROLES_PERSONAL.includes(cuenta.rol as RolPersonal)) throw new DomainError('no_encontrado', 'La cuenta no existe');
    return cuenta;
  }

  /** Pedidos abiertos a su cargo: los que registró el mesero, o los domicilios que lleva el repartidor */
  private pendientes(id: string, rol: RolPersonal) {
    return rol === 'MESERO'
      ? this.prisma.pedido.count({ where: { creadoPorId: id, estado: 'ACTIVO' } })
      : this.prisma.entrega.count({ where: { repartidorId: id, pedido: { estado: 'ACTIVO' } } });
  }

  private async conCorreoUnico<T>(operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('conflicto', 'Ya existe una cuenta con ese correo');
      throw e;
    }
  }
}
