'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Aviso, Boton, Campo } from '@/components/ui';
import { mensajeDeError } from '@/lib/api';
import { inicioPorRol, useSesion } from '@/lib/sesion';

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
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-200">
        <div className="mb-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-marca-600">Restaurante</p>
          <h1 className="text-2xl font-bold">Inicia sesión</h1>
        </div>
        <Campo etiqueta="Correo" name="email" type="email" autoComplete="username" required autoFocus />
        <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="current-password" required />
        <Aviso>{error}</Aviso>
        <Boton type="submit" disabled={enviando} className="w-full">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Boton>
      </form>
    </main>
  );
}
