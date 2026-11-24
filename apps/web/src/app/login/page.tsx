'use client';

import { Bike, ClipboardList, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useRef, useState } from 'react';
import { BarraAccesibilidad } from '@/components/accesibilidad';
import { Captcha, CLAVE_CAPTCHA, ControlCaptcha } from '@/components/captcha';
import { Marca, NOMBRE_RESTAURANTE } from '@/components/marca';
import { Pie, SaltarAlContenido } from '@/components/pagina-publica';
import { Aviso, Boton, Campo } from '@/components/ui';
import { mensajeDeError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { inicioPorRol, useSesion } from '@/lib/sesion';

const PUNTOS = [
  { icono: ClipboardList, texto: 'Pedidos de mesa y para recoger en tiempo real' },
  { icono: MessageCircle, texto: 'Pedidos por WhatsApp y Telegram con el chatbot' },
  { icono: Bike, texto: 'Domicilios con su repartidor y su estado' },
];

export default function Login() {
  const { iniciar } = useSesion();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [captcha, setCaptcha] = useState<string>();
  const control = useRef<ControlCaptcha>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (CLAVE_CAPTCHA && !captcha) {
      setError(t('Completa la verificación de seguridad'));
      return;
    }
    const datos = new FormData(e.currentTarget);
    setEnviando(true);
    setError(undefined);
    try {
      const usuario = await iniciar({
        email: String(datos.get('email')),
        password: String(datos.get('password')),
        recordar: datos.get('recordar') === 'on',
        captcha,
      });
      router.replace(inicioPorRol(usuario.rol));
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
      // La respuesta del captcha ya se gastó: se pide otra
      control.current?.reiniciar();
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <title>{`${t('Inicia sesión')} · ${NOMBRE_RESTAURANTE}`}</title>
      <SaltarAlContenido />
      <div className="grid flex-1 lg:grid-cols-2">
        {/* Panel de la marca: solo en pantallas grandes */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-marca-700 p-12 text-white lg:flex">
          <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/5" aria-hidden />
          <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" aria-hidden />
          <Marca claro />
          <div className="relative max-w-md">
            <h2 className="text-3xl font-bold leading-tight">{t('Todo el servicio del restaurante en un solo lugar.')}</h2>
            <ul className="mt-8 space-y-4">
              {PUNTOS.map(({ icono: Icono, texto }) => (
                <li key={texto} className="flex items-center gap-3 text-white/90">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10">
                    <Icono className="size-5" aria-hidden />
                  </span>
                  {t(texto)}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-sm text-white/80">
            {t('Sistema de gestión')} · {NOMBRE_RESTAURANTE}
          </p>
        </section>

        <div className="flex flex-col px-4 py-6">
          <BarraAccesibilidad className="justify-end" />
          <main id="contenido" tabIndex={-1} className="flex flex-1 items-center justify-center py-8 outline-none">
            <form onSubmit={enviar} className="w-full max-w-sm space-y-5">
              <div className="lg:hidden">
                <Marca />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('Inicia sesión')}</h1>
                <p className="mt-1 text-sm text-stone-500">{t('Entra con el correo y la contraseña que te dio el administrador.')}</p>
              </div>
              <Campo etiqueta={t('Correo')} name="email" type="email" autoComplete="username" required autoFocus />
              <Campo etiqueta={t('Contraseña')} name="password" type="password" autoComplete="current-password" required />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <label className="flex items-center gap-2 font-medium text-stone-700">
                  <input type="checkbox" name="recordar" className="size-4 accent-marca-600" />
                  {t('Mantener la sesión iniciada')}
                </label>
                <Link href="/recuperar" className="font-semibold text-marca-700 hover:underline">
                  {t('¿Olvidaste tu contraseña?')}
                </Link>
              </div>
              <p className="-mt-3 text-xs text-stone-500">
                {t('Sin marcar, la sesión se cierra al cerrar la pestaña o a las 12 horas. Marcada, dura 30 días en este equipo: no la uses en equipos compartidos.')}
              </p>
              <Captcha ref={control} alResolver={setCaptcha} />
              <Aviso>{error}</Aviso>
              <Boton type="submit" disabled={enviando} className="w-full py-2.5">
                {enviando ? t('Entrando…') : t('Entrar')}
              </Boton>
            </form>
          </main>
        </div>
      </div>
      <Pie />
    </div>
  );
}
