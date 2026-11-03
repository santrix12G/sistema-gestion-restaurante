'use client';

import { FormEvent, useState } from 'react';
import { Aviso, Boton, Campo, Cargando, Titulo } from '@/components/ui';
import { llamar, mensajeDeError } from '@/lib/api';
import { pesos } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { useSesion } from '@/lib/sesion';
import { Categoria, Producto } from '@/lib/tipos';

export default function Menu() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';
  const productos = useDatos(() => llamar<Producto[]>('/catalogo/productos'));
  const categorias = useDatos(() => llamar<Categoria[]>('/catalogo/categorias'));
  const [editando, setEditando] = useState<Producto | 'nuevo' | 'categoria'>();
  const [error, setError] = useState<string>();

  async function cambiarDisponible(p: Producto) {
    setError(undefined);
    try {
      await llamar(`/catalogo/productos/${p.id}/disponibilidad`, { metodo: 'PATCH', cuerpo: { disponible: !p.disponible } });
    } catch (e) {
      setError(mensajeDeError(e));
    }
    await productos.recargar();
  }

  async function terminarEdicion() {
    setEditando(undefined);
    await Promise.all([productos.recargar(), categorias.recargar()]);
  }

  if (!productos.datos || !categorias.datos) {
    return <><Titulo>Menú</Titulo><Aviso>{productos.error ?? categorias.error}</Aviso>{!productos.error && !categorias.error && <Cargando />}</>;
  }

  return (
    <>
      <Titulo
        accion={esAdmin && (
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={() => setEditando('categoria')}>Nueva categoría</Boton>
            <Boton onClick={() => setEditando('nuevo')}>Nuevo producto</Boton>
          </div>
        )}
      >
        Menú
      </Titulo>
      <div className="mb-4"><Aviso>{error}</Aviso></div>

      {editando === 'categoria' && <FormularioCategoria alTerminar={terminarEdicion} />}
      {editando && editando !== 'categoria' && (
        <FormularioProducto
          key={editando === 'nuevo' ? 'nuevo' : editando.id}
          producto={editando === 'nuevo' ? undefined : editando}
          categorias={categorias.datos}
          alTerminar={terminarEdicion}
        />
      )}

      <div className="space-y-6">
        {categorias.datos.map((c) => {
          const lista = productos.datos!.filter((p) => p.categoriaId === c.id);
          return (
            <section key={c.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
              <h2 className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-700">{c.nombre}</h2>
              {lista.length === 0 && <p className="px-4 py-3 text-sm text-stone-500">Sin productos</p>}
              <ul className="divide-y divide-stone-100">
                {lista.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-48 flex-1">
                      <p className="font-medium">{p.nombre}</p>
                      {p.descripcion && <p className="text-sm text-stone-500">{p.descripcion}</p>}
                    </div>
                    <span className="w-24 text-right font-semibold">{pesos(p.precio)}</span>
                    <label className="flex w-32 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={p.disponible} onChange={() => cambiarDisponible(p)} className="h-4 w-4 accent-marca-600" />
                      {p.disponible ? 'Disponible' : 'Agotado'}
                    </label>
                    {esAdmin && <Boton variante="secundario" onClick={() => setEditando(p)}>Editar</Boton>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

function FormularioProducto({ producto, categorias, alTerminar }: { producto?: Producto; categorias: Categoria[]; alTerminar: () => void }) {
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const datos = {
      categoriaId: String(f.get('categoriaId')),
      nombre: String(f.get('nombre')).trim(),
      descripcion: String(f.get('descripcion')).trim() || undefined,
      precio: Number(f.get('precio')),
      sinonimos: String(f.get('sinonimos')).split(',').map((s) => s.trim()).filter(Boolean),
    };
    setEnviando(true);
    setError(undefined);
    try {
      if (producto) await llamar(`/catalogo/productos/${producto.id}`, { metodo: 'PATCH', cuerpo: datos });
      else await llamar('/catalogo/productos', { metodo: 'POST', cuerpo: datos });
      alTerminar();
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mb-6 space-y-4 rounded-2xl bg-white p-5 ring-1 ring-marca-500">
      <h2 className="font-semibold">{producto ? `Editar ${producto.nombre}` : 'Nuevo producto'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" name="nombre" defaultValue={producto?.nombre} required minLength={2} maxLength={80} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">Categoría</span>
          <select name="categoriaId" defaultValue={producto?.categoriaId} required className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <Campo etiqueta="Precio (pesos)" name="precio" type="number" min={0} step={100} defaultValue={producto?.precio} required />
        <Campo etiqueta="Descripción" name="descripcion" defaultValue={producto?.descripcion ?? ''} maxLength={300} />
        <Campo
          className="sm:col-span-2"
          etiqueta="Sinónimos para el chatbot, separados por coma"
          name="sinonimos"
          placeholder="burger, hamburguesa sencilla"
          defaultValue={producto?.sinonimos.join(', ')}
        />
      </div>
      <Aviso>{error}</Aviso>
      <div className="flex gap-2">
        <Boton type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</Boton>
        <Boton type="button" variante="secundario" onClick={alTerminar}>Cancelar</Boton>
      </div>
    </form>
  );
}

function FormularioCategoria({ alTerminar }: { alTerminar: () => void }) {
  const [error, setError] = useState<string>();

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await llamar('/catalogo/categorias', { metodo: 'POST', cuerpo: { nombre: String(f.get('nombre')).trim(), orden: Number(f.get('orden') || 0) } });
      alTerminar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  return (
    <form onSubmit={guardar} className="mb-6 space-y-4 rounded-2xl bg-white p-5 ring-1 ring-marca-500">
      <h2 className="font-semibold">Nueva categoría</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" name="nombre" required minLength={2} maxLength={60} />
        <Campo etiqueta="Orden en el menú" name="orden" type="number" min={0} defaultValue={0} />
      </div>
      <Aviso>{error}</Aviso>
      <div className="flex gap-2">
        <Boton type="submit">Guardar</Boton>
        <Boton type="button" variante="secundario" onClick={alTerminar}>Cancelar</Boton>
      </div>
    </form>
  );
}
