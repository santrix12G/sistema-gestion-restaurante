// Puerto de la pasarela de pagos: los casos de uso dependen de esta interfaz, no de MercadoPago.
// En las pruebas se reemplaza por una pasarela falsa; en producción la implementa el adaptador de MercadoPago.

export interface SolicitudEnlace {
  /** Id del pago en el sistema. Vuelve en cada consulta como referencia externa */
  pagoId: string;
  numeroPedido: number;
  /** En pesos, sin decimales */
  monto: number;
  /** Después de esta hora el enlace ya no sirve */
  venceEn: Date;
}

export interface EnlaceCreado {
  /** Identificador del enlace en la pasarela (en MercadoPago, el id de la preferencia) */
  referencia: string;
  url: string;
}

/** Lo que la pasarela dice de un intento de pago. */
export interface PagoEnPasarela {
  id: string;
  /** Estado tal como lo nombra la pasarela, por ejemplo approved o rejected */
  estado: string;
  monto: number;
  moneda: string;
  /** El pagoId que se envió al crear el enlace */
  pagoId: string | null;
}

export interface Pasarela {
  /** Nombre que se guarda en la columna proveedor, por ejemplo mercadopago */
  readonly nombre: string;
  /** False si faltan las credenciales: el bot solo ofrece efectivo */
  readonly disponible: boolean;
  crearEnlace(solicitud: SolicitudEnlace): Promise<EnlaceCreado>;
  /** Consulta el pago en la pasarela. Null si no existe */
  consultarPago(id: string): Promise<PagoEnPasarela | null>;
}

export const PASARELA = Symbol('Pasarela');
