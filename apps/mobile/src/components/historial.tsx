import { Text, View } from 'react-native';
import { pesos } from '@/lib/formato';
import { Pedido } from '@/lib/tipos';
import { TarjetaPedido } from './tarjeta-pedido';
import { COLOR, Vacio } from './ui';

/** Pedidos pagados y cancelados hoy, del último al primero, con lo cobrado arriba */
export function Historial({ pedidos, buscando, vacio }: { pedidos: Pedido[]; buscando: boolean; vacio: string }) {
  if (pedidos.length === 0) return <Vacio>{buscando ? 'Ningún pedido de hoy coincide con la búsqueda.' : vacio}</Vacio>;
  const pagados = pedidos.filter((p) => p.estado === 'PAGADO');
  const cancelados = pedidos.length - pagados.length;
  return (
    <>
      <View style={{ backgroundColor: COLOR.tarjeta, borderRadius: 12, padding: 12, gap: 2 }}>
        <Text style={{ color: COLOR.suave }}>Cobrado hoy</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLOR.texto }}>{pesos(pagados.reduce((suma, p) => suma + p.total, 0))}</Text>
        <Text style={{ color: COLOR.suave }}>
          {pagados.length} {pagados.length === 1 ? 'pagado' : 'pagados'}
          {cancelados > 0 ? ` · ${cancelados} ${cancelados === 1 ? 'cancelado' : 'cancelados'}` : ''}
        </Text>
      </View>
      {pedidos.map((p) => (
        <TarjetaPedido key={p.id} pedido={p} />
      ))}
    </>
  );
}
