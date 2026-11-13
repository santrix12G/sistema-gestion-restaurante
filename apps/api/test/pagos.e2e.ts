import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CrearEnlacePagoUseCase } from '../src/modules/pagos';
import { EnlaceCreado, PagoEnPasarela, Pasarela, PASARELA, SolicitudEnlace } from '../src/modules/pagos/application/pasarela';
import { configurarApp } from '../src/configurar-app';
import { leerConfig } from '../src/shared/config';
import { BusEventos, PagoEvento } from '../src/shared/eventos';
import { PrismaService } from '../src/shared/prisma.service';

// El valor lo pone test/setup-global.js
const SECRETO = 'secreto-de-mercadopago-de-pruebas';

/**
 * Hace el papel de MercadoPago sin salir a internet. Las pruebas deciden qué responde:
 * `pagos` es lo que devolvería GET /v1/payments/{id}.
 */
class PasarelaFalsa implements Pasarela {
  readonly nombre = 'mercadopago';
  readonly disponible = true;
  readonly solicitudes: SolicitudEnlace[] = [];
  readonly pagos = new Map<string, PagoEnPasarela>();
  fallarAlConsultar = false;

  async crearEnlace(solicitud: SolicitudEnlace): Promise<EnlaceCreado> {
    this.solicitudes.push(solicitud);
    return { referencia: `pref-${this.solicitudes.length}`, url: `https://pago.test/checkout/${solicitud.pagoId}` };
  }

  async consultarPago(id: string) {
    if (this.fallarAlConsultar) throw new Error('MercadoPago no responde');
    return this.pagos.get(id) ?? null;
  }
}

const pasarela = new PasarelaFalsa();
let app: INestApplication;
let prisma: PrismaService;
let enlaces: CrearEnlacePagoUseCase;
const eventos: PagoEvento[] = [];

const api = () => request(app.getHttpServer());

/** Envía un aviso como lo envía MercadoPago: data.id y type en la URL, y la firma en las cabeceras. */
function avisar(dataId: string, opciones: { secreto?: string; type?: string } = {}) {
  const ts = String(Math.floor(Date.now() / 1000));
  const requestId = `req-${dataId}-${Math.random()}`;
  const v1 = createHmac('sha256', opciones.secreto ?? SECRETO).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  const type = opciones.type ?? 'payment';
  return api()
    .post(`/api/webhooks/mercadopago?data.id=${dataId}&type=${type}`)
    .set('x-signature', `ts=${ts},v1=${v1}`)
    .set('x-request-id', requestId)
    .send({ type, action: 'payment.updated', data: { id: dataId } });
}

/** Crea un pedido real (lo registra el mesero) para tener algo que cobrar. */
async function nuevoPedido() {
  const login = await api().post('/api/auth/login').send({ email: 'mesero@restaurante.test', password: 'Staff-pruebas-1' });
  const mesa = await prisma.mesa.findFirstOrThrow({ where: { activa: true } });
  const gaseosa = await prisma.producto.findUniqueOrThrow({ where: { nombre: 'Gaseosa' } });
  const res = await api()
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${login.body.token}`)
    .send({ tipo: 'MESA', mesaId: mesa.id, items: [{ productoId: gaseosa.id, cantidad: 2 }] });
  expect(res.status).toBe(201);
  return { pedidoId: res.body.id as string, numero: res.body.numero as number, total: res.body.total as number };
}

/** Lo que MercadoPago diría de un intento de pago sobre el enlace. */
function intento(id: string, pagoId: string, estado: string, monto: number, moneda = 'COP') {
  pasarela.pagos.set(id, { id, estado, monto, moneda, pagoId });
}

beforeAll(async () => {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PASARELA).useValue(pasarela).compile();
  app = modulo.createNestApplication({ rawBody: true });
  configurarApp(app, leerConfig());
  await app.init();
  prisma = app.get(PrismaService);
  enlaces = app.get(CrearEnlacePagoUseCase);
  app.get(BusEventos).suscribir('pago.estado_cambiado', (e) => {
    eventos.push(e);
  });
});

afterAll(() => app.close());

beforeEach(() => {
  eventos.length = 0;
  pasarela.fallarAlConsultar = false;
});

/** El bus avisa a los suscriptores en el siguiente ciclo: se le da tiempo antes de revisar. */
const pausa = () => new Promise((r) => setTimeout(r, 50));

describe('enlace de pago', () => {
  it('crea un pago pendiente con el enlace de la pasarela', async () => {
    const pedido = await nuevoPedido();
    const enlace = await enlaces.ejecutar(pedido);

    expect(enlace.url).toBe(`https://pago.test/checkout/${enlace.pagoId}`);
    expect(pasarela.solicitudes.at(-1)).toMatchObject({ pagoId: enlace.pagoId, numeroPedido: pedido.numero, monto: pedido.total });
    expect(await prisma.pago.findUnique({ where: { id: enlace.pagoId } })).toMatchObject({
      pedidoId: pedido.pedidoId,
      metodo: 'ONLINE',
      estado: 'PENDIENTE',
      monto: pedido.total,
      proveedor: 'mercadopago',
      urlPago: enlace.url,
    });
  });

  it('si el cliente pide el enlace otra vez, devuelve el mismo sin crear otro cobro', async () => {
    const pedido = await nuevoPedido();
    const primero = await enlaces.ejecutar(pedido);
    const segundo = await enlaces.ejecutar(pedido);
    expect(segundo).toEqual(primero);
    expect(await prisma.pago.count({ where: { pedidoId: pedido.pedidoId } })).toBe(1);
  });

  it('crea un enlace nuevo cuando el anterior venció', async () => {
    const pedido = await nuevoPedido();
    const primero = await enlaces.ejecutar(pedido);
    const enUnaHora = new Date(Date.now() + 60 * 60_000);
    const segundo = await enlaces.ejecutar(pedido, enUnaHora);
    expect(segundo.pagoId).not.toBe(primero.pagoId);
  });
});

