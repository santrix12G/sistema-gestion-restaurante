import { EstadoPedido, Pedido } from './tipos';

const formatoPesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const pesos = (valor: number) => formatoPesos.format(valor);

export function hace(fecha: string, ahora = Date.now()) {
  const minutos = Math.floor((ahora - new Date(fecha).getTime()) / 60_000);
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

export const NOMBRE_ESTADO: Record<EstadoPedido, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export function destino(pedido: Pedido) {
  if (pedido.mesa) return `Mesa ${pedido.mesa.numero}`;
  const quien = pedido.cliente?.nombre ?? pedido.cliente?.telefono ?? 'Cliente';
  return pedido.tipo === 'DOMICILIO' ? `Domicilio · ${quien}` : `Recoger · ${quien}`;
}
