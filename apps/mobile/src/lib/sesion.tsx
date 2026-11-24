import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { escribir, leer } from './almacen';
import { configurarSesionApi, ErrorApi, llamar } from './api';
import { Rol, Sesion, UsuarioSesion } from './tipos';

// La app es para el personal que trabaja de pie. Cocina y administración usan la web.
const ROLES_DE_LA_APP: Rol[] = ['MESERO', 'REPARTIDOR', 'ADMIN'];

interface ContextoSesion {
  sesion: Sesion | null;
  /** false mientras se lee la sesión guardada: evita mostrar el login antes de tiempo */
  lista: boolean;
  /** `recordar`: mantener la sesión al cerrar la app (se guarda cifrada en el celular, 30 días) */
  iniciar: (email: string, password: string, recordar: boolean) => Promise<UsuarioSesion>;
  salir: () => void;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [lista, setLista] = useState(false);

  const salir = useCallback(() => {
    setSesion(null);
    void escribir(null);
  }, []);

  useEffect(() => {
    void leer().then((guardada) => {
      try {
        if (guardada) setSesion(JSON.parse(guardada) as Sesion);
      } catch {
        // Sesión dañada: se pide iniciar de nuevo
      }
      setLista(true);
    });
  }, []);

  // El cliente HTTP usa el token de la sesión actual, y si la API lo rechaza cierra la sesión
  useEffect(() => {
    configurarSesionApi(sesion?.token ?? null, salir);
  }, [sesion, salir]);

  const iniciar = useCallback(async (email: string, password: string, recordar: boolean) => {
    // La app no muestra captcha: entra por su propia ruta, que admite menos intentos por minuto
    const nueva = await llamar<Sesion>('/auth/login/movil', { metodo: 'POST', cuerpo: { email: email.trim(), password, recordar } });
    if (!ROLES_DE_LA_APP.includes(nueva.usuario.rol)) {
      throw new ErrorApi(403, 'La app es para meseros y repartidores. Cocina usa la pantalla web');
    }
    configurarSesionApi(nueva.token, salir);
    // Sin «mantener la sesión», no se guarda: dura mientras la app esté abierta (y máximo 12 horas)
    await escribir(recordar ? JSON.stringify(nueva) : null);
    setSesion(nueva);
    return nueva.usuario;
  }, [salir]);

  return <Contexto.Provider value={{ sesion, lista, iniciar, salir }}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return contexto;
}

/** El usuario de la sesión. Es null un instante al cerrar sesión, antes de volver al login */
export function useUsuario(): UsuarioSesion | null {
  return useSesion().sesion?.usuario ?? null;
}
