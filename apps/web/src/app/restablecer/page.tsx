'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { PaginaPublica } from '@/components/pagina-publica';
import { Aviso, Boton, Campo } from '@/components/ui';
import { llamar, mensajeDeError } from '@/lib/api';
import { t } from '@/lib/i18n';

/** Llega desde el enlace del correo: pone la contraseña nueva */
export default function Restablecer() {
  return (
    <PaginaPublica titulo={t('Nueva contraseña')}>
      <Suspense>
        <Formulario />
      </Suspense>
    </PaginaPublica>
  );
}

function Formulario() {
  const token = useSearchParams().get('token') ?? '';
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const password = String(datos.get('password'));
    if (password !== String(datos.get('confirmacion'))) {
      setError(t('Las dos contraseñas no coinciden'));
      return;
    }
    setEnviando(true);
    setError(undefined);
    try {
      await llamar('/auth/restablecer', { metodo: 'POST', cuerpo: { token, password } });
      setListo(true);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <div className="max-w-sm space-y-4">
        <Aviso>{t('El enlace no es válido o ya venció. Pide uno nuevo')}</Aviso>
        <Link href="/recuperar" className="inline-block font-semibold text-marca-700 hover:underline">
          {t('Pedir un enlace nuevo')}
        </Link>
      </div>
    );
  }

  if (listo) {
    return (
      <div role="status" className="max-w-sm rounded-2xl bg-white p-6 ring-1 ring-stone-200">
        <CircleCheck className="size-8 text-emerald-700" aria-hidden />
        <p className="mt-3 font-semibold text-stone-900">{t('Listo. Ya puedes iniciar sesión con tu nueva contraseña')}</p>
        <p className="mt-1 text-sm">{t('Por seguridad, cerramos las sesiones que tenías abiertas en otros equipos.')}</p>
        <Link href="/login" className="mt-4 inline-block font-semibold text-marca-700 hover:underline">
          {t('Ir al inicio de sesión')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="max-w-sm space-y-5">
      <p id="reglas-contrasena">{t('Usa al menos 8 caracteres, con letras y números.')}</p>
      <Campo
        etiqueta={t('Contraseña nueva')}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        autoFocus
        aria-describedby="reglas-contrasena"
      />
      <Campo etiqueta={t('Repite la contraseña')} name="confirmacion" type="password" autoComplete="new-password" minLength={8} required />
      <Aviso>{error}</Aviso>
      <Boton type="submit" disabled={enviando} className="w-full py-2.5">
        {enviando ? t('Guardando…') : t('Guardar la contraseña')}
      </Boton>
    </form>
  );
}
