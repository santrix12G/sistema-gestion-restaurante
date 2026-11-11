'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Aviso, Boton, Campo, Cargando, Titulo } from '@/components/ui';
import { llamar, mensajeDeError } from '@/lib/api';
import { useDatos } from '@/lib/hooks';
import { useSesion } from '@/lib/sesion';
import { Cuenta } from '@/lib/tipos';

type RolPersonal = Cuenta['rol'];
const ROLES: { rol: RolPersonal; nombre: string; plural: string }[] = [
  { rol: 'MESERO', nombre: 'Mesero', plural: 'Meseros' },
  { rol: 'REPARTIDOR', nombre: 'Repartidor', plural: 'Repartidores' },
];
const AYUDA_CONTRASENA = 'Al menos 8 caracteres, con letras y números';

/** El administrador registra, edita, suspende y borra las cuentas de meseros y repartidores. */
export default function Personal() {
  const { usuario } = useSesion();
  const router = useRouter();
  const { datos: cuentas, error, recargar } = useDatos(() => llamar<Cuenta[]>('/personal'));
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

  const cambiar = (c: Cuenta, datos: Record<string, unknown>) => actuar(c.id, () => llamar(`/personal/${c.id}`, { metodo: 'PATCH', cuerpo: datos }));
  const suspender = (c: Cuenta) =>
    c.activo ? confirm(`¿Suspender a ${c.nombre}? No podrá entrar y su sesión abierta se cerrará.`) && cambiar(c, { activo: false }) : cambiar(c, { activo: true });
  const borrar = (c: Cuenta) =>
    confirm(`¿Borrar la cuenta de ${c.nombre}? Esta acción no se puede deshacer.`) && actuar(c.id, () => llamar(`/personal/${c.id}`, { metodo: 'DELETE' }));

  return (
    <>
      <Titulo>Personal</Titulo>
      <div className="mb-4 space-y-2">
        <Aviso>{error}</Aviso>
        <Aviso>{errorAccion}</Aviso>
      </div>
      <NuevaCuenta alGuardar={recargar} />
      {!cuentas ? (
        !error && <Cargando />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {ROLES.map(({ rol, plural }) => {
            const lista = cuentas.filter((c) => c.rol === rol);
            return (
              <section key={rol} className="rounded-2xl bg-stone-200/60 p-3">
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-stone-700">
                  {plural}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs">{lista.filter((c) => c.activo).length} activos</span>
                </h2>
                <ul className="space-y-2">
                  {lista.map((c) =>
                    editando === c.id ? (
                      <EditarCuenta key={c.id} cuenta={c} alCancelar={() => setEditando(undefined)} alGuardar={(datos) => cambiar(c, datos)} />
                    ) : (
                      <li key={c.id} className={`rounded-xl bg-white p-3 ring-1 ring-stone-200 ${c.activo ? '' : 'opacity-60'}`}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-semibold">{c.nombre}</span>
                          {!c.activo && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">Suspendido</span>}
                          {c.pedidosActivos > 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              {c.pedidosActivos} {c.pedidosActivos === 1 ? 'pedido activo' : 'pedidos activos'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-stone-500">{c.email}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Boton variante="secundario" className="px-2.5 py-1" disabled={ocupado === c.id} onClick={() => setEditando(c.id)}>Editar</Boton>
                          <Boton variante="secundario" className="px-2.5 py-1" disabled={ocupado === c.id} onClick={() => suspender(c)}>
                            {c.activo ? 'Suspender' : 'Reactivar'}
                          </Boton>
                          {!c.tieneHistorial && (
                            <Boton variante="peligro" className="px-2.5 py-1" disabled={ocupado === c.id} onClick={() => borrar(c)}>Borrar</Boton>
                          )}
                        </div>
                      </li>
                    ),
                  )}
                  {lista.length === 0 && <li className="px-1 py-4 text-center text-xs text-stone-500">Sin {plural.toLowerCase()} registrados</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-stone-500">
        Quien ya registró o entregó pedidos no se puede borrar: se suspende. Quien tiene pedidos activos no se puede suspender ni cambiar de rol hasta que se cierren.
      </p>
    </>
  );
}

function SelectorRol({ valor, alCambiar }: { valor: RolPersonal; alCambiar: (r: RolPersonal) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-stone-700">Rol</legend>
      <div className="inline-flex rounded-xl bg-stone-200/70 p-1 text-sm font-medium">
        {ROLES.map((r) => (
          <button
            key={r.rol}
            type="button"
            aria-pressed={valor === r.rol}
            onClick={() => alCambiar(r.rol)}
            className={`rounded-lg px-3 py-1.5 ${valor === r.rol ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
          >
            {r.nombre}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function NuevaCuenta({ alGuardar }: { alGuardar: () => Promise<void> }) {
  const vacia = { nombre: '', email: '', password: '' };
  const [datos, setDatos] = useState(vacia);
  const [rol, setRol] = useState<RolPersonal>('MESERO');
  const [error, setError] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setAviso(undefined);
    setEnviando(true);
    try {
      const cuenta = await llamar<Cuenta>('/personal', { metodo: 'POST', cuerpo: { ...datos, rol } });
      setAviso(`Cuenta de ${cuenta.nombre} creada. Ya puede entrar con ${cuenta.email} y la contraseña que le asignaste.`);
      setDatos(vacia);
      await alGuardar();
    } catch (e) {
      setError(mensajeDeError(e));
    }
    setEnviando(false);
  }

  return (
    <form onSubmit={guardar} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <h2 className="mb-3 font-semibold">Registrar mesero o repartidor</h2>
      <div className="flex flex-wrap items-end gap-3">
        <SelectorRol valor={rol} alCambiar={setRol} />
        <Campo etiqueta="Nombre" className="w-48" required minLength={2} maxLength={80} value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
        <Campo etiqueta="Correo" className="w-60" type="email" required value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} />
        <Campo
          etiqueta="Contraseña"
          className="w-48"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          title={AYUDA_CONTRASENA}
          value={datos.password}
          onChange={(e) => setDatos({ ...datos, password: e.target.value })}
        />
        <Boton type="submit" disabled={enviando}>Registrar</Boton>
      </div>
      <p className="mt-2 text-xs text-stone-500">Contraseña: {AYUDA_CONTRASENA.toLowerCase()}. Entrégasela a la persona en privado.</p>
      <div className="mt-3 space-y-2">
        <Aviso>{error}</Aviso>
        {aviso && <p className="text-sm font-medium text-emerald-700">{aviso}</p>}
      </div>
    </form>
  );
}

function EditarCuenta({ cuenta, alCancelar, alGuardar }: { cuenta: Cuenta; alCancelar: () => void; alGuardar: (datos: Record<string, unknown>) => void }) {
  const [nombre, setNombre] = useState(cuenta.nombre);
  const [email, setEmail] = useState(cuenta.email);
  const [rol, setRol] = useState<RolPersonal>(cuenta.rol);
  const [password, setPassword] = useState('');
  return (
    <li className="rounded-xl bg-white p-3 ring-2 ring-marca-500">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          alGuardar({ nombre, email, ...(rol !== cuenta.rol && { rol }), ...(password && { password }) });
        }}
      >
        <Campo etiqueta="Nombre" className="w-44" required minLength={2} maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Campo etiqueta="Correo" className="w-56" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <SelectorRol valor={rol} alCambiar={setRol} />
        <Campo
          etiqueta="Nueva contraseña (opcional)"
          className="w-52"
          type="password"
          autoComplete="new-password"
          minLength={8}
          title={AYUDA_CONTRASENA}
          placeholder="Dejar igual"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Boton type="submit" className="px-3 py-1.5">Guardar</Boton>
        <Boton type="button" variante="secundario" className="px-3 py-1.5" onClick={alCancelar}>Cancelar</Boton>
      </form>
    </li>
  );
}
