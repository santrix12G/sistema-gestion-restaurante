'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';
import { Captcha, CLAVE_CAPTCHA, ControlCaptcha } from '@/components/captcha';
import { PaginaPublica } from '@/components/pagina-publica';
import { Aviso, Boton, Campo } from '@/components/ui';
import { llamar, mensajeDeError } from '@/lib/api';
import { idiomaActual, t } from '@/lib/i18n';

/** «¿Olvidaste tu contraseña?»: pide el correo y la API envía un enlace para poner una nueva */
export default function Recuperar() {
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [captcha, setCaptcha] = useState<string>();
  const control = useRef<ControlCaptcha>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (CLAVE_CAPTCHA && !captcha) {
      setError(t('Completa la verificación de seguridad'));
      return;
    }
    const email = String(new FormData(e.currentTarget).get('email'));
    setEnviando(true);
    setError(undefined);
    try {
      await llamar('/auth/recuperar', { metodo: 'POST', cuerpo: { email, idioma: idiomaActual(), captcha } });
      setEnviado(true);
    } catch (err) {
      setError(mensajeDeError(err));
      control.current?.reiniciar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PaginaPublica titulo={t('Recuperar la contraseña')}>
      {enviado ? (
        <div role="status" className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
          <MailCheck className="size-8 text-emerald-700" aria-hidden />
          <p className="mt-3 font-semibold text-stone-900">{t('Revisa tu correo')}</p>
          <p className="mt-1">
            {t('Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. Vence en 30 minutos y sirve una sola vez. Si no llega, revisa la carpeta de spam.')}
          </p>
          <Link href="/login" className="mt-4 inline-block font-semibold text-marca-700 hover:underline">
            {t('Volver al inicio de sesión')}
          </Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="max-w-sm space-y-5">
          <p>{t('Escribe el correo de tu cuenta y te enviaremos un enlace para poner una contraseña nueva.')}</p>
          <Campo etiqueta={t('Correo')} name="email" type="email" autoComplete="username" required autoFocus />
          <Captcha ref={control} alResolver={setCaptcha} />
          <Aviso>{error}</Aviso>
          <Boton type="submit" disabled={enviando} className="w-full py-2.5">
            {enviando ? t('Enviando…') : t('Enviar el enlace')}
          </Boton>
          <p className="text-sm">
            {t('Si no tienes acceso a tu correo, pídele al administrador que te asigne una contraseña nueva desde Personal.')}
          </p>
          <Link href="/login" className="inline-block text-sm font-semibold text-marca-700 hover:underline">
            {t('Volver al inicio de sesión')}
          </Link>
        </form>
      )}
    </PaginaPublica>
  );
}
