'use client';

import { Bike, ClipboardList, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Marca, NOMBRE_RESTAURANTE } from '@/components/marca';
import { Aviso, Boton, Campo } from '@/components/ui';
import { mensajeDeError } from '@/lib/api';
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

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setEnviando(true);
    setError(undefined);
    try {
      const usuario = await iniciar(String(datos.get('email')), String(datos.get('password')));
      router.replace(inicioPorRol(usuario.rol));
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de la marca: solo en pantallas grandes */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-marca-700 p-12 text-white lg:flex">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/5" aria-hidden />
        <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" aria-hidden />
        <Marca claro />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight">Todo el servicio del restaurante en un solo lugar.</h2>
          <ul className="mt-8 space-y-4">
            {PUNTOS.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-white/90">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icono className="size-5" aria-hidden />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">Sistema de gestión · {NOMBRE_RESTAURANTE}</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <form onSubmit={enviar} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden">
            <Marca />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inicia sesión</h1>
            <p className="mt-1 text-sm text-stone-500">Entra con el correo y la contraseña que te dio el administrador.</p>
          </div>
          <Campo etiqueta="Correo" name="email" type="email" autoComplete="username" required autoFocus />
          <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="current-password" required />
          <Aviso>{error}</Aviso>
          <Boton type="submit" disabled={enviando} className="w-full py-2.5">
            {enviando ? 'Entrando…' : 'Entrar'}
          </Boton>
        </form>
      </section>
    </main>
  );
}