describe('webhook de MercadoPago', () => {
  it('rechaza avisos sin firma o firmados con otra clave', async () => {
    const sinFirma = await api().post('/api/webhooks/mercadopago?data.id=1&type=payment').send({ type: 'payment', data: { id: '1' } });
    const otraClave = await avisar('1', { secreto: 'otra-clave' });
    expect(sinFirma.status).toBe(403);
    expect(otraClave.status).toBe(403);
  });

  it('aprueba el pago cuando MercadoPago lo confirma, y avisa una sola vez aunque el aviso se repita', async () => {
    const pedido = await nuevoPedido();
    const { pagoId } = await enlaces.ejecutar(pedido);
    intento('mp-100', pagoId, 'approved', pedido.total);

    expect((await avisar('mp-100')).status).toBe(200);
    expect((await avisar('mp-100')).status).toBe(200);
    await pausa();

    expect((await prisma.pago.findUniqueOrThrow({ where: { id: pagoId } })).estado).toBe('APROBADO');
    expect(eventos).toEqual([{ pagoId, pedidoId: pedido.pedidoId, estado: 'APROBADO', estadoAnterior: 'PENDIENTE', monto: pedido.total }]);
    // El pedido sigue activo: lo cierra el personal al entregarlo
    expect((await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.pedidoId } })).estado).toBe('ACTIVO');
  });

  it('un rechazo seguido de un reintento aprobado deja el pago aprobado', async () => {
    const pedido = await nuevoPedido();
    const { pagoId } = await enlaces.ejecutar(pedido);
    intento('mp-200', pagoId, 'rejected', pedido.total);
    intento('mp-201', pagoId, 'approved', pedido.total);

    await avisar('mp-200');
    await avisar('mp-201');
    await avisar('mp-200'); // El rechazo llega otra vez, tarde
    await pausa();

    expect((await prisma.pago.findUniqueOrThrow({ where: { id: pagoId } })).estado).toBe('APROBADO');
    expect(eventos.map((e) => e.estado)).toEqual(['RECHAZADO', 'APROBADO']);
  });

  it('no aprueba un pago por un monto distinto al del pedido', async () => {
    const pedido = await nuevoPedido();
    const { pagoId } = await enlaces.ejecutar(pedido);
    intento('mp-300', pagoId, 'approved', 100);

    expect((await avisar('mp-300')).status).toBe(200);
    expect((await prisma.pago.findUniqueOrThrow({ where: { id: pagoId } })).estado).toBe('PENDIENTE');
  });

  it('confirma e ignora los avisos de pagos que no son de este sistema y los que no son de pagos', async () => {
    intento('mp-400', 'no-es-un-uuid', 'approved', 1000);
    expect((await avisar('mp-400')).status).toBe(200);
    expect((await avisar('mp-desconocido')).status).toBe(200);
    expect((await avisar('orden-1', { type: 'topic_merchant_order_wh' })).status).toBe(200);
    await pausa();
    expect(eventos).toEqual([]);
  });

  it('si MercadoPago no responde, devuelve error para que reintente', async () => {
    pasarela.fallarAlConsultar = true;
    expect((await avisar('mp-500')).status).toBe(500);
  });
});

