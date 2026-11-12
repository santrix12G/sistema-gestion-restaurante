import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { io } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EMISOR_TELEGRAM, EmisorTelegram } from '../src/modules/chatbot/application/puertos';
import { RecibirTelegramUseCase } from '../src/modules/chatbot/application/recibir-telegram.use-case';
import { firmaTwilio } from '../src/modules/chatbot/infrastructure/webhook-twilio.controller';
import { configurarApp } from '../src/configurar-app';
import { leerConfig } from '../src/shared/config';
import { PrismaService } from '../src/shared/prisma.service';

// Los valores de META_* los pone test/setup-global.js
const SECRETO = 'secreto-de-la-app-de-pruebas';
const TELEFONO = '573001112233';

let app: INestApplication;
let prisma: PrismaService;
let puerto: number;
const tokens: Record<string, string> = {};

const api = () => request(app.getHttpServer());
const como = (rol: string) => ({ Authorization: `Bearer ${tokens[rol]}` });

/** Arma un aviso de Meta como el que llega cuando un cliente escribe. */
function aviso(texto: string, id: string, from = TELEFONO) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WABA',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15550000000', phone_number_id: '123' },
          contacts: [{ wa_id: from, profile: { name: 'Laura' } }],
          messages: [{ from, id, timestamp: '1700000000', type: 'text', text: { body: texto } }],
        },
      }],
    }],
  };
}

function firmar(cuerpo: string, secreto = SECRETO) {
  return `sha256=${createHmac('sha256', secreto).update(cuerpo).digest('hex')}`;
}

const enviarAviso = (cuerpo: object) => {
  const texto = JSON.stringify(cuerpo);
  return api().post('/api/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', firmar(texto)).send(texto);
};

/** El webhook responde de inmediato y procesa después: se espera a que aparezca la respuesta. */
async function esperar<T>(consulta: () => Promise<T | null | undefined | false>, ms = 5000): Promise<T> {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const valor = await consulta();
    if (valor) return valor;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Se agotó el tiempo de espera');
}

const salientes = (telefono = `+${TELEFONO}`) =>
  prisma.mensaje.findMany({ where: { direccion: 'SALIENTE', conversacion: { cliente: { telefono } } }, orderBy: { creadoEn: 'asc' } });

/** Envía un mensaje y espera la respuesta del bot. */
async function escribir(texto: string, id: string) {
  const antes = (await salientes()).length;
  expect((await enviarAviso(aviso(texto, id))).status).toBe(200);
  const despues = await esperar(async () => {
    const lista = await salientes();
    return lista.length > antes && lista;
  });
  return despues.slice(antes).map((m) => m.texto).join('\n');
}

beforeAll(async () => {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = modulo.createNestApplication({ rawBody: true });
  configurarApp(app, leerConfig());
  await app.listen(0);
  puerto = (app.getHttpServer().address() as AddressInfo).port;
  prisma = app.get(PrismaService);

  for (const [rol, password] of [['admin', 'Admin-pruebas-1'], ['mesero', 'Staff-pruebas-1'], ['repartidor', 'Staff-pruebas-1']]) {
    const res = await api().post('/api/auth/login').send({ email: `${rol}@restaurante.test`, password });
    tokens[rol] = res.body.token;
  }
});

afterAll(() => app.close());

