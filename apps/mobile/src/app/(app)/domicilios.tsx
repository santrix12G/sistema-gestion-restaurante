import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Linking, RefreshControl, ScrollView, Text, View, Vibration } from 'react-native';
import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { Aviso, Boton, Cargando, COLOR, estilos, Seccion, Vacio } from '@/components/ui';
import { avisar, confirmar } from '@/lib/confirmar';
import { pesos } from '@/lib/formato';
import { cerrarPedido, tomarDomicilio, usePedidos } from '@/lib/pedidos';
import { useUsuario } from '@/lib/sesion';
import { EstadoPedido, Pedido } from '@/lib/tipos';

const ESTADOS: EstadoPedido[] = ['ACTIVO'];
const CIUDAD = process.env.EXPO_PUBLIC_CIUDAD ?? '';

/** Domicilios activos: los que lleva este repartidor arriba, y abajo los que esperan que alguien los lleve. */
export default function Domicilios() {
  const usuario = useUsuario();
  const { pedidos, error, recargando, recargar, cargar } = usePedidos(ESTADOS);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const domicilios = (pedidos ?? []).filter((p) => p.tipo === 'DOMICILIO');
  const mios = domicilios.filter((p) => p.entrega?.repartidor?.id === usuario?.id);
  const porSalir = domicilios.filter((p) => !p.entrega?.repartidor);
  // El administrador también ve los que llevan otros repartidores
  const deOtros = usuario?.rol === 'ADMIN' ? domicilios.filter((p) => p.entrega?.repartidor && !mios.includes(p)) : [];
  const esRepartidor = usuario?.rol === 'REPARTIDOR';

  // Vibra cuando hay un domicilio nuevo listo para salir (no al abrir la pantalla)
  const antes = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!pedidos) return;
    const ahora = new Set(porSalir.map((p) => p.id));
    if (antes.current && [...ahora].some((id) => !antes.current!.has(id))) Vibration.vibrate([0, 300, 150, 300]);
    antes.current = ahora;
  }, [pedidos]);

  async function actuar(pedido: Pedido, accion: 'TOMAR' | 'PAGADO' | 'CANCELADO') {
    if (accion === 'PAGADO') {
      const seguro = await confirmar(`Entregar pedido #${pedido.numero}`, `¿Ya lo entregaste y cobraste ${pesos(pedido.total)}?`, 'Sí, entregado');
      if (!seguro) return;
    }
    if (accion === 'CANCELADO') {
      const seguro = await confirmar(`Cancelar pedido #${pedido.numero}`, 'El cliente no lo recibió. Esta acción no se puede deshacer.', 'Cancelar pedido');
      if (!seguro) return;
    }
    setOcupado(pedido.id);
    const fallo = accion === 'TOMAR' ? await tomarDomicilio(pedido) : await cerrarPedido(pedido, accion);
    if (fallo) avisar('No se pudo cambiar el domicilio', fallo);
    await cargar();
    setOcupado(null);
  }

  const cerrar = (p: Pedido, texto: string) => (
    <>
      <Boton variante="exito" ocupado={ocupado === p.id} alPulsar={() => actuar(p, 'PAGADO')} icono={<Ionicons name="checkmark-done" size={20} color="#fff" />}>
        {texto}
      </Boton>
      <Boton variante="peligro" ocupado={ocupado === p.id} alPulsar={() => actuar(p, 'CANCELADO')}>
        Cancelar
      </Boton>
    </>
  );

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={recargar} colors={[COLOR.marca]} />}
    >
      <Aviso>{error}</Aviso>
      {!pedidos ? (
        error ? null : <Cargando texto="Cargando domicilios… (si la API estaba dormida, tarda cerca de un minuto)" />
      ) : (
        <>
          <Seccion titulo="Llevando yo" cantidad={mios.length} />
          {mios.length === 0 ? <Vacio>No llevas ningún domicilio. Toma uno de la lista de abajo.</Vacio> : null}
          {mios.map((p) => (
            <TarjetaPedido key={p.id} pedido={p} extra={<Entrega pedido={p} />}>
              {cerrar(p, 'Entregado y pagado')}
            </TarjetaPedido>
          ))}

          <Seccion titulo="Disponibles para llevar" cantidad={porSalir.length} />
          {porSalir.length === 0 ? <Vacio>Cuando entre un domicilio por el chatbot, aparece aquí y el celular vibra.</Vacio> : null}
          {porSalir.map((p) => (
            <TarjetaPedido key={p.id} pedido={p} extra={<Entrega pedido={p} />}>
              {esRepartidor ? (
                <Boton ocupado={ocupado === p.id} alPulsar={() => actuar(p, 'TOMAR')} icono={<Ionicons name="bicycle" size={20} color="#fff" />}>
                  Llevar domicilio
                </Boton>
              ) : (
                cerrar(p, 'Marcar pagado')
              )}
            </TarjetaPedido>
          ))}

          {deOtros.length > 0 ? (
            <>
              <Seccion titulo="Llevan otros repartidores" cantidad={deOtros.length} />
              {deOtros.map((p) => (
                <TarjetaPedido key={p.id} pedido={p} extra={<Entrega pedido={p} />}>
                  {cerrar(p, 'Marcar pagado')}
                </TarjetaPedido>
              ))}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

/** Dirección, cliente y botones para llamar y abrir el mapa */
function Entrega({ pedido }: { pedido: Pedido }) {
  const entrega = pedido.entrega;
  if (!entrega) return null;
  const { barrio, referencia } = entrega.direccion;
  const telefono = pedido.cliente?.telefono;
  const consulta = [entrega.direccionTexto, barrio, CIUDAD].filter(Boolean).join(', ');

  return (
    <View style={{ gap: 8, backgroundColor: COLOR.marcaSuave, borderRadius: 12, padding: 12 }}>
      <View style={[estilos.fila, { alignItems: 'flex-start' }]}>
        <Ionicons name="location" size={18} color={COLOR.marcaOscuro} style={{ marginTop: 2 }} />
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLOR.texto }}>{entrega.direccionTexto}</Text>
          {barrio ? <Text style={{ color: COLOR.texto }}>Barrio {barrio}</Text> : null}
          {referencia ? <Text style={{ color: COLOR.suave }}>{referencia}</Text> : null}
        </View>
      </View>
      {pedido.cliente ? (
        <Text style={{ color: COLOR.texto }}>
          {pedido.cliente.nombre ?? 'Cliente'} · {pedido.cliente.telefono}
        </Text>
      ) : null}
      {entrega.repartidor ? <Text style={{ color: COLOR.suave }}>Lo lleva {entrega.repartidor.nombre}</Text> : null}
      <Text style={{ color: COLOR.marcaOscuro, fontWeight: '700' }}>Cobrar en efectivo: {pesos(pedido.total)}</Text>
      <View style={[estilos.fila, { flexWrap: 'wrap' }]}>
        {telefono ? (
          <Boton variante="secundario" alPulsar={() => void Linking.openURL(`tel:${telefono}`)} icono={<Ionicons name="call-outline" size={18} color={COLOR.texto} />}>
            Llamar
          </Boton>
        ) : null}
        <Boton
          variante="secundario"
          alPulsar={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`)}
          icono={<Ionicons name="map-outline" size={18} color={COLOR.texto} />}
        >
          Mapa
        </Boton>
      </View>
    </View>
  );
}
