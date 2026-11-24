'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { guardarSesion, leerSesionGuardada, llamar, sesionRecordada } from './api';
import { Rol, UsuarioSesion } from './tipos';

interface Sesion {
  token: string;
  usuario: UsuarioSesion;
}

interface ContextoSesion {
  usuario: UsuarioSesion | null;
  /** false mientras se lee la sesión guardada: evita redirigir al login antes de tiempo */
  lista: boolean;
  /** `recordar`: mantener la sesión iniciada en este equipo. `captcha`: respuesta de Turnstile */
  iniciar: (datos: { email: string; password: string; recordar: boolean; captcha?: string }) => Promise<UsuarioSesion>;
  /** Cambia la contraseña propia. La API cierra las otras sesiones y entrega una nueva para este equipo */
  cambiarContrasena: (actual: string, nueva: string) => Promise<void>;
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

  const iniciar = useCallback(async (datos: { email: string; password: string; recordar: boolean; captcha?: string }) => {
    const sesion = await llamar<Sesion>('/auth/login', { metodo: 'POST', cuerpo: datos });
    guardarSesion(sesion, datos.recordar);
    setUsuario(sesion.usuario);
    return sesion.usuario;
  }, []);

  const cambiarContrasena = useCallback(async (actual: string, nueva: string) => {
    // La sesión nueva dura lo mismo que la de ahora: 30 días si estaba recordada, 12 horas si no
    const recordar = sesionRecordada();
    const sesion = await llamar<Sesion>('/auth/contrasena', { metodo: 'POST', cuerpo: { actual, nueva, recordar } });
    guardarSesion({ token: sesion.token, usuario: sesion.usuario }, recordar);
    setUsuario(sesion.usuario);
  }, []);

  const salir = useCallback(() => {
    guardarSesion(null);
    setUsuario(null);
  }, []);

  return <Contexto.Provider value={{ usuario, lista, iniciar, cambiarContrasena, salir }}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return contexto;
}

/** Pantalla inicial de cada rol después de iniciar sesión */
export const inicioPorRol = (_rol: Rol) => '/pedidos';
