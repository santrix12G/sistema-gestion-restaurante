import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Vibration } from 'react-native';
import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { Aviso, Boton, Cargando, COLOR, estilos, Seccion, Vacio } from '@/components/ui';
import { avisar, confirmar } from '@/lib/confirmar';
import { destino } from '@/lib/formato';
import { cambiarEstado, usePedidos } from '@/lib/pedidos';
import { EstadoPedido, Pedido } from '@/lib/tipos';

const ESTADOS: EstadoPedido[] = ['CONFIRMADO', 'EN_PREPARACION', 'LISTO'];

/** Pedidos de mesa y para recoger: los listos para entregar arriba, luego los que siguen en cocina. */
export default function Pedidos() {
  const { pedidos, error, recargando, recargar, cargar } = usePedidos(ESTADOS);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Los domicilios los atienden los repartidores
  const delLocal = (pedidos ?? []).filter((p) => p.tipo !== 'DOMICILIO');
  const listos = delLocal.filter((p) => p.estado === 'LISTO');
  const enCocina = delLocal.filter((p) => p.estado !== 'LISTO');

  // Vibra cuando cocina termina un pedido nuevo (no al abrir la pantalla)
  const listosAntes = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!pedidos) return;
    const ahora = new Set(listos.map((p) => p.id));
    if (listosAntes.current && [...ahora].some((id) => !listosAntes.current!.has(id))) Vibration.vibrate([0, 300, 150, 300]);
    listosAntes.current = ahora;
  }, [pedidos]);

  async function cambiar(pedido: Pedido, estado: EstadoPedido) {
    if (estado === 'CANCELADO') {
      const seguro = await confirmar(`Cancelar pedido #${pedido.numero}`, `${destino(pedido)}. Esta acción no se puede deshacer.`, 'Cancelar pedido');
      if (!seguro) return;
    }
    setOcupado(pedido.id);
    const fallo = await cambiarEstado(pedido, estado);
    if (fallo) avisar('No se pudo cambiar el pedido', fallo);
    await cargar();
    setOcupado(null);
  }

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={recargar} colors={[COLOR.marca]} />}
    >
      <Aviso>{error}</Aviso>
      {!pedidos ? (
        error ? null : <Cargando texto="Cargando pedidos… (si la API estaba dormida, tarda cerca de un minuto)" />
      ) : delLocal.length === 0 ? (
        <Vacio>No hay pedidos de mesa ni para recoger. Crea uno en la pestaña Nuevo pedido.</Vacio>
      ) : (
        <>
          <Seccion titulo="Listos para entregar" cantidad={listos.length} />
          {listos.length === 0 ? <Vacio>Cuando cocina termine un pedido, aparece aquí y el celular vibra.</Vacio> : null}
          {listos.map((p) => (
            <TarjetaPedido key={p.id} pedido={p}>
              <Boton
                variante="exito"
                ocupado={ocupado === p.id}
                alPulsar={() => cambiar(p, 'ENTREGADO')}
                icono={<Ionicons name="checkmark-done" size={20} color="#fff" />}
              >
                Entregado
              </Boton>
            </TarjetaPedido>
          ))}

          <Seccion titulo="En cocina" cantidad={enCocina.length} />
          {enCocina.map((p) => (
            <TarjetaPedido key={p.id} pedido={p}>
              {/* Solo se puede cancelar antes de que cocina empiece a prepararlo */}
              {p.estado === 'CONFIRMADO' ? (
                <Boton variante="peligro" ocupado={ocupado === p.id} alPulsar={() => cambiar(p, 'CANCELADO')}>
                  Cancelar
                </Boton>
              ) : null}
            </TarjetaPedido>
          ))}
        </>
      )}
    </ScrollView>
  );
}