describe('webhook de WhatsApp', () => {
  it('responde la verificación de Meta solo con el token correcto', async () => {
    const ok = await api().get('/api/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'token-de-verificacion-de-pruebas', 'hub.challenge': '12345' });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe('12345');

    const mal = await api().get('/api/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'otro', 'hub.challenge': '12345' });
    expect(mal.status).toBe(403);
  });

  it('rechaza avisos sin firma o con una firma falsa', async () => {
    const texto = JSON.stringify(aviso('hola', 'wamid.falso'));
    const sinFirma = await api().post('/api/webhooks/whatsapp').set('Content-Type', 'application/json').send(texto);
    const falsa = await api().post('/api/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', firmar(texto, 'otro-secreto')).send(texto);
    expect(sinFirma.status).toBe(403);
    expect(falsa.status).toBe(403);
    expect(await prisma.mensaje.findUnique({ where: { waMessageId: 'wamid.falso' } })).toBeNull();
  });

  it('toma un pedido a domicilio de principio a fin y avisa al cliente de cada estado', async () => {
    expect(await escribir('hola', 'wamid.1')).toMatch(/Bienvenid|Hola/i);
    expect(await escribir('2 hamburguesas con queso, una sin cebolla, y una limonada', 'wamid.2')).toMatch(/Hamburguesa con queso/);
    expect(await escribir('listo', 'wamid.3')).toMatch(/domicilio/i);
    await escribir('a domicilio', 'wamid.4');
    expect(await escribir('Calle 15 # 8-22, barrio Centro', 'wamid.5')).toContain('*Total: $53.000*');
    expect(await escribir('sí', 'wamid.6')).toMatch(/Pedido \*#\d+\* confirmado/);

    const pedido = await prisma.pedido.findFirstOrThrow({
      where: { canal: 'WHATSAPP', cliente: { telefono: `+${TELEFONO}` } },
      include: { detalles: true, entrega: true, cliente: true },
    });
    expect(pedido).toMatchObject({ tipo: 'DOMICILIO', estado: 'ACTIVO', total: 53000 });
    expect(pedido.cliente?.nombre).toBe('Laura');
    expect(pedido.entrega?.direccionTexto).toBe('Calle 15 # 8-22, barrio Centro');
    expect(pedido.detalles.map((d) => d.notas).sort()).toEqual([null, null, 'sin cebolla']);

    const cambiar = (rol: string, estado: string) => api().patch(`/api/pedidos/${pedido.id}/estado`).set(como(rol)).send({ estado });
    const ultimo = async (patron: RegExp) => esperar(async () => (await salientes()).at(-1)?.texto.match(patron));
    const tomar = (rol: string) => api().post(`/api/pedidos/${pedido.id}/tomar`).set(como(rol));
    const ids = async (rol: string, estados = '') => (await api().get(`/api/pedidos${estados && `?estados=${estados}`}`).set(como(rol))).body.map((p: { id: string }) => p.id);
    // El repartidor lo ve entre los disponibles; el mesero no, porque no lo registró
    expect(await ids('repartidor')).toContain(pedido.id);
    expect(await ids('mesero')).not.toContain(pedido.id);
    expect((await api().get(`/api/pedidos/${pedido.id}`).set(como('mesero'))).status).toBe(404);
    // El domicilio lo cierra el repartidor que lo lleva, no un mesero
    expect((await cambiar('mesero', 'PAGADO')).status).toBe(403);
    expect((await cambiar('repartidor', 'PAGADO')).body.mensaje).toMatch(/Primero toma/);
    expect((await tomar('mesero')).status).toBe(403);
    expect((await tomar('repartidor')).status).toBe(201);
    await ultimo(/va en camino con Repartidor/);
    expect((await tomar('repartidor')).status).toBe(409);
    // Quien lo saca a reparto queda a cargo, y la app le muestra barrio y referencia
    const { body: yo } = await api().get('/api/auth/yo').set(como('repartidor'));
    const { body: enCamino } = await api().get(`/api/pedidos/${pedido.id}`).set(como('repartidor'));
    expect(enCamino).toMatchObject({ estado: 'ACTIVO', creadoPor: null });
    expect(enCamino.entrega.repartidor).toEqual({ id: yo.id, nombre: yo.nombre });
    expect(Object.keys(enCamino.entrega.direccion).sort()).toEqual(['barrio', 'referencia']);
    expect((await cambiar('repartidor', 'PAGADO')).body.estado).toBe('PAGADO');
    await ultimo(/entregado/);
    // Queda en el historial del día del repartidor que lo llevó
    expect(await ids('repartidor')).not.toContain(pedido.id);
    expect(await ids('repartidor', 'PAGADO,CANCELADO')).toContain(pedido.id);

    const entrega = await prisma.entrega.findUniqueOrThrow({ where: { pedidoId: pedido.id } });
    expect(entrega.estado).toBe('ENTREGADA');
  });

  it('no procesa dos veces el mismo mensaje cuando Meta lo reenvía', async () => {
    const telefono = '573004445566';
    await Promise.all([enviarAviso(aviso('una limonada', 'wamid.repetido', telefono)), enviarAviso(aviso('una limonada', 'wamid.repetido', telefono))]);
    await esperar(async () => (await salientes(`+${telefono}`)).length > 0);
    await new Promise((r) => setTimeout(r, 300));
    expect(await prisma.mensaje.count({ where: { waMessageId: 'wamid.repetido' } })).toBe(1);
    expect(await salientes(`+${telefono}`)).toHaveLength(1);
  });
});

describe('webhook de Twilio', () => {
  const TOKEN_TWILIO = 'token-de-twilio-de-pruebas';
  const telefono = '573005556677';
  let sid = 0;

  /** Envía un aviso como el de Twilio: formulario con From "whatsapp:+57…" y la firma X-Twilio-Signature. */
  function avisoTwilio(texto: string, opciones: { firma?: string; protocolo?: string } = {}) {
    const parametros = {
      MessageSid: `SM${++sid}`,
      AccountSid: 'AC-pruebas',
      From: `whatsapp:+${telefono}`,
      To: 'whatsapp:+14155238886',
      Body: texto,
      NumMedia: '0',
      ProfileName: 'Andrés',
      WaId: telefono,
    };
    const protocolo = opciones.protocolo ?? 'http';
    const url = `${protocolo}://127.0.0.1:${puerto}/api/webhooks/twilio`;
    const peticion = api().post('/api/webhooks/twilio').type('form').set('X-Twilio-Signature', opciones.firma ?? firmaTwilio(url, parametros, TOKEN_TWILIO));
    if (opciones.protocolo) peticion.set('X-Forwarded-Proto', opciones.protocolo);
    return peticion.send(parametros);
  }

  async function escribirPorTwilio(texto: string, protocolo?: string) {
    const antes = (await salientes(`+${telefono}`)).length;
    const res = await avisoTwilio(texto, { protocolo });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    const lista = await esperar(async () => {
      const todos = await salientes(`+${telefono}`);
      return todos.length > antes && todos;
    });
    return lista.slice(antes).map((m) => m.texto).join('\n');
  }

  it('rechaza avisos sin firma o con una firma falsa', async () => {
    expect((await api().post('/api/webhooks/twilio').type('form').send({ From: `whatsapp:+${telefono}`, Body: 'hola', MessageSid: 'SMx' })).status).toBe(403);
    expect((await avisoTwilio('hola', { firma: 'firma-falsa' })).status).toBe(403);
  });

  it('toma un pedido para recoger, también detrás de un túnel HTTPS como ngrok', async () => {
    expect(await escribirPorTwilio('una limonada para recoger')).toMatch(/Limonada natural/);
    expect(await escribirPorTwilio('listo', 'https')).toMatch(/Lo confirmo/);
    expect(await escribirPorTwilio('sí')).toMatch(/confirmado/);

    const pedido = await prisma.pedido.findFirstOrThrow({ where: { cliente: { telefono: `+${telefono}` } }, include: { cliente: true } });
    expect(pedido).toMatchObject({ canal: 'WHATSAPP', tipo: 'RECOGER', total: 6000 });
    expect(pedido.cliente?.nombre).toBe('Andrés');
  });
});

describe('Telegram', () => {
  const chatId = '700100200';
  let mensajeId = 0;
  let enviados: jest.SpyInstance;

  beforeAll(() => {
    enviados = jest.spyOn(app.get<EmisorTelegram>(EMISOR_TELEGRAM), 'enviarTexto');
  });

  const recibir = (datos: { texto?: string; contacto?: { telefono: string; usuarioId?: string } }) =>
    app.get(RecibirTelegramUseCase).ejecutar({ chatId, privado: true, mensajeId: String(++mensajeId), usuarioId: chatId, nombre: 'Camila', ...datos });
  const ultimoEnviado = () => enviados.mock.calls.at(-1) as [string, string, { pedirContacto?: boolean; quitarTeclado?: boolean }?];

  it('pide el número antes de tomar pedidos', async () => {
    await recibir({ texto: '/start' });
    expect(ultimoEnviado()).toEqual([chatId, expect.stringMatching(/Compartir mi número/), { pedirContacto: true }]);
    expect(await prisma.cliente.findUnique({ where: { telegramChatId: chatId } })).toBeNull();
  });

  it('no acepta el contacto de otra persona', async () => {
    await recibir({ contacto: { telefono: '573008889900', usuarioId: '999' } });
    expect(ultimoEnviado()[1]).toMatch(/tu\* número/);
    expect(await prisma.cliente.findUnique({ where: { telegramChatId: chatId } })).toBeNull();
  });

  it('vincula el chat al compartir el número y toma un pedido', async () => {
    await recibir({ contacto: { telefono: '573008889900', usuarioId: chatId } });
    expect(ultimoEnviado()[2]).toEqual({ quitarTeclado: true });
    const cliente = await prisma.cliente.findUniqueOrThrow({ where: { telegramChatId: chatId } });
    expect(cliente).toMatchObject({ telefono: '+573008889900', nombre: 'Camila' });

    await recibir({ texto: 'una limonada para recoger' });
    await recibir({ texto: 'listo' });
    await recibir({ texto: 'sí' });
    expect(ultimoEnviado()).toEqual([chatId, expect.stringMatching(/Pedido \*#\d+\* confirmado/)]);

    const pedido = await prisma.pedido.findFirstOrThrow({ where: { clienteId: cliente.id } });
    expect(pedido).toMatchObject({ canal: 'TELEGRAM', tipo: 'RECOGER', total: 6000 });
    const conversacion = await prisma.conversacion.findUniqueOrThrow({ where: { clienteId_canal: { clienteId: cliente.id, canal: 'TELEGRAM' } }, include: { mensajes: true } });
    expect(conversacion.mensajes.filter((m) => m.direccion === 'SALIENTE')).toHaveLength(3);

    // Los pedidos del chatbot para recoger los cierra el administrador, y el aviso llega por Telegram
    const cobrar = (rol: string) => api().patch(`/api/pedidos/${pedido.id}/estado`).set(como(rol)).send({ estado: 'PAGADO' });
    expect((await cobrar('mesero')).status).toBe(403);
    expect((await cobrar('admin')).status).toBe(200);
    await esperar(async () => ultimoEnviado()[1].includes('Gracias por recoger'));
    expect(ultimoEnviado()[0]).toBe(chatId);
  });

  it('recibe por webhook solo con el secreto de Telegram', async () => {
    const actualizacion = {
      update_id: 900,
      message: { message_id: 1, from: { id: 800 }, chat: { id: 800, type: 'private' }, contact: { phone_number: '573007770011', user_id: 800 } },
    };
    expect((await api().post('/api/webhooks/telegram').send(actualizacion)).status).toBe(403);
    expect((await api().post('/api/webhooks/telegram').set('X-Telegram-Bot-Api-Secret-Token', 'otro-secreto').send(actualizacion)).status).toBe(403);

    const res = await api().post('/api/webhooks/telegram').set('X-Telegram-Bot-Api-Secret-Token', 'secreto-de-telegram-de-pruebas').send(actualizacion);
    expect(res.status).toBe(200);
    const cliente = await esperar(() => prisma.cliente.findUnique({ where: { telegramChatId: '800' } }));
    expect(cliente.telefono).toBe('+573007770011');
  });
});

describe('salud', () => {
  it('responde sin sesión', async () => {
    expect((await api().get('/api/salud')).body).toEqual({ estado: 'ok' });
  });
});

describe('simulador retirado', () => {
  it('ya no existe la ruta del simulador', async () => {
    expect((await api().post('/api/chatbot/simulador').set(como('admin')).send({ telefono: '3009998877', texto: 'hola' })).status).toBe(404);
  });
});

describe('tiempo real', () => {
  const conectar = (token?: string) => io(`http://localhost:${puerto}`, { auth: { token }, transports: ['websocket'], reconnection: false });

  it('rechaza la conexión sin una sesión válida', async () => {
    const socket = conectar('token-falso');
    await new Promise<void>((resolve) => socket.on('disconnect', () => resolve()));
    socket.close();
  });

  it('avisa al personal cuando entra un pedido', async () => {
    const socket = conectar(tokens.mesero);
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    const avisoPedido = new Promise<{ motivo: string; canal: string }>((resolve) => socket.on('pedido', resolve));
    // La sala se asigna después de validar el token
    await new Promise((r) => setTimeout(r, 200));

    // Un cliente pide por WhatsApp (Meta); cada mensaje espera la respuesta del bot antes del siguiente
    const cliente = '573007776655';
    for (const [i, texto] of ['una gaseosa para recoger', 'listo', 'si'].entries()) {
      const antes = (await salientes(`+${cliente}`)).length;
      expect((await enviarAviso(aviso(texto, `wamid.tiempo-real-${i}`, cliente))).status).toBe(200);
      await esperar(async () => (await salientes(`+${cliente}`)).length > antes);
    }

    expect(await avisoPedido).toMatchObject({ motivo: 'creado', canal: 'WHATSAPP' });
    socket.close();
  });
});
