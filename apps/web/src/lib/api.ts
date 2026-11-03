// Cliente HTTP de la API. Toda la web habla con el backend por aquí.
const URL_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const CLAVE_SESION = 'restaurante.sesion';

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    message: string,
  ) {
    super(message);
  }
}

export function leerSesionGuardada<T>(): T | null {
  try {
    const guardada = localStorage.getItem(CLAVE_SESION);
    return guardada ? (JSON.parse(guardada) as T) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: unknown | null) {
  try {
    if (sesion) localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    // Sin almacenamiento (modo privado estricto): la sesión dura lo que dure la pestaña
  }
}

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH';
  cuerpo?: unknown;
  encabezados?: Record<string, string>;
}

export async function llamar<T>(ruta: string, { metodo = 'GET', cuerpo, encabezados }: Opciones = {}): Promise<T> {
  const token = leerSesionGuardada<{ token: string }>()?.token;
  let res: Response;
  try {
    res = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...encabezados,
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor. Revisa que la API esté encendida');
  }

  // La sesión expiró o el usuario fue desactivado: vuelve al inicio de sesión
  if (res.status === 401 && token) {
    guardarSesion(null);
    window.location.href = '/login';
  }
  const datos = await res.json().catch(() => null);
  if (!res.ok) throw new ErrorApi(res.status, datos?.mensaje ?? 'No se pudo completar la acción');
  return datos as T;
}

export const mensajeDeError = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado');
