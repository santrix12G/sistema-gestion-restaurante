import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../../../shared/domain-error';
import { PrismaService } from '../../../shared/prisma.service';
import { codigoMesa, siguienteNumero, TipoMesa, validarRetiro } from '../domain/mesa';

export interface DatosMesa {
  tipo?: TipoMesa;
  numero?: number;
  capacidad?: number;
  activa?: boolean;
}

/** Mesas del restaurante. Todos las consultan para tomar pedidos; solo el administrador las cambia. */
@Injectable()
export class MesasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Por tipo (normales, largas, afuera) y número, con cuántos pedidos abiertos tiene cada una. */
  async listar(incluirSuspendidas = false) {
    const mesas = await this.prisma.mesa.findMany({
      where: incluirSuspendidas ? {} : { activa: true },
      orderBy: [{ tipo: 'asc' }, { numero: 'asc' }],
      include: { _count: { select: { pedidos: true } } },
    });
    const activos = await this.pedidosActivosPorMesa();
    return mesas.map(({ _count, ...mesa }) => ({
      ...mesa,
      codigo: codigoMesa(mesa),
      pedidosActivos: activos.get(mesa.id) ?? 0,
      // Una mesa que ya tuvo pedidos no se borra, se suspende: los pedidos viejos la siguen nombrando
      tienePedidos: _count.pedidos > 0,
    }));
  }

  async crear({ tipo = 'NORMAL', numero, capacidad = 4 }: DatosMesa) {
    if (numero === undefined) {
      const delTipo = await this.prisma.mesa.findMany({ where: { tipo }, select: { numero: true } });
      numero = siguienteNumero(delTipo.map((m) => m.numero));
    }
    const mesa = await this.guardar({ tipo, numero }, () => this.prisma.mesa.create({ data: { tipo, numero, capacidad } }));
    return { ...mesa, codigo: codigoMesa(mesa) };
  }

  async actualizar(id: string, datos: DatosMesa) {
    const actual = await this.obtener(id);
    if (datos.activa === false && actual.activa) validarRetiro(actual, await this.contarActivos(id));
    const final = { tipo: datos.tipo ?? actual.tipo, numero: datos.numero ?? actual.numero };
    const mesa = await this.guardar(final, () => this.prisma.mesa.update({ where: { id }, data: datos }));
    return { ...mesa, codigo: codigoMesa(mesa) };
  }

  async eliminar(id: string) {
    const mesa = await this.obtener(id);
    if (await this.prisma.pedido.count({ where: { mesaId: id } })) {
      throw new DomainError('conflicto', `La mesa ${codigoMesa(mesa)} ya tiene pedidos registrados. Suspéndela en lugar de borrarla`);
    }
    await this.prisma.mesa.delete({ where: { id } });
  }

  private async obtener(id: string) {
    const mesa = await this.prisma.mesa.findUnique({ where: { id } });
    if (!mesa) throw new DomainError('no_encontrado', 'La mesa no existe');
    return mesa;
  }

  private contarActivos(mesaId: string) {
    return this.prisma.pedido.count({ where: { mesaId, estado: 'ACTIVO' } });
  }

  private async pedidosActivosPorMesa() {
    const grupos = await this.prisma.pedido.groupBy({ by: ['mesaId'], where: { estado: 'ACTIVO', mesaId: { not: null } }, _count: true });
    return new Map(grupos.map((g) => [g.mesaId, g._count]));
  }

  /** Dos mesas del mismo tipo no pueden tener el mismo número */
  private async guardar<T>(mesa: { tipo: TipoMesa; numero: number }, operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new DomainError('conflicto', `Ya existe la mesa ${codigoMesa(mesa)}`);
      }
      throw e;
    }
  }
}
