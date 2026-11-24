'use client';

import { Bike, Check, ChefHat, CirclePlus, LucideIcon, ReceiptText, Search, ShoppingBag, Store, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAvisos } from '@/components/avisos';
import { DialogoCobro, METODOS } from '@/components/dialogo-cobro';
import { Comanda, TiqueteCliente, useImpresion } from '@/components/impresion';
import { Aviso, Boton, Cargando, Titulo, Vacio } from '@/components/ui';
import { MINUTOS_ATENCION, MINUTOS_DEMORA, TarjetaPedido } from '@/components/tarjeta-pedido';
import { llamar } from '@/lib/api';
import { coincide } from '@/lib/buscar';
import { useCambiarEstado } from '@/lib/cambiar-estado';
import { destino, hora, NOMBRE_ESTADO, pesos } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { plural, t } from '@/lib/i18n';
import { useSesion } from '@/lib/sesion';
import { useTiempoReal } from '@/lib/tiempo-real';
import { EstadoCaja, MetodoCobro, Pedido, UsuarioSesion } from '@/lib/tipos';

type Vista = 'activos' | 'cerrados';
interface Columna {
  clave: string;
  titulo: string;
  icono: LucideIcon;
  filtro: (p: Pedido) => boolean;
  vacia: string;
}

/** Las mismas reglas que valida la API: así solo aparecen los botones que el usuario puede usar. */
function puedeCerrar(p: Pedido, u: UsuarioSesion) {
  if (u.rol === 'ADMIN') return true;
  if (p.tipo === 'DOMICILIO') return u.rol === 'REPARTIDOR' && p.entrega?.repartidor?.id === u.id;
  return u.rol === 'MESERO' && p.creadoPor?.id === u.id;
}

/**
 * La API ya devuelve solo los pedidos de cada uno: el mesero, los que registró; el repartidor, sus domicilios
 * y los disponibles. Aquí solo se reparten en columnas.
 */
function columnasPara(u: UsuarioSesion): Columna[] {
  if (u.rol === 'REPARTIDOR') {
    return [
      { clave: 'mios', titulo: t('Llevando yo'), icono: Bike, filtro: (p) => p.entrega?.repartidor?.id === u.id, vacia: t('No llevas ningún domicilio') },
      { clave: 'libres', titulo: t('Disponibles para llevar'), icono: ShoppingBag, filtro: (p) => !p.entrega?.repartidor, vacia: t('No hay domicilios esperando') },
    ];
  }
  const columnas: Columna[] = [
    { clave: 'mesa', titulo: t('En mesa'), icono: Store, filtro: (p) => p.tipo === 'MESA', vacia: t('Sin pedidos') },
    { clave: 'recoger', titulo: t('Para recoger'), icono: ShoppingBag, filtro: (p) => p.tipo === 'RECOGER', vacia: t('Sin pedidos') },
  ];
  // Los domicilios llegan por el chatbot: el mesero no los registra
  if (u.rol === 'ADMIN') columnas.push({ clave: 'domicilio', titulo: t('Domicilios'), icono: Bike, filtro: (p) => p.tipo === 'DOMICILIO', vacia: t('Sin pedidos') });
  return columnas;
}

