'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Aviso, Boton, Campo, Cargando, Titulo } from '@/components/ui';
import { llamar, mensajeDeError } from '@/lib/api';
import { NOMBRE_TIPO_MESA } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { useSesion } from '@/lib/sesion';
import { Mesa, TipoMesa } from '@/lib/tipos';

const TIPOS: { tipo: TipoMesa; nombre: string; ejemplo: string }[] = [
  { tipo: 'NORMAL', nombre: 'Normal', ejemplo: 'M1' },
  { tipo: 'LARGA', nombre: 'Larga', ejemplo: 'L1' },
  { tipo: 'AFUERA', nombre: 'Afuera', ejemplo: 'AF1' },
];

/** El administrador registra las mesas por tipo y las suspende o borra. */
export default function Mesas() {
  const { usuario } = useSesion();
  const router = useRouter();
  const { datos: mesas, error, recargar } = useDatos(() => llamar<Mesa[]>('/mesas?todas=true'));
  const [errorAccion, setErrorAccion] = useState<string>();
  const [ocupado, setOcupado] = useState<string>();
  const [editando, setEditando] = useState<string>();

  useEffect(() => {
    if (usuario && usuario.rol !== 'ADMIN') router.replace('/pedidos');
  }, [usuario, router]);

  async function actuar(id: string, accion: () => Promise<unknown>) {
    setErrorAccion(undefined);
    setOcupado(id);
    try {
      await accion();
      setEditando(undefined);
    } catch (e) {
      setErrorAccion(mensajeDeError(e));
    }
    await recargar();
    setOcupado(undefined);
  }

  const cambiar = (m: Mesa, datos: Partial<Pick<Mesa, 'numero' | 'capacidad' | 'activa'>>) =>
    actuar(m.id, () => llamar(`/mesas/${m.id}`, { metodo: 'PATCH', cuerpo: datos }));
  const borrar = (m: Mesa) =>
    confirm(`¿Borrar la mesa ${m.codigo}?`) && actuar(m.id, () => llamar(`/mesas/${m.id}`, { metodo: 'DELETE' }));

  return (
    <>
      <Titulo>Mesas</Titulo>
      <div className="mb-4 space-y-2">
        <Aviso>{error}</Aviso>
        <Aviso>{errorAccion}</Aviso>
      </div>
      <NuevaMesa alGuardar={recargar} />
      {!mesas ? (
        !error && <Cargando />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {TIPOS.map(({ tipo }) => {
            const lista = mesas.filter((m) => m.tipo === tipo);
            return (
              <section key={tipo} className="rounded-2xl bg-stone-200/60 p-3">
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-stone-700">
                  {NOMBRE_TIPO_MESA[tipo]}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs">{lista.length}</span>
                </h2>
                <ul className="space-y-2">
                  {lista.map((m) =>
                    editando === m.id ? (
                      <EditarMesa key={m.id} mesa={m} alCancelar={() => setEditando(undefined)} alGuardar={(datos) => cambiar(m, datos)} />
                    ) : (
                      <li key={m.id} className={`flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-stone-200 ${m.activa ? '' : 'opacity-60'}`}>
                        <span className="w-12 text-lg font-bold">{m.codigo}</span>
                        <span className="flex-1 text-sm text-stone-600">
                          {m.capacidad} puestos
                          {!m.activa && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">Suspendida</span>}
                          {m.pedidosActivos > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{m.pedidosActivos} activo(s)</span>}
                        </span>
                        <span className="flex gap-1">
                          <Boton variante="secundario" className="px-2.5 py-1" disabled={ocupado === m.id} onClick={() => setEditando(m.id)}>Editar</Boton>
                          <Boton variante="secundario" className="px-2.5 py-1" disabled={ocupado === m.id} onClick={() => cambiar(m, { activa: !m.activa })}>
                            {m.activa ? 'Suspender' : 'Activar'}
                          </Boton>
                          {!m.tienePedidos && (
                            <Boton variante="peligro" className="px-2.5 py-1" disabled={ocupado === m.id} onClick={() => borrar(m)}>Borrar</Boton>
                          )}
                        </span>
                      </li>
                    ),
                  )}
                  {lista.length === 0 && <p className="px-1 py-4 text-center text-xs text-stone-500">Sin mesas de este tipo</p>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-stone-500">Una mesa que ya tuvo pedidos no se puede borrar: se suspende y deja de aparecer al tomar pedidos.</p>
    </>
  );
}

function NuevaMesa({ alGuardar }: { alGuardar: () => Promise<void> }) {
  const [tipo, setTipo] = useState<TipoMesa>('NORMAL');
  const [numero, setNumero] = useState('');
  const [capacidad, setCapacidad] = useState('4');
  const [error, setError] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setAviso(undefined);
    setEnviando(true);
    try {
      const mesa = await llamar<Mesa>('/mesas', {
        metodo: 'POST',
        cuerpo: { tipo, capacidad: Number(capacidad), ...(numero && { numero: Number(numero) }) },
      });
      setAviso(`Mesa ${mesa.codigo} registrada`);
      setNumero('');
      await alGuardar();
    } catch (e) {
      setError(mensajeDeError(e));
    }
    setEnviando(false);
  }

  return (
    <form onSubmit={guardar} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <h2 className="mb-3 font-semibold">Registrar mesa</h2>
      <div className="flex flex-wrap items-end gap-3">
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-stone-700">Tipo</legend>
          <div className="inline-flex rounded-xl bg-stone-200/70 p-1 text-sm font-medium">
            {TIPOS.map((t) => (
              <button
                key={t.tipo}
                type="button"
                aria-pressed={tipo === t.tipo}
                onClick={() => setTipo(t.tipo)}
                className={`rounded-lg px-3 py-1.5 ${tipo === t.tipo ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
              >
                {t.nombre} <span className="text-xs text-stone-400">{t.ejemplo}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Campo etiqueta="Número" className="w-32" type="number" min={1} max={999} placeholder="Siguiente" value={numero} onChange={(e) => setNumero(e.target.value)} />
        <Campo etiqueta="Puestos" className="w-24" type="number" min={1} max={50} required value={capacidad} onChange={(e) => setCapacidad(e.target.value)} />
        <Boton type="submit" disabled={enviando}>Registrar</Boton>
      </div>
      <div className="mt-3 space-y-2">
        <Aviso>{error}</Aviso>
        {aviso && <p className="text-sm font-medium text-emerald-700">{aviso}</p>}
      </div>
    </form>
  );
}

function EditarMesa({ mesa, alCancelar, alGuardar }: { mesa: Mesa; alCancelar: () => void; alGuardar: (datos: { numero: number; capacidad: number }) => void }) {
  const [numero, setNumero] = useState(String(mesa.numero));
  const [capacidad, setCapacidad] = useState(String(mesa.capacidad));
  return (
    <li className="rounded-xl bg-white p-3 ring-2 ring-marca-500">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          alGuardar({ numero: Number(numero), capacidad: Number(capacidad) });
        }}
      >
        <Campo etiqueta="Número" className="w-24" type="number" min={1} max={999} required value={numero} onChange={(e) => setNumero(e.target.value)} />
        <Campo etiqueta="Puestos" className="w-24" type="number" min={1} max={50} required value={capacidad} onChange={(e) => setCapacidad(e.target.value)} />
        <Boton type="submit" className="px-3 py-1.5">Guardar</Boton>
        <Boton type="button" variante="secundario" className="px-3 py-1.5" onClick={alCancelar}>Cancelar</Boton>
      </form>
    </li>
  );
}