describe('pago en línea desde WhatsApp', () => {
  const TELEFONO = '573009998877';
  const SECRETO_META = 'secreto-de-la-app-de-pruebas';

  /** Envía un mensaje del cliente como lo envía Meta, firmado. */
  function escribirPorWhatsApp(texto: string, id: string) {
    const cuerpo = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: { contacts: [{ wa_id: TELEFONO, profile: { name: 'Sofía' } }], messages: [{ from: TELEFONO, id, type: 'text', text: { body: texto } }] } }] }],
    });
    const firma = `sha256=${createHmac('sha256', SECRETO_META).update(cuerpo).digest('hex')}`;
    return api().post('/api/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', firma).send(cuerpo);
  }

  const salientes = async () =>
    (await prisma.mensaje.findMany({ where: { direccion: 'SALIENTE', conversacion: { cliente: { telefono: `+${TELEFONO}` } } }, orderBy: { creadoEn: 'asc' } })).map((m) => m.texto);

  /** El webhook de WhatsApp responde de inmediato y procesa después: se espera la respuesta del bot. */
  async function conversar(texto: string, id: string): Promise<string> {
    const antes = (await salientes()).length;
    expect((await escribirPorWhatsApp(texto, id)).status).toBe(200);
    for (let i = 0; i < 100; i++) {
      const lista = await salientes();
      if (lista.length > antes) return lista.slice(antes).join('\n');
      await pausa();
    }
    throw new Error(`El bot no respondió a "${texto}"`);
  }

  it('el cliente elige pagar en línea, recibe el enlace, paga y el bot se lo confirma', async () => {
    await conversar('hola', 'wamid.pago.1');
    await conversar('2 gaseosas', 'wamid.pago.2');
    expect(await conversar('listo', 'wamid.pago.3')).toMatch(/domicilio/i);
    expect(await conversar('para recoger', 'wamid.pago.4')).toMatch(/\*en línea\* para pagar ahora/);

    const confirmacion = await conversar('en línea', 'wamid.pago.5');
    expect(confirmacion).toMatch(/Pedido \*#\d+\* confirmado/);
    const url = confirmacion.match(/https:\/\/pago\.test\/checkout\/(\S+)/);
    expect(url).not.toBeNull();
    const pagoId = url![1];

    const pago = await prisma.pago.findUniqueOrThrow({ where: { id: pagoId }, include: { pedido: true } });
    expect(pago).toMatchObject({ estado: 'PENDIENTE', monto: pago.pedido.total });

    // El cliente paga en MercadoPago y llega el aviso
    intento('mp-whatsapp-1', pagoId, 'approved', pago.monto);
    const antes = (await salientes()).length;
    expect((await avisar('mp-whatsapp-1')).status).toBe(200);
    for (let i = 0; i < 100 && (await salientes()).length === antes; i++) await pausa();
    expect((await salientes()).at(-1)).toMatch(/Recibimos tu pago/);

    // El personal ve en el pedido que ya está pagado en línea
    const login = await api().post('/api/auth/login').send({ email: 'admin@restaurante.test', password: 'Admin-pruebas-1' });
    const { body: pedido } = await api().get(`/api/pedidos/${pago.pedidoId}`).set('Authorization', `Bearer ${login.body.token}`);
    expect(pedido.pagos).toEqual([{ estado: 'APROBADO' }]);
  });

  it('si el cliente responde "sí", el pedido queda en efectivo, sin enlace', async () => {
    await conversar('una gaseosa', 'wamid.pago.10');
    await conversar('listo', 'wamid.pago.11');
    await conversar('recoger', 'wamid.pago.12');
    const confirmacion = await conversar('sí', 'wamid.pago.13');
    expect(confirmacion).toMatch(/confirmado/);
    expect(confirmacion).not.toMatch(/pago\.test/);
  });
});
