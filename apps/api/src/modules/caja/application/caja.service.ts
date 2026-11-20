import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../../../shared/domain-error';
import { PrismaService } from '../../../shared/prisma.service';
import { calcularArqueo, MetodoPago, TipoMovimientoCaja, validarMonto, validarSalida } from '../domain/caja';

const persona = { select: { id: true, nombre: true } } as const;
const DETALLE = {
  id: true,
  base: true,
  abiertaEn: true,
  cerradaEn: true,
  efectivoEsperado: true,
  efectivoContado: true,
  notasCierre: true,
  abiertaPor: persona,
  cerradaPor: persona,
  movimientos: { orderBy: { creadoEn: 'desc' }, select: { id: true, tipo: true, monto: true, motivo: true, creadoEn: true, usuario: persona } },
  pagos: {
    where: { estado: 'APROBADO' },
    orderBy: { actualizadoEn: 'desc' },
    select: { id: true, metodo: true, monto: true, actualizadoEn: true, cobradoPor: persona, pedido: { select: { numero: true } } },
  },
} satisfies Prisma.CajaSelect;
type CajaDetalle = Prisma.CajaGetPayload<{ select: typeof DETALLE }>;

/** Cuántas cajas cerradas muestra el historial */
const MAX_HISTORIAL = 30;

/** Turnos de caja: abrir con la base, registrar entradas y salidas, y cerrar con el arqueo. */
@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lo que necesita saber todo el personal: si se puede cobrar */
  async estado() {
    const caja = await this.prisma.caja.findFirst({ where: { cerradaEn: null }, select: { abiertaEn: true, abiertaPor: persona } });
    return { abierta: Boolean(caja), abiertaEn: caja?.abiertaEn ?? null, abiertaPor: caja?.abiertaPor.nombre ?? null };
  }

  /** La caja abierta con sus cuentas, o null si no hay ninguna */
  async actual() {
    const [caja, abiertos] = await Promise.all([
      this.prisma.caja.findFirst({ where: { cerradaEn: null }, select: DETALLE }),
      this.prisma.pedido.aggregate({ where: { estado: 'ACTIVO' }, _count: true, _sum: { total: true } }),
    ]);
    if (!caja) return null;
    return { ...this.vista(caja), pedidosAbiertos: { pedidos: abiertos._count, total: abiertos._sum.total ?? 0 } };
  }

  async abrir(base: number, usuarioId: string) {
    validarMonto(base, 'La base', { permitirCero: true });
    try {
      const caja = await this.prisma.caja.create({ data: { base, abiertaPorId: usuarioId }, select: DETALLE });
      return this.vista(caja);
    } catch (e) {
      // El índice único parcial no deja abrir otra mientras haya una abierta
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('conflicto', 'Ya hay una caja abierta');
      throw e;
    }
  }

  async registrarMovimiento(tipo: TipoMovimientoCaja, monto: number, motivo: string, usuarioId: string) {
    validarMonto(monto, 'El monto');
    const texto = motivo.trim();
    if (!texto) throw new DomainError('validacion', 'Escribe el motivo del movimiento');
    const caja = await this.abierta();
    if (tipo === 'SALIDA') validarSalida(monto, this.vista(caja).efectivoEsperado);
    await this.prisma.movimientoCaja.create({ data: { cajaId: caja.id, tipo, monto, motivo: texto, usuarioId } });
    return this.vista(await this.abierta());
  }

  /** Cierra la caja con el efectivo contado. Guarda el esperado de ese momento para que el arqueo no cambie después. */
  async cerrar(efectivoContado: number, notas: string | undefined, usuarioId: string) {
    validarMonto(efectivoContado, 'El efectivo contado', { permitirCero: true });
    const caja = await this.abierta();
    const { efectivoEsperado } = this.vista(caja);
    const { count } = await this.prisma.caja.updateMany({
      where: { id: caja.id, cerradaEn: null },
      data: { cerradaEn: new Date(), cerradaPorId: usuarioId, efectivoContado, efectivoEsperado, notasCierre: notas?.trim() || null },
    });
    if (count === 0) throw new DomainError('conflicto', 'Otra persona ya cerró la caja. Actualiza la pantalla');
    return this.detalle(caja.id);
  }

  /** Las últimas cajas cerradas, de la más reciente a la más antigua */
  async historial() {
    const cajas = await this.prisma.caja.findMany({ where: { cerradaEn: { not: null } }, orderBy: { cerradaEn: 'desc' }, take: MAX_HISTORIAL, select: DETALLE });
    return cajas.map((c) => {
      const { movimientos, pagos, ...resumen } = this.vista(c);
      return { ...resumen, movimientos: movimientos.length, cobros: pagos.length };
    });
  }

  async detalle(id: string) {
    const caja = await this.prisma.caja.findUnique({ where: { id }, select: DETALLE });
    if (!caja) throw new DomainError('no_encontrado', 'La caja no existe');
    return this.vista(caja);
  }

  private async abierta() {
    const caja = await this.prisma.caja.findFirst({ where: { cerradaEn: null }, select: DETALLE });
    if (!caja) throw new DomainError('conflicto', 'No hay una caja abierta');
    return caja;
  }

  private vista(caja: CajaDetalle) {
    const arqueo = calcularArqueo(
      { base: caja.base, pagos: caja.pagos.map((p) => ({ metodo: p.metodo as MetodoPago, monto: p.monto })), movimientos: caja.movimientos },
      caja.efectivoContado,
    );
    // Una caja cerrada muestra el esperado que se guardó al cerrarla
    const efectivoEsperado = caja.efectivoEsperado ?? arqueo.efectivoEsperado;
    return {
      id: caja.id,
      abiertaEn: caja.abiertaEn,
      abiertaPor: caja.abiertaPor,
      cerradaEn: caja.cerradaEn,
      cerradaPor: caja.cerradaPor,
      notasCierre: caja.notasCierre,
      ...arqueo,
      efectivoEsperado,
      diferencia: caja.efectivoContado === null ? null : caja.efectivoContado - efectivoEsperado,
      movimientos: caja.movimientos,
      pagos: caja.pagos.map(({ pedido, actualizadoEn, ...p }) => ({ ...p, numeroPedido: pedido.numero, cobradoEn: actualizadoEn })),
    };
  }
}
