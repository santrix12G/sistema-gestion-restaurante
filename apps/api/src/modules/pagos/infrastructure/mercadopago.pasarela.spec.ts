import { Logger } from '@nestjs/common';
import { horaColombia, PasarelaMercadoPago } from './mercadopago.pasarela';

const CONFIG = { accessToken: 'TEST-token', secretoWebhook: 'secreto', urlNotificacion: 'https://api.test/api/webhooks/mercadopago?source_news=webhooks' };

/** Reemplaza fetch por una respuesta fija y guarda lo que se envió. */
function responder(status: number, cuerpo: unknown) {
  return jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }));
}

beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('horaColombia', () => {
  it('escribe la hora con la zona de Colombia', () => {
    expect(horaColombia(new Date('2026-11-13T20:30:00.000Z'))).toBe('2026-11-13T15:30:00.000-05:00');
  });
});

describe('pasarela de MercadoPago', () => {
  const solicitud = { pagoId: '0b7c5a52-6f3e-4c5b-9a43-1d2c3b4a5f60', numeroPedido: 42, monto: 47000, venceEn: new Date('2026-11-13T21:00:00.000Z') };

  it('crea la preferencia con el monto en pesos, la referencia, el aviso y el vencimiento', async () => {
    const fetch = responder(201, { id: 'pref-1', init_point: 'https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=pref-1' });
    const enlace = await new PasarelaMercadoPago(CONFIG).crearEnlace(solicitud);

    expect(enlace).toEqual({ referencia: 'pref-1', url: 'https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=pref-1' });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.mercadopago.com/checkout/preferences');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer TEST-token', 'X-Idempotency-Key': solicitud.pagoId });
    expect(JSON.parse(init.body as string)).toMatchObject({
      items: [{ title: 'Pedido #42', quantity: 1, unit_price: 47000, currency_id: 'COP' }],
      external_reference: solicitud.pagoId,
      notification_url: CONFIG.urlNotificacion,
      expires: true,
      expiration_date_to: '2026-11-13T16:00:00.000-05:00',
    });
  });

  it('no envía notification_url si la API no tiene dirección pública', async () => {
    const fetch = responder(201, { id: 'pref-1', init_point: 'https://mp.test/1' });
    await new PasarelaMercadoPago({ ...CONFIG, urlNotificacion: '' }).crearEnlace(solicitud);
    expect(JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string)).not.toHaveProperty('notification_url');
  });

  it('usa el enlace de pruebas si MercadoPago solo devuelve ese', async () => {
    responder(201, { id: 'pref-1', sandbox_init_point: 'https://sandbox.mp.test/1' });
    expect((await new PasarelaMercadoPago(CONFIG).crearEnlace(solicitud)).url).toBe('https://sandbox.mp.test/1');
  });

  it('falla si MercadoPago rechaza la preferencia', async () => {
    responder(401, { message: 'invalid access token' });
    await expect(new PasarelaMercadoPago(CONFIG).crearEnlace(solicitud)).rejects.toThrow('MercadoPago respondió 401');
  });

  it('traduce la consulta de un pago', async () => {
    const fetch = responder(200, { id: 123456, status: 'approved', transaction_amount: 47000, currency_id: 'COP', external_reference: solicitud.pagoId });
    expect(await new PasarelaMercadoPago(CONFIG).consultarPago('123456')).toEqual({
      id: '123456',
      estado: 'approved',
      monto: 47000,
      moneda: 'COP',
      pagoId: solicitud.pagoId,
    });
    expect(fetch.mock.calls[0][0]).toBe('https://api.mercadopago.com/v1/payments/123456');
  });

  it('devuelve null si el pago no existe', async () => {
    responder(404, { message: 'Payment not found' });
    expect(await new PasarelaMercadoPago(CONFIG).consultarPago('999')).toBeNull();
  });

  it('falla si MercadoPago no responde bien, para que el webhook pida reintento', async () => {
    responder(500, {});
    await expect(new PasarelaMercadoPago(CONFIG).consultarPago('1')).rejects.toThrow('MercadoPago respondió 500');
  });

  it('no deja que el id del aviso cambie la ruta consultada', async () => {
    const fetch = responder(404, {});
    await new PasarelaMercadoPago(CONFIG).consultarPago('../checkout/preferences');
    expect(fetch.mock.calls[0][0]).toBe('https://api.mercadopago.com/v1/payments/..%2Fcheckout%2Fpreferences');
  });
});
