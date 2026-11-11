import { EstadoPedido, Pedido } from './tipos';

// Hermes no siempre trae Intl completo: el formato de pesos se arma a mano
export function pesos(valor: number) {
  const miles = Math.round(valor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${miles}`;
}

export function hace(fecha: string, ahora = Date.now()) {
  const minutos = Math.floor((ahora - new Date(fecha).getTime()) / 60_000);
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

export const NOMBRE_ESTADO: Record<EstadoPedido, string> = { ACTIVO: 'Activo', PAGADO: 'Pagado', CANCELADO: 'Cancelado' };

/** Lo que muestra la insignia: un domicilio activo dice si ya salió o espera repartidor */
export function situacion(pedido: Pedido): { texto: string; tono: 'neutro' | 'aviso' | 'info' | 'exito' | 'peligro' } {
  if (pedido.estado === 'PAGADO') return { texto: 'Pagado', tono: 'exito' };
  if (pedido.estado === 'CANCELADO') return { texto: 'Cancelado', tono: 'peligro' };
  if (pedido.tipo === 'DOMICILIO') return pedido.entrega?.repartidor ? { texto: 'En camino', tono: 'info' } : { texto: 'Por salir', tono: 'aviso' };
  return { texto: 'Activo', tono: 'neutro' };
}

export function destino(pedido: Pedido) {
  if (pedido.mesa) return `Mesa ${pedido.mesa.numero}`;
  const quien = pedido.cliente?.nombre ?? pedido.cliente?.telefono ?? 'Cliente';
  return pedido.tipo === 'DOMICILIO' ? `Domicilio · ${quien}` : `Recoger · ${quien}`;
}