export default function Pedidos() {
  const { usuario } = useSesion();
  const [vista, setVista] = useState<Vista>('activos');
  const [consulta, setConsulta] = useState('');
  const ruta = vista === 'activos' ? '/pedidos' : '/pedidos?estados=PAGADO,CANCELADO';
  const { datos: pedidos, error, recargar } = useDatos(() => llamar<Pedido[]>(ruta), 30_000);
  useTiempoReal(recargar);
  const { cambiar, tomar, ocupado, error: errorCambio } = useCambiarEstado(recargar);
  const { avisar, confirmar } = useAvisos();
  // Sin caja abierta no se puede cobrar: se avisa antes de que alguien lo intente
  const { datos: caja, recargar: recargarCaja } = useDatos(() => llamar<EstadoCaja>('/caja/estado'), 60_000);
  useTiempoReal(recargarCaja);
  const [cobrando, setCobrando] = useState<Pedido>();
  const { imprimir } = useImpresion();
  const atiende = usuario?.rol === 'ADMIN' || usuario?.rol === 'MESERO';

  // Al cambiar de pestaña, carga la otra lista sin esperar a la consulta periódica
  useEffect(() => {
    void recargar();
  }, [ruta, recargar]);

  if (!usuario) return null;
  const columnas = columnasPara(usuario);
  const enVista = (pedidos ?? []).filter((p) => (vista === 'activos' ? p.estado === 'ACTIVO' : p.estado !== 'ACTIVO'));
  const hallados = enVista.filter((p) => coincide(p, consulta));
  const buscando = consulta.trim() !== '';

  async function cobrar(p: Pedido, metodo: MetodoCobro, { recibido, imprimir: conTiquete }: { recibido?: number; imprimir: boolean }) {
    setCobrando(undefined);
    const enLinea = p.pagos?.[0]?.estado === 'APROBADO';
    const como = enLinea ? t('en línea') : t('con {metodo}', { metodo: t(METODOS.find((m) => m.metodo === metodo)!.texto).toLowerCase() });
    if (!(await cambiar(p.id, 'PAGADO', metodo))) return void recargarCaja();
    avisar(t('Pedido #{numero} pagado {como}', { numero: p.numero, como }));
    if (conTiquete) await imprimir(<TiqueteCliente pedido={p} cobro={{ metodo: enLinea ? 'ONLINE' : metodo, recibido }} />);
  }

  async function cancelar(p: Pedido) {
    const si = await confirmar({
      titulo: t('¿Cancelar el pedido #{numero}?', { numero: p.numero }),
      detalle: t('El pedido pasa a cancelados y no se puede reabrir.'),
      aceptar: t('Cancelar pedido'),
      peligro: true,
    });
    if (si && (await cambiar(p.id, 'CANCELADO'))) avisar(t('Pedido #{numero} cancelado', { numero: p.numero }));
  }

  function acciones(p: Pedido) {
    if (!usuario) return null;
    const deshabilitado = ocupado === p.id;
    const domicilio = p.tipo === 'DOMICILIO';
    const libre = domicilio && !p.entrega?.repartidor;
    return (
      <>
        {usuario.rol === 'REPARTIDOR' && libre && (
          <Boton className="flex-1" onClick={async () => (await tomar(p.id)) && avisar(t('Llevas el domicilio #{numero}', { numero: p.numero }))} disabled={deshabilitado}>
            <Bike className="size-4" aria-hidden />
            {t('Llevar domicilio')}
          </Boton>
        )}
        <BotonesImpresion pedido={p} conComanda={usuario.rol !== 'REPARTIDOR'} />
        {puedeCerrar(p, usuario) && (
          <>
            <Boton variante="exito" className="flex-1" disabled={deshabilitado} onClick={() => setCobrando(p)}>
              <Check className="size-4" aria-hidden />
              {domicilio ? t('Entregado y pagado') : t('Pagado')}
            </Boton>
            <Boton variante="peligro" disabled={deshabilitado} onClick={() => cancelar(p)}>
              <X className="size-4" aria-hidden />
              {t('Cancelar')}
            </Boton>
          </>
        )}
      </>
    );
  }

  const titulo = t(usuario.rol === 'ADMIN' ? 'Pedidos' : usuario.rol === 'REPARTIDOR' ? 'Mis domicilios' : 'Mis pedidos');
  const pestanaCerrados = t(usuario.rol === 'ADMIN' ? 'Pagados y cancelados hoy' : 'Mi historial de hoy');

  return (
    <>
      <Titulo
        detalle={pedidos && vista === 'activos' ? plural(enVista.length, 'pedido abierto', 'pedidos abiertos') : undefined}
        accion={
          atiende && (
            <Link href="/pedidos/nuevo">
              <Boton>
                <CirclePlus className="size-4" aria-hidden />
                {t('Nuevo pedido')}
              </Boton>
            </Link>
          )
        }
      >
        {titulo}
      </Titulo>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex rounded-xl bg-stone-200/70 p-1 text-sm font-medium">
          {(['activos', 'cerrados'] as Vista[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={`rounded-lg px-4 py-1.5 ${vista === v ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
            >
              {v === 'activos' ? t('Activos') : pestanaCerrados}
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-80">
          <span className="sr-only">{t('Buscar pedidos')}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder={t('Buscar: M3, #12, cliente, producto…')}
            className="w-full rounded-xl border border-stone-300 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
          />
        </label>
        {buscando && pedidos && (
          <span className="text-sm text-stone-500">
            {t('{n} de {total}', { n: hallados.length, total: enVista.length })}
          </span>
        )}
        {vista === 'activos' && <LeyendaEspera />}
      </div>
      <div className="mb-4 space-y-2">
        {caja && !caja.abierta && vista === 'activos' && (
          <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            <strong>{t('La caja está cerrada:')}</strong>
            {usuario.rol === 'ADMIN' ? (
              <>
                {t('no se puede cobrar hasta abrirla.')}
                <Link href="/caja" className="font-semibold underline">
                  {t('Abrir caja')}
                </Link>
              </>
            ) : (
              t('no se puede cobrar hasta que el administrador la abra.')
            )}
          </p>
        )}
        <Aviso>{error}</Aviso>
        <Aviso>{errorCambio}</Aviso>
      </div>
      {!pedidos ? (
        !error && <Cargando />
      ) : vista === 'activos' ? (
        <div className={`grid gap-4 ${columnas.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {columnas.map((c) => {
            const lista = hallados.filter(c.filtro);
            const Icono = c.icono;
            return (
              <section key={c.clave} className="rounded-2xl bg-stone-200/60 p-3">
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-stone-700">
                  <span className="flex items-center gap-2">
                    <Icono className="size-4 text-stone-500" aria-hidden />
                    {c.titulo}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums">{lista.length}</span>
                </h2>
                <div className="space-y-3">
                  {lista.map((p) => <TarjetaPedido key={p.id} pedido={p} acciones={acciones(p)} />)}
                  {lista.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-stone-500">{buscando ? t('Nada coincide con la búsqueda') : c.vacia}</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Cerrados pedidos={hallados} buscando={buscando} />
      )}
      {cobrando && (
        <DialogoCobro
          pedido={cobrando}
          cajaAbierta={caja?.abierta ?? true}
          esAdmin={usuario.rol === 'ADMIN'}
          alCobrar={(metodo, opciones) => cobrar(cobrando, metodo, opciones)}
          alCerrar={() => setCobrando(undefined)}
        />
      )}
    </>
  );
}

function Cerrados({ pedidos, buscando }: { pedidos: Pedido[]; buscando: boolean }) {
  if (pedidos.length === 0) {
    return <Vacio>{buscando ? t('Ningún pedido de hoy coincide con la búsqueda.') : t('Hoy no se ha pagado ni cancelado ningún pedido.')}</Vacio>;
  }
  const pagados = pedidos.filter((p) => p.estado === 'PAGADO');
  const cancelados = pedidos.length - pagados.length;
  return (
    <>
      <p className="mb-3 text-sm text-stone-600">
        <span className="font-semibold text-stone-900">{pesos(pagados.reduce((suma, p) => suma + p.total, 0))}</span> {t('cobrados en')}{' '}
        {plural(pagados.length, 'pedido', 'pedidos')}
        {cancelados > 0 && ` · ${plural(cancelados, 'cancelado', 'cancelados')}`}
      </p>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
        <ul className="divide-y divide-stone-100">
          {pedidos.map((p) => (
            <li key={p.id} className="px-4 py-3">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.estado === 'PAGADO' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {t(NOMBRE_ESTADO[p.estado])}
                  </span>
                  <span className="flex-1 font-medium">
                    #{p.numero} · {destino(p)} <span className="font-normal text-stone-500">· {hora(p.actualizadoEn)}</span>
                  </span>
                  <span className={`font-semibold ${p.estado === 'CANCELADO' ? 'text-stone-400 line-through' : ''}`}>{pesos(p.total)}</span>
                </summary>
                <div className="mt-3 max-w-md">
                  <TarjetaPedido pedido={p} acciones={p.estado === 'PAGADO' && <BotonesImpresion pedido={p} conComanda={false} />} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** Qué significa el color de cada tarjeta */
function LeyendaEspera() {
  const niveles = [
    { clase: 'bg-emerald-500', texto: t('Menos de {n} min', { n: MINUTOS_ATENCION }) },
    { clase: 'bg-amber-500', texto: t('{a} a {b} min', { a: MINUTOS_ATENCION, b: MINUTOS_DEMORA }) },
    { clase: 'bg-red-500', texto: t('Más de {n} min', { n: MINUTOS_DEMORA }) },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 sm:ml-auto" aria-label={t('Tiempo de espera')}>
      {niveles.map((n) => (
        <li key={n.texto} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${n.clase}`} aria-hidden />
          {n.texto}
        </li>
      ))}
    </ul>
  );
}

/** Imprimir la comanda para la cocina o el tiquete para el cliente */
function BotonesImpresion({ pedido, conComanda }: { pedido: Pedido; conComanda: boolean }) {
  const { imprimir } = useImpresion();
  return (
    <div className="flex w-full gap-2">
      {conComanda && (
        <Boton variante="secundario" className="flex-1 py-1.5 text-xs" onClick={() => imprimir(<Comanda pedido={pedido} />)} title={t('Imprimir la comanda para la cocina')}>
          <ChefHat className="size-4" aria-hidden />
          {t('Comanda')}
        </Boton>
      )}
      <Boton variante="secundario" className="flex-1 py-1.5 text-xs" onClick={() => imprimir(<TiqueteCliente pedido={pedido} />)} title={t('Imprimir el tiquete del cliente')}>
        <ReceiptText className="size-4" aria-hidden />
        {t('Tiquete')}
      </Boton>
    </div>
  );
}
