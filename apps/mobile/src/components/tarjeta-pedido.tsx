import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { destino, hace, pesos } from '@/lib/formato';
import { Pedido } from '@/lib/tipos';
import { COLOR, estilos, Insignia } from './ui';

/** Un pedido con sus productos. `children` son los botones de acción del rol. */
export function TarjetaPedido({ pedido, children, extra }: { pedido: Pedido; children?: ReactNode; extra?: ReactNode }) {
  return (
    <View style={estilos.tarjeta}>
      <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: COLOR.texto }}>#{pedido.numero}</Text>
        <Insignia estado={pedido.estado} />
      </View>
      <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: COLOR.texto, flexShrink: 1 }}>{destino(pedido)}</Text>
        <Text style={{ color: COLOR.suave, fontSize: 13 }}>{hace(pedido.creadoEn)}</Text>
      </View>

      {extra}

      <View style={{ gap: 4 }}>
        {pedido.detalles.map((d) => (
          <View key={d.id}>
            <Text style={{ color: COLOR.texto, fontSize: 15 }}>
              <Text style={{ fontWeight: '700' }}>{d.cantidad}×</Text> {d.nombreProducto}
            </Text>
            {d.notas ? <Text style={{ color: COLOR.marcaOscuro, fontSize: 13, marginLeft: 22 }}>{d.notas}</Text> : null}
          </View>
        ))}
      </View>
      {pedido.notas ? <Text style={{ color: COLOR.marcaOscuro, fontSize: 14 }}>Nota: {pedido.notas}</Text> : null}

      <View style={[estilos.fila, { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e7e5e4', paddingTop: 8 }]}>
        <Text style={{ color: COLOR.suave }}>Total</Text>
        <Text style={{ fontSize: 17, fontWeight: '800', color: COLOR.texto }}>{pesos(pedido.total)}</Text>
      </View>

      {children ? <View style={[estilos.fila, { flexWrap: 'wrap' }]}>{children}</View> : null}
    </View>
  );
}
