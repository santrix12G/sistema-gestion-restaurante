'use client';

import { Minus, Plus, Search, ShoppingBag, Store, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useAvisos } from '@/components/avisos';
import { Aviso, Boton, Campo, Cargando, Titulo, Vacio } from '@/components/ui';
import { llamar, mensajeDeError } from '@/lib/api';
import { normalizar } from '@/lib/buscar';
import { NOMBRE_TIPO_MESA, pesos } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { Mesa, Producto, TipoMesa } from '@/lib/tipos';

const TIPOS_MESA: TipoMesa[] = ['NORMAL', 'LARGA', 'AFUERA'];
const MAX_CANTIDAD = 50;
const TODAS = '';

interface Linea {
  cantidad: number;
  notas: string;
}

// randomUUID solo existe en HTTPS o localhost; una tablet que entre por la IP local usa la alternativa
const nuevaClave = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function NuevoPedido() {
  const router = useRouter();
  const { avisar } = useAvisos();
  const { datos: productos, error: errorProductos } = useDatos(() => llamar<Producto[]>('/catalogo/productos'));
  const { datos: mesas, error: errorMesas } = useDatos(() => llamar<Mesa[]>('/mesas'));

  const [tipo, setTipo] = useState<'MESA' | 'RECOGER'>('MESA');
  const [mesaId, setMesaId] = useState<string>();
  const [cliente, setCliente] = useState({ telefono: '', nombre: '' });
  const [lineas, setLineas] = useState<Record<string, Linea>>({});
  const [notas, setNotas] = useState('');
  const [consulta, setConsulta] = useState('');
  const [categoria, setCategoria] = useState(TODAS);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  // Una clave por pedido: si la red falla y se reintenta, la API no lo duplica
  const [clave, setClave] = useState(nuevaClave);

  const categorias = useMemo(() => [...new Set((productos ?? []).map((p) => p.categoria.nombre))], [productos]);

  // Los productos que se ven: por categoría y por lo que se escribe en el buscador, sin importar tildes
  const porCategoria = useMemo(() => {
    const texto = normalizar(consulta.trim());
    const grupos = new Map<string, Producto[]>();
    for (const p of productos ?? []) {
      if (categoria !== TODAS && p.categoria.nombre !== categoria) continue;
      if (texto && !normalizar(p.nombre).includes(texto)) continue;
      grupos.set(p.categoria.nombre, [...(grupos.get(p.categoria.nombre) ?? []), p]);
    }
    return [...grupos];
  }, [productos, consulta, categoria]);

  const elegidos = (productos ?? []).filter((p) => lineas[p.id]?.cantidad > 0);
  const unidades = elegidos.reduce((suma, p) => suma + lineas[p.id].cantidad, 0);
  const total = elegidos.reduce((suma, p) => suma + p.precio * lineas[p.id].cantidad, 0);
  const mesaElegida = mesas?.find((m) => m.id === mesaId);

  function cambiarCantidad(id: string, delta: number) {
    setLineas((actual) => {
      const cantidad = Math.max(0, Math.min(MAX_CANTIDAD, (actual[id]?.cantidad ?? 0) + delta));
      return { ...actual, [id]: { cantidad, notas: actual[id]?.notas ?? '' } };
    });
  }

  const quitar = (id: string) => setLineas((actual) => ({ ...actual, [id]: { cantidad: 0, notas: '' } }));

  async function enviar() {
    setError(undefined);
    if (tipo === 'MESA' && !mesaId) return setError('Elige la mesa');
    if (tipo === 'RECOGER' && !cliente.telefono.trim()) return setError('Escribe el teléfono del cliente');
    if (elegidos.length === 0) return setError('Agrega al menos un producto');

    setEnviando(true);
    try {
      const pedido = await llamar<{ numero: number }>('/pedidos', {
        metodo: 'POST',
        encabezados: { 'Idempotency-Key': clave },
        cuerpo: {
          tipo,
          ...(tipo === 'MESA' ? { mesaId } : { cliente: { telefono: cliente.telefono, nombre: cliente.nombre || undefined } }),
          items: elegidos.map((p) => ({ productoId: p.id, cantidad: lineas[p.id].cantidad, notas: lineas[p.id].notas || undefined })),
          notas: notas || undefined,
        },
      });
      setClave(nuevaClave());
      avisar(`Pedido #${pedido.numero} registrado`);
      router.push('/pedidos');
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  }

  if (!productos || !mesas) {
    return <><Titulo>Nuevo pedido</Titulo><Aviso>{errorProductos ?? errorMesas}</Aviso>{!errorProductos && !errorMesas && <Cargando />}</>;
  }

  const destinoElegido = tipo === 'MESA' ? (mesaElegida ? `Mesa ${mesaElegida.codigo}` : 'Sin mesa') : 'Para recoger';

  return (
    <>
      <Titulo detalle="Elige dónde va el pedido, agrega los productos y regístralo.">Nuevo pedido</Titulo>
      {/* En el celular, el espacio de abajo deja ver todo por encima de la barra del total */}
      <div className="grid gap-6 pb-24 lg:grid-cols-[1fr_360px] lg:pb-0">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <Paso numero={1}>¿Dónde va el pedido?</Paso>
            <div className="mb-4 inline-flex rounded-lg bg-stone-100 p-1">
              {(['MESA', 'RECOGER'] as const).map((t) => {
                const Icono = t === 'MESA' ? Store : ShoppingBag;
                return (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    aria-pressed={tipo === t}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ${tipo === t ? 'bg-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                  >
                    <Icono className="size-4" aria-hidden />
                    {t === 'MESA' ? 'En mesa' : 'Para recoger'}
                  </button>
                );
              })}
            </div>
            {tipo === 'MESA' ? (
              <div className="space-y-3">
                {TIPOS_MESA.map((t) => {
                  const delTipo = mesas.filter((m) => m.tipo === t);
                  if (delTipo.length === 0) return null;
                  return (
                    <div key={t}>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">{NOMBRE_TIPO_MESA[t]}</p>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10">
                        {delTipo.map((m) => {
                          const ocupada = m.pedidosActivos > 0;
                          const elegida = mesaId === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => setMesaId(m.id)}
                              aria-pressed={elegida}
                              aria-label={`Mesa ${m.codigo}, ${ocupada ? `ocupada con ${m.pedidosActivos} pedido(s)` : 'libre'}`}
                              title={`${m.capacidad} puestos · ${ocupada ? `${m.pedidosActivos} pedido(s) abierto(s)` : 'libre'}`}
                              className={`flex flex-col items-center rounded-lg py-2.5 text-sm font-bold ring-1 transition-colors ${
                                elegida
                                  ? 'bg-marca-600 text-white ring-marca-600'
                                  : ocupada
                                    ? 'bg-amber-50 text-amber-900 ring-amber-300 hover:bg-amber-100'
                                    : 'bg-white ring-stone-300 hover:bg-stone-50'
                              }`}
                            >
                              {m.codigo}
                              <span className={`text-[10px] font-medium ${elegida ? 'text-white/80' : ocupada ? 'text-amber-700' : 'text-stone-400'}`}>
                                {ocupada ? 'Ocupada' : 'Libre'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Teléfono" inputMode="tel" placeholder="300 123 4567" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} />
                <Campo etiqueta="Nombre (opcional)" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} />
              </div>
            )}
          </section>

          <section>
            <Paso numero={2}>Agrega los productos</Paso>
            <div className="mb-4 space-y-3">
              <label className="relative block sm:max-w-sm">
                <span className="sr-only">Buscar productos</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
                <input
                  type="search"
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  placeholder="Buscar producto…"
                  className="w-full rounded-xl border border-stone-300 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
                />
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Categorías">
                {[TODAS, ...categorias].map((c) => (
                  <button
                    key={c || 'todas'}
                    onClick={() => setCategoria(c)}
                    aria-pressed={categoria === c}
                    className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${
                      categoria === c ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-600 ring-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    {c || 'Todas'}
                  </button>
                ))}
              </div>
            </div>

            {porCategoria.length === 0 && <Vacio>Ningún producto coincide con la búsqueda.</Vacio>}
            <div className="space-y-6">
              {porCategoria.map(([nombre, lista]) => (
                <div key={nombre}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{nombre}</h3>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {lista.map((p) => (
                      <TarjetaProducto
                        key={p.id}
                        producto={p}
                        linea={lineas[p.id]}
                        cambiar={(delta) => cambiarCantidad(p.id, delta)}
                        anotar={(texto) => setLineas({ ...lineas, [p.id]: { ...lineas[p.id], notas: texto } })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside id="resumen" className="h-fit space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200 lg:sticky lg:top-8">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Resumen</h2>
            <span className="text-sm text-stone-500">{destinoElegido}</span>
          </div>
          {elegidos.length === 0 ? (
            <p className="rounded-lg bg-stone-50 px-3 py-6 text-center text-sm text-stone-500">Aún no hay productos</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {elegidos.map((p) => (
                <li key={p.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.nombre}</p>
                    {lineas[p.id].notas && <p className="truncate text-xs text-marca-700">{lineas[p.id].notas}</p>}
                  </div>
                  <Contador cantidad={lineas[p.id].cantidad} nombre={p.nombre} cambiar={(d) => cambiarCantidad(p.id, d)} pequeno />
                  <span className="w-20 text-right tabular-nums">{pesos(p.precio * lineas[p.id].cantidad)}</span>
                  <button onClick={() => quitar(p.id)} className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Quitar ${p.nombre} del pedido`}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Campo etiqueta="Notas del pedido" placeholder="Ej.: traer los platos juntos" value={notas} maxLength={300} onChange={(e) => setNotas(e.target.value)} />
          <div className="flex items-baseline justify-between border-t border-stone-200 pt-3">
            <span className="text-sm text-stone-500">{unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
            <span className="text-2xl font-bold tabular-nums">{pesos(total)}</span>
          </div>
          <Aviso>{error}</Aviso>
          <Boton onClick={enviar} disabled={enviando} className="w-full py-3 text-base">{enviando ? 'Registrando…' : 'Registrar pedido'}</Boton>
        </aside>
      </div>

      {/* En el celular el resumen queda abajo de la lista: esta barra muestra el total y lleva a él */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-stone-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-stone-500">{destinoElegido} · {unidades} {unidades === 1 ? 'producto' : 'productos'}</p>
          <p className="text-lg font-bold tabular-nums">{pesos(total)}</p>
        </div>
        <a href="#resumen" className="rounded-lg bg-marca-600 px-4 py-2.5 text-sm font-semibold text-white">Ver pedido</a>
      </div>
    </>
  );
}

function Paso({ numero, children }: { numero: number; children: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-semibold">
      <span className="grid size-6 place-items-center rounded-full bg-marca-600 text-xs font-bold text-white">{numero}</span>
      {children}
    </h2>
  );
}

function Contador({ cantidad, nombre, cambiar, pequeno = false }: { cantidad: number; nombre: string; cambiar: (delta: number) => void; pequeno?: boolean }) {
  const tamano = pequeno ? 'size-7' : 'size-9';
  return (
    <div className="flex items-center gap-1.5">
      <button aria-label={`Una ${nombre} menos`} onClick={() => cambiar(-1)} className={`grid ${tamano} place-items-center rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200`}>
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">{cantidad}</span>
      <button
        aria-label={`Una ${nombre} más`}
        onClick={() => cambiar(1)}
        disabled={cantidad >= MAX_CANTIDAD}
        className={`grid ${tamano} place-items-center rounded-full bg-marca-600 text-white hover:bg-marca-700 disabled:bg-stone-300`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function TarjetaProducto({ producto: p, linea, cambiar, anotar }: { producto: Producto; linea?: Linea; cambiar: (delta: number) => void; anotar: (texto: string) => void }) {
  const cantidad = linea?.cantidad ?? 0;
  if (!p.disponible) {
    return (
      <div className="rounded-xl bg-white p-3 opacity-60 ring-1 ring-stone-200">
        <p className="font-medium">{p.nombre}</p>
        <p className="text-sm font-semibold text-red-600">Agotado</p>
      </div>
    );
  }
  return (
    <div className={`rounded-xl bg-white p-3 ring-1 transition-shadow ${cantidad ? 'ring-2 ring-marca-500' : 'ring-stone-200 hover:shadow-sm'}`}>
      <div className="flex items-center justify-between gap-2">
        {/* Toda la parte del nombre agrega una unidad: es lo más rápido con el dedo */}
        <button onClick={() => cambiar(1)} className="min-w-0 flex-1 text-left" aria-label={`Agregar ${p.nombre}`}>
          <p className="line-clamp-2 font-medium leading-snug">{p.nombre}</p>
          <p className="text-sm text-stone-500 tabular-nums">{pesos(p.precio)}</p>
        </button>
        {cantidad > 0 ? (
          <Contador cantidad={cantidad} nombre={p.nombre} cambiar={cambiar} />
        ) : (
          <button aria-label={`Agregar ${p.nombre}`} onClick={() => cambiar(1)} className="grid size-9 place-items-center rounded-full bg-marca-600 text-white hover:bg-marca-700">
            <Plus className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {cantidad > 0 && (
        <input
          placeholder="Nota: sin cebolla, término medio…"
          value={linea?.notas ?? ''}
          maxLength={200}
          onChange={(e) => anotar(e.target.value)}
          className="mt-2 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm outline-none focus:border-marca-500"
        />
      )}
    </div>
  );
}
