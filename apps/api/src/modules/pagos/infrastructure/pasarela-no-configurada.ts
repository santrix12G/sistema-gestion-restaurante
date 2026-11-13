import { EnlaceCreado, Pasarela, PagoEnPasarela } from '../application/pasarela';

/** Se usa cuando faltan las credenciales de MercadoPago: el pago en línea queda apagado y el bot solo ofrece efectivo. */
export class PasarelaNoConfigurada implements Pasarela {
  readonly nombre = 'ninguna';
  readonly disponible = false;

  crearEnlace(): Promise<EnlaceCreado> {
    return Promise.reject(new Error('El pago en línea no está configurado. Ver MERCADOPAGO_ACCESS_TOKEN en apps/api/.env.example'));
  }

  consultarPago(): Promise<PagoEnPasarela | null> {
    return Promise.resolve(null);
  }
}
