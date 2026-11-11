import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { Historial } from '@/components/historial';
import { TarjetaPedido } from '@/components/tarjeta-pedido';
import { Aviso, Boton, Buscador, Cargando, COLOR, estilos, Seccion, Segmento, Vacio } from '@/components/ui';
import { coincide } from '@/lib/buscar';
import { avisar, confirmar } from '@/lib/confirmar';
import { destino, pesos } from '@/lib/formato';
import { cerrarPedido, usePedidos } from '@/lib/pedidos';
import { useUsuario } from '@/lib/sesion';
import { EstadoPedido, Pedido } from '@/lib/tipos';

type Vista = 'activos' | 'hoy';
const ACTIVOS: EstadoPedido[] = ['ACTIVO'];
const CERRADOS: EstadoPedido[] = ['PAGADO', 'CANCELADO'];

/**
 * Pedidos de mesa y para recoger. La API le envía al mesero solo los que él registró;
 * al administrador, todos. La pestaña Hoy muestra los que se pagaron o cancelaron hoy.
 */
export default function Pedidos() {
  const usuario = useUsuario();
  const [vista, setVista] = useState<Vista>('activos');
  const [consulta, setConsulta] = useState('');
  const { pedidos, error, recargando, recargar, cargar } = usePedidos(vista === 'activos' ? ACTIVOS : CERRADOS);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Los domicilios los atienden los repartidores. Al cambiar de pestaña, la lista anterior no se mezcla
  const delLocal = (pedidos ?? []).filter((p) => p.tipo !== 'DOMICILIO' && (vista === 'activos') === (p.estado === 'ACTIVO'));
  const hallados = delLocal.filter((p) => coincide(p, consulta));
  const buscando = consulta.trim() !== '';
  const mios = hallados.filter((p) => p.creadoPor?.id === usuario?.id);
  const deOtros = hallados.filter((p) => !mios.includes(p));

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
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={recargar} colors={[COLOR.marca]} />}
    >
      <Segmento
        opciones={[
          { valor: 'activos', texto: 'Activos' },
          { valor: 'hoy', texto: usuario?.rol === 'ADMIN' ? 'Cerrados hoy' : 'Mi historial de hoy' },
        ]}
        valor={vista}
        alCambiar={setVista}
      />
      <Buscador value={consulta} onChangeText={setConsulta} placeholder="Buscar: M3, #12, cliente, producto…" />
      <Aviso>{error}</Aviso>
      {!pedidos ? (
        error ? null : <Cargando texto="Cargando pedidos… (si la API estaba dormida, tarda cerca de un minuto)" />
      ) : vista === 'hoy' ? (
        <Historial pedidos={hallados} buscando={buscando} vacio="Hoy no has cobrado ni cancelado pedidos." />
      ) : (
        <>
          <Seccion titulo="Mis pedidos activos" cantidad={mios.length} />
          {mios.length === 0 ? (
            <Vacio>{buscando ? 'Ninguno de tus pedidos coincide con la búsqueda.' : 'No tienes pedidos activos. Crea uno en la pestaña Nuevo pedido.'}</Vacio>
          ) : null}
          {mios.map((p) => (
            <TarjetaPedido key={p.id} pedido={p}>{acciones(p)}</TarjetaPedido>
          ))}

          {/* Solo le llegan al administrador */}
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
