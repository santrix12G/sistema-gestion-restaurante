'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { inicioPorRol, useSesion } from '@/lib/sesion';

export default function Inicio() {
  const { usuario, lista } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (lista) router.replace(usuario ? inicioPorRol(usuario.rol) : '/login');
  }, [lista, usuario, router]);

  return null;
}
