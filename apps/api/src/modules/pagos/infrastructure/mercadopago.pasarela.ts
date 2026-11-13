import { Logger } from '@nestjs/common';
import { Config, leerConfig } from '../../../shared/config';
import { EnlaceCreado, PagoEnPasarela, Pasarela, SolicitudEnlace } from '../application/pasarela';

const API = 'https://api.mercadopago.com';

// Solo los campos que se usan de las respuestas de MercadoPago
interface PreferenciaCreada {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
}

interface PagoMercadoPago {
  id?: number | string;
  status?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string | null;
}

/** Hora de Colombia (UTC-5, sin horario de verano) con el formato que pide MercadoPago: 2026-11-13T15:30:00.000-05:00 */
export function horaColombia(fecha: Date): string {
  return new Date(fecha.getTime() - 5 * 3_600_000).toISOString().replace('Z', '-05:00');
}

/**
 * Cobra con Checkout Pro de MercadoPago: crea una preferencia de pago y su enlace,
 * y consulta los pagos que llegan por el webhook. Usa fetch, sin el SDK, como los demás adaptadores.
 */
export class PasarelaMercadoPago implements Pasarela {
  readonly nombre = 'mercadopago';
  readonly disponible = true;
  private readonly logger = new Logger('MercadoPago');

  constructor(private readonly config: Config['pagos']['mercadopago'] = leerConfig().pagos.mercadopago) {}

  async crearEnlace({ pagoId, numeroPedido, monto, venceEn }: SolicitudEnlace): Promise<EnlaceCreado> {
    const respuesta = await this.llamar('/checkout/preferences', {
      method: 'POST',
      // Si la petición se repite por un corte de red, MercadoPago no crea una segunda preferencia
      headers: { 'X-Idempotency-Key': pagoId },
      body: JSON.stringify({
        items: [{ id: pagoId, title: `Pedido #${numeroPedido}`, quantity: 1, unit_price: monto, currency_id: 'COP' }],
        // Vuelve en cada pago: así se sabe a qué pago del sistema corresponde
        external_reference: pagoId,
        // Sin dirección pública (en tu PC sin túnel), MercadoPago no puede avisar; se toma la del panel de MercadoPago
        ...(this.config.urlNotificacion ? { notification_url: this.config.urlNotificacion } : {}),
        expires: true,
        expiration_date_from: horaColombia(new Date()),
        expiration_date_to: horaColombia(venceEn),
      }),
    });
    const preferencia = (await respuesta.json()) as PreferenciaCreada;
    const url = preferencia.init_point ?? preferencia.sandbox_init_point;
    if (!preferencia.id || !url) throw new Error('MercadoPago no devolvió el enlace de pago');
    return { referencia: preferencia.id, url };
  }

  async consultarPago(id: string): Promise<PagoEnPasarela | null> {
    const respuesta = await this.llamar(`/v1/payments/${encodeURIComponent(id)}`, { method: 'GET' }, [404]);
    if (respuesta.status === 404) return null;

    const pago = (await respuesta.json()) as PagoMercadoPago;
    if (pago.status === undefined || pago.transaction_amount === undefined) throw new Error(`MercadoPago devolvió el pago ${id} incompleto`);
    return {
      id: String(pago.id ?? id),
      estado: pago.status,
      monto: pago.transaction_amount,
      moneda: pago.currency_id ?? '',
      pagoId: pago.external_reference || null,
    };
  }

  /** Llama a la API con el token. Lanza un error si responde mal, salvo los códigos que se esperan. */
  private async llamar(ruta: string, init: RequestInit, esperados: number[] = []): Promise<Response> {
    const respuesta = await fetch(`${API}${ruta}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(10_000),
    });
    if (!respuesta.ok && !esperados.includes(respuesta.status)) {
      // MercadoPago explica el motivo en el cuerpo: token inválido, campo mal formado…
      const detalle = await respuesta.text().catch(() => '');
      this.logger.warn(`${init.method} ${ruta} respondió ${respuesta.status}: ${detalle.slice(0, 500)}`);
      throw new Error(`MercadoPago respondió ${respuesta.status}`);
    }
    return respuesta;
  }
}
