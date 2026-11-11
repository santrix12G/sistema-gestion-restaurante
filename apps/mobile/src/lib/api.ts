// Cliente HTTP de la API. Toda la app habla con el backend por aquí.
export const URL_API = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/+$/, '');

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    message: string,
  ) {
    super(message);
  }
}

// El proveedor de sesión fija el token y qué hacer cuando la API lo rechaza
let tokenActual: string | null = null;
let alExpirar: () => void = () => {};

export function configurarSesionApi(token: string | null, expiro: () => void) {
  tokenActual = token;
  alExpirar = expiro;
}

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH';
  cuerpo?: unknown;
  encabezados?: Record<string, string>;
}

// Render gratis tarda cerca de un minuto en despertar: se espera más que un fetch normal
const ESPERA_MAXIMA_MS = 70_000;

export async function llamar<T>(ruta: string, { metodo = 'GET', cuerpo, encabezados }: Opciones = {}): Promise<T> {
  const token = tokenActual;
  const cancelar = new AbortController();
  const temporizador = setTimeout(() => cancelar.abort(), ESPERA_MAXIMA_MS);
  let res: Response;
  try {
    res = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...encabezados,
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: cancelar.signal,
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor. Revisa tu internet o espera a que la API despierte');
  } finally {
    clearTimeout(temporizador);
  }

  // La sesión expiró o el usuario fue desactivado: vuelve al inicio de sesión
  if (res.status === 401 && token) alExpirar();
  const datos = await res.json().catch(() => null);
  if (!res.ok) throw new ErrorApi(res.status, datos?.mensaje ?? 'No se pudo completar la acción');
  return datos as T;
}

export const mensajeDeError = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado');

/** Clave única por intento de crear un pedido: si la red falla y se reintenta, no se duplica */
export function nuevaClave() {
  return `movil-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
