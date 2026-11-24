'use client';

import { FormEvent, useState } from 'react';
import { useAvisos } from '@/components/avisos';
import { Aviso, Boton, Campo, Titulo } from '@/components/ui';
import { mensajeDeError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useSesion } from '@/lib/sesion';

const NOMBRE_ROL = { ADMIN: 'Administrador', MESERO: 'Mesero', REPARTIDOR: 'Repartidor' } as const;

/** Cada persona ve sus datos y cambia su propia contraseña */
export default function MiCuenta() {
  const { usuario, cambiarContrasena } = useSesion();
  const { avisar } = useAvisos();
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const datos = new FormData(formulario);
    const nueva = String(datos.get('nueva'));
    if (nueva !== String(datos.get('confirmacion'))) {
      setError(t('Las dos contraseñas no coinciden'));
      return;
    }
    setEnviando(true);
    setError(undefined);
    try {
      await cambiarContrasena(String(datos.get('actual')), nueva);
      formulario.reset();
      avisar(t('Contraseña actualizada. Se cerró la sesión en los demás equipos'));
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return null;
  return (
    <>
      <Titulo>{t('Mi cuenta')}</Titulo>
      <dl className="mb-8 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <dt className="text-stone-600">{t('Nombre')}</dt>
        <dd className="font-medium">{usuario.nombre}</dd>
        <dt className="text-stone-600">{t('Correo')}</dt>
        <dd className="font-medium break-all">{usuario.email}</dd>
        <dt className="text-stone-600">{t('Rol')}</dt>
        <dd className="font-medium">{t(NOMBRE_ROL[usuario.rol])}</dd>
      </dl>

      <section aria-labelledby="titulo-contrasena" className="max-w-md">
        <h2 id="titulo-contrasena" className="mb-1 text-lg font-semibold">
          {t('Cambiar la contraseña')}
        </h2>
        <p id="reglas-contrasena" className="mb-4 text-sm text-stone-600">
          {t('Usa al menos 8 caracteres, con letras y números.')} {t('Al cambiarla se cierra tu sesión en los demás equipos; en este sigues dentro.')}
        </p>
        <form onSubmit={enviar} className="space-y-5">
          <Campo etiqueta={t('Contraseña actual')} name="actual" type="password" autoComplete="current-password" required />
          <Campo
            etiqueta={t('Contraseña nueva')}
            name="nueva"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-describedby="reglas-contrasena"
          />
          <Campo etiqueta={t('Repite la contraseña')} name="confirmacion" type="password" autoComplete="new-password" minLength={8} required />
          <Aviso>{error}</Aviso>
          <Boton type="submit" disabled={enviando} className="py-2.5">
            {enviando ? t('Guardando…') : t('Cambiar la contraseña')}
          </Boton>
        </form>
      </section>
    </>
  );
}
