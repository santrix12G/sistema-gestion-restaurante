'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { guardarSesion, leerSesionGuardada, llamar } from './api';
import { Rol, UsuarioSesion } from './tipos';

interface Sesion {
  token: string;
  usuario: UsuarioSesion;
}

interface ContextoSesion {
  usuario: UsuarioSesion | null;
  /** false mientras se lee la sesión guardada: evita redirigir al login antes de tiempo */
  lista: boolean;
  iniciar: (email: string, password: string) => Promise<UsuarioSesion>;
  salir: () => void;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    setUsuario(leerSesionGuardada<Sesion>()?.usuario ?? null);
    setLista(true);
  }, []);

  const iniciar = useCallback(async (email: string, password: string) => {
    const sesion = await llamar<Sesion>('/auth/login', { metodo: 'POST', cuerpo: { email, password } });
    guardarSesion(sesion);
    setUsuario(sesion.usuario);
    return sesion.usuario;
  }, []);

  const salir = useCallback(() => {
    guardarSesion(null);
    setUsuario(null);
  }, []);

  return <Contexto.Provider value={{ usuario, lista, iniciar, salir }}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return contexto;
}

/** Pantalla inicial de cada rol después de iniciar sesión */
export const inicioPorRol = (rol: Rol) => (rol === 'COCINA' ? '/cocina' : '/pedidos');
