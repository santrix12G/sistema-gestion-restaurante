// Cliente HTTP de la API. Toda la web habla con el backend por aquí.
import { t } from './i18n';

export const URL_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const CLAVE_SESION = 'restaurante.sesion';

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Con «mantener la sesión iniciada», la sesión se guarda en localStorage y sigue abierta al cerrar el navegador.
 * Sin ella, en sessionStorage: se cierra al cerrar la pestaña.
 */
export function leerSesionGuardada<T>(): T | null {
  try {
    const guardada = sessionStorage.getItem(CLAVE_SESION) ?? localStorage.getItem(CLAVE_SESION);
    return guardada ? (JSON.parse(guardada) as T) : null;
  } catch {
    return null;
  }
}

/** true si la sesión de este equipo se guardó con «mantener la sesión iniciada» */
export function sesionRecordada() {
  try {
    return localStorage.getItem(CLAVE_SESION) !== null;
  } catch {
    return false;
  }
}

export function guardarSesion(sesion: unknown | null, recordar = false) {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
    localStorage.removeItem(CLAVE_SESION);
    if (sesion) (recordar ? localStorage : sessionStorage).setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch {
    // Sin almacenamiento (modo privado estricto): la sesión dura lo que dure la pestaña
  }
}

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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
    throw new ErrorApi(0, t('No hay conexión con el servidor. Revisa que la API esté encendida'));
  }

  // La sesión expiró o el usuario fue desactivado: vuelve al inicio de sesión
  if (res.status === 401 && token) {
    guardarSesion(null);
    window.location.href = '/login';
  }
  const datos = await res.json().catch(() => null);
  // Los mensajes de la API vienen en español; los conocidos se traducen
  if (!res.ok) throw new ErrorApi(res.status, t(datos?.mensaje ?? 'No se pudo completar la acción'));
  return datos as T;
}

export const mensajeDeError = (e: unknown) => (e instanceof Error ? e.message : t('Ocurrió un error inesperado'));
