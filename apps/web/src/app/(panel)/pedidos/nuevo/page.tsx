'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Aviso, Boton, Campo, Cargando, Titulo } from '@/components/ui';
import { llamar, mensajeDeError } from '@/lib/api';
import { pesos } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { Mesa, Producto } from '@/lib/tipos';

interface Linea {
  cantidad: number;
  notas: string;
}

// randomUUID solo existe en HTTPS o localhost; una tablet que entre por la IP local usa la alternativa
const nuevaClave = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function NuevoPedido() {
  const router = useRouter();
  const { datos: productos, error: errorProductos } = useDatos(() => llamar<Producto[]>('/catalogo/productos'));
  const { datos: mesas, error: errorMesas } = useDatos(() => llamar<Mesa[]>('/mesas'));

  const [tipo, setTipo] = useState<'MESA' | 'RECOGER'>('MESA');
  const [mesaId, setMesaId] = useState<string>();
  const [cliente, setCliente] = useState({ telefono: '', nombre: '' });
  const [lineas, setLineas] = useState<Record<string, Linea>>({});
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  // Una clave por pedido: si la red falla y se reintenta, la API no lo duplica
  const [clave, setClave] = useState(nuevaClave);

  const porCategoria = useMemo(() => {
    const grupos = new Map<string, Producto[]>();
    for (const p of productos ?? []) grupos.set(p.categoria.nombre, [...(grupos.get(p.categoria.nombre) ?? []), p]);
    return [...grupos];
  }, [productos]);

  const elegidos = (productos ?? []).filter((p) => lineas[p.id]?.cantidad > 0);
  const total = elegidos.reduce((suma, p) => suma + p.precio * lineas[p.id].cantidad, 0);

  function cambiarCantidad(id: string, delta: number) {
    setLineas((actual) => {
      const cantidad = Math.max(0, Math.min(50, (actual[id]?.cantidad ?? 0) + delta));
      return { ...actual, [id]: { cantidad, notas: actual[id]?.notas ?? '' } };
    });
  }

  async function enviar() {
    setError(undefined);
    if (tipo === 'MESA' && !mesaId) return setError('Elige la mesa');
    if (tipo === 'RECOGER' && !cliente.telefono.trim()) return setError('Escribe el teléfono del cliente');
    if (elegidos.length === 0) return setError('Agrega al menos un producto');

    setEnviando(true);
    try {
      await llamar('/pedidos', {
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
      router.push('/pedidos');
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  }

  if (!productos || !mesas) {
    return <><Titulo>Nuevo pedido</Titulo><Aviso>{errorProductos ?? errorMesas}</Aviso>{!errorProductos && !errorMesas && <Cargando />}</>;
  }

  return (
    <>
      <Titulo>Nuevo pedido</Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <div className="mb-4 inline-flex rounded-lg bg-stone-100 p-1">
              {(['MESA', 'RECOGER'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`rounded-md px-4 py-1.5 text-sm font-semibold ${tipo === t ? 'bg-white shadow-sm' : 'text-stone-500'}`}
                >
                  {t === 'MESA' ? 'En mesa' : 'Para recoger'}
                </button>
              ))}
            </div>
            {tipo === 'MESA' ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-10">
                {mesas.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMesaId(m.id)}
                    aria-label={`Mesa ${m.numero}, ${m.pedidosActivos ? `${m.pedidosActivos} pedido(s) activo(s)` : 'libre'}`}
                    title={m.pedidosActivos ? `${m.pedidosActivos} pedido(s) activo(s)` : 'Libre'}
                    className={`relative rounded-lg py-3 text-sm font-bold ring-1 ${mesaId === m.id ? 'bg-marca-600 text-white ring-marca-600' : 'bg-white ring-stone-300 hover:bg-stone-50'}`}
                  >
                    {m.numero}
                    {m.pedidosActivos > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-500" />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Teléfono" inputMode="tel" placeholder="300 123 4567" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} />
                <Campo etiqueta="Nombre (opcional)" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} />
              </div>
            )}
          </section>

          {porCategoria.map(([categoria, lista]) => (
            <section key={categoria}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{categoria}</h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {lista.map((p) => {
                  const cantidad = lineas[p.id]?.cantidad ?? 0;
                  return (
                    <div key={p.id} className={`rounded-xl bg-white p-3 ring-1 ${cantidad ? 'ring-marca-500' : 'ring-stone-200'} ${p.disponible ? '' : 'opacity-50'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{p.nombre}</p>
                          <p className="text-sm text-stone-500">{p.disponible ? pesos(p.precio) : 'Agotado'}</p>
                        </div>
                        {p.disponible && (
                          <div className="flex items-center gap-2">
                            {cantidad > 0 && <button aria-label={`Quitar ${p.nombre}`} onClick={() => cambiarCantidad(p.id, -1)} className="h-8 w-8 rounded-full bg-stone-100 font-bold">−</button>}
                            {cantidad > 0 && <span className="w-5 text-center font-semibold">{cantidad}</span>}
                            <button aria-label={`Agregar ${p.nombre}`} onClick={() => cambiarCantidad(p.id, 1)} className="h-8 w-8 rounded-full bg-marca-600 font-bold text-white">+</button>
                          </div>
                        )}
                      </div>
                      {cantidad > 0 && (
                        <input
                          placeholder="Nota: sin cebolla, término medio…"
                          value={lineas[p.id].notas}
                          maxLength={200}
                          onChange={(e) => setLineas({ ...lineas, [p.id]: { ...lineas[p.id], notas: e.target.value } })}
                          className="mt-2 w-full rounded-md border border-stone-200 px-2 py-1 text-sm outline-none focus:border-marca-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="h-fit space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200 lg:sticky lg:top-20">
          <h2 className="font-semibold">Resumen</h2>
          {elegidos.length === 0 ? (
            <p className="text-sm text-stone-500">Aún no hay productos</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {elegidos.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span>{lineas[p.id].cantidad}× {p.nombre}</span>
                  <span>{pesos(p.precio * lineas[p.id].cantidad)}</span>
                </li>
              ))}
            </ul>
          )}
          <Campo etiqueta="Notas del pedido" value={notas} maxLength={300} onChange={(e) => setNotas(e.target.value)} />
          <div className="flex justify-between border-t border-stone-200 pt-3 text-lg font-bold">
            <span>Total</span>
            <span>{pesos(total)}</span>
          </div>
          <Aviso>{error}</Aviso>
          <Boton onClick={enviar} disabled={enviando} className="w-full py-3">{enviando ? 'Enviando…' : 'Registrar pedido'}</Boton>
        </aside>
      </div>
    </>
  );
}
