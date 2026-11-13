import { createHmac, timingSafeEqual } from 'node:crypto';

export interface DatosFirma {
  /** Cabecera x-signature, por ejemplo "ts=1704908010,v1=618c85…" */
  xSignature?: string;
  /** Cabecera x-request-id */
  xRequestId?: string;
  /** data.id de la URL del aviso */
  dataId?: string;
  /** Clave secreta del webhook, en Tus integraciones de MercadoPago */
  secreto: string;
}

/**
 * Texto que MercadoPago firma: "id:{data.id};request-id:{x-request-id};ts:{ts};".
 * Si falta un dato, su par se omite. Es la misma regla del SDK oficial (mercadopago 3.6.2, utils/webhook).
 */
export function textoFirmado(dataId: string | undefined, requestId: string | undefined, ts: string) {
  const partes: string[] = [];
  if (dataId) partes.push(`id:${dataId}`);
  if (requestId) partes.push(`request-id:${requestId}`);
  partes.push(`ts:${ts}`);
  return partes.join(';') + ';';
}

/** Lee "ts=…,v1=…" de la cabecera x-signature. */
function leerCabecera(cabecera: string) {
  let ts: string | undefined;
  let v1: string | undefined;
  for (const parte of cabecera.split(',')) {
    const igual = parte.indexOf('=');
    if (igual === -1) continue;
    const clave = parte.slice(0, igual).trim().toLowerCase();
    const valor = parte.slice(igual + 1).trim();
    if (clave === 'ts') ts = valor;
    if (clave === 'v1') v1 = valor;
  }
  return { ts, v1 };
}

/** Comprueba que el aviso lo envió MercadoPago: calcula el HMAC-SHA256 y lo compara en tiempo constante. */
export function firmaMercadoPagoValida({ xSignature, xRequestId, dataId, secreto }: DatosFirma): boolean {
  if (!secreto || !xSignature) return false;
  const { ts, v1 } = leerCabecera(xSignature);
  if (!ts || !/^\d+$/.test(ts) || !v1) return false;

  const esperada = createHmac('sha256', secreto).update(textoFirmado(dataId?.trim(), xRequestId?.trim(), ts)).digest('hex');
  const a = Buffer.from(esperada);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
