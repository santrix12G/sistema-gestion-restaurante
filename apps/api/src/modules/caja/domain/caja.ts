import { DomainError } from '../../../shared/domain-error';

export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'ONLINE';
/** Las formas de pago que elige el personal al cobrar. El pago en línea se registra solo. */
export type MetodoCobro = Exclude<MetodoPago, 'ONLINE'>;
export const METODOS_COBRO: MetodoCobro[] = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];
export const METODOS_PAGO: MetodoPago[] = [...METODOS_COBRO, 'ONLINE'];

export type TipoMovimientoCaja = 'ENTRADA' | 'SALIDA';
export const TIPOS_MOVIMIENTO_CAJA: TipoMovimientoCaja[] = ['ENTRADA', 'SALIDA'];

/** Más de esto no es un monto de caja de un restaurante: seguro es un error al escribirlo */
export const MAX_MONTO_CAJA = 50_000_000;

export interface CajaParaArqueo {
  base: number;
  pagos: { metodo: MetodoPago; monto: number }[];
  movimientos: { tipo: TipoMovimientoCaja; monto: number }[];
}

/**
 * Cuentas de un turno de caja. Solo el efectivo se cuenta en el arqueo: la tarjeta, la transferencia
 * y el pago en línea llegan al banco. El efectivo esperado es la base, más lo cobrado en efectivo,
 * más las entradas y menos las salidas. Con el conteo, la diferencia es positiva si sobra y negativa si falta.
 */
export function calcularArqueo(caja: CajaParaArqueo, efectivoContado?: number | null) {
  const porMetodo = METODOS_PAGO.map((metodo) => {
    const delMetodo = caja.pagos.filter((p) => p.metodo === metodo);
    return { metodo, pagos: delMetodo.length, total: delMetodo.reduce((s, p) => s + p.monto, 0) };
  });
  const sumarMovimientos = (tipo: TipoMovimientoCaja) => caja.movimientos.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.monto, 0);
  const entradas = sumarMovimientos('ENTRADA');
  const salidas = sumarMovimientos('SALIDA');
  const enEfectivo = porMetodo.find((m) => m.metodo === 'EFECTIVO')!.total;
  const efectivoEsperado = caja.base + enEfectivo + entradas - salidas;
  const contado = efectivoContado ?? null;
  return {
    base: caja.base,
    porMetodo,
    vendido: porMetodo.reduce((s, m) => s + m.total, 0),
    pagos: caja.pagos.length,
    entradas,
    salidas,
    efectivoEsperado,
    efectivoContado: contado,
    diferencia: contado === null ? null : contado - efectivoEsperado,
  };
}

/** Un monto de caja es un entero en pesos, sin centavos */
export function validarMonto(monto: number, nombre: string, { permitirCero = false } = {}) {
  if (!Number.isInteger(monto) || monto < 0 || (!permitirCero && monto === 0)) {
    throw new DomainError('validacion', `${nombre} debe ser un valor en pesos ${permitirCero ? 'de cero o más' : 'mayor que cero'}`);
  }
  if (monto > MAX_MONTO_CAJA) throw new DomainError('validacion', `${nombre} es demasiado alto. Revisa que esté bien escrito`);
}

/** Una salida no puede dejar la caja con menos efectivo del que hay */
export function validarSalida(monto: number, efectivoEsperado: number) {
  if (monto > efectivoEsperado) {
    throw new DomainError('conflicto', `En la caja solo debería haber ${efectivoEsperado.toLocaleString('es-CO')} pesos en efectivo`);
  }
}
