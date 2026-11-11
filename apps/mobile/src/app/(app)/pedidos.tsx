import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { Aviso, Boton, Cargando, COLOR, estilos, Seccion, Vacio } from '@/components/ui';
import { avisar, confirmar } from '@/lib/confirmar';
import { destino, pesos } from '@/lib/formato';
import { cerrarPedido, usePedidos } from '@/lib/pedidos';
import { useUsuario } from '@/lib/sesion';
import { EstadoPedido, Pedido } from '@/lib/tipos';

const ESTADOS: EstadoPedido[] = ['ACTIVO'];

/**
 * Pedidos activos de mesa y para recoger. El mesero ve los que él registró y los cobra o cancela.
 * El administrador ve además los de los otros meseros y los del chatbot.
 */
export default function Pedidos() {
  const usuario = useUsuario();
  const { pedidos, error, recargando, recargar, cargar } = usePedidos(ESTADOS);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Los domicilios los atienden los repartidores
  const delLocal = (pedidos ?? []).filter((p) => p.tipo !== 'DOMICILIO');
  const mios = delLocal.filter((p) => p.creadoPor?.id === usuario?.id);
  const deOtros = usuario?.rol === 'ADMIN' ? delLocal.filter((p) => !mios.includes(p)) : [];

  async function cerrar(pedido: Pedido, estado: 'PAGADO' | 'CANCELADO') {
    const seguro =
      estado === 'PAGADO'
        ? await confirmar(`Cobrar pedido #${pedido.numero}`, `${destino(pedido)}. ¿Ya pagó ${pesos(pedido.total)}?`, 'Sí, pagado')
        : await confirmar(`Cancelar pedido #${pedido.numero}`, `${destino(pedido)}. Esta acción no se puede deshacer.`, 'Cancelar pedido');
    if (!seguro) return;
    setOcupado(pedido.id);
    const fallo = await cerrarPedido(pedido, estado);
    if (fallo) avisar('No se pudo cambiar el pedido', fallo);
    await cargar();
    setOcupado(null);
  }

  const acciones = (p: Pedido) => (
    <>
      <Boton variante="exito" ocupado={ocupado === p.id} alPulsar={() => cerrar(p, 'PAGADO')} icono={<Ionicons name="cash-outline" size={20} color="#fff" />}>
        Pagado
      </Boton>
      <Boton variante="peligro" ocupado={ocupado === p.id} alPulsar={() => cerrar(p, 'CANCELADO')}>
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
        error ? null : <Cargando texto="Cargando pedidos… (si la API estaba dormida, tarda cerca de un minuto)" />
      ) : (
        <>
          <Seccion titulo="Mis pedidos activos" cantidad={mios.length} />
          {mios.length === 0 ? <Vacio>No tienes pedidos activos. Crea uno en la pestaña Nuevo pedido.</Vacio> : null}
          {mios.map((p) => (
            <TarjetaPedido key={p.id} pedido={p}>{acciones(p)}</TarjetaPedido>
          ))}

          {deOtros.length > 0 ? (
            <>
              <Seccion titulo="De otros meseros y del chatbot" cantidad={deOtros.length} />
              {deOtros.map((p) => (
                <TarjetaPedido key={p.id} pedido={p}>{acciones(p)}</TarjetaPedido>
              ))}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
