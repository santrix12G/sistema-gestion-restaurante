import { RecibirTelegramUseCase } from '../application/recibir-telegram.use-case';
import { aHtmlTelegram, leerActualizacion, SondeoTelegram } from './telegram';

describe('adaptador de Telegram', () => {
  it('pasa la negrita a HTML y escapa lo demás', () => {
    expect(aHtmlTelegram('*Total: $53.000* <b> & listo')).toBe('<b>Total: $53.000</b> &lt;b&gt; &amp; listo');
  });

  it('lee un mensaje de texto', () => {
    const mensaje = leerActualizacion({
      update_id: 1,
      message: { message_id: 7, from: { id: 42, first_name: 'Ana', last_name: 'Gómez' }, chat: { id: 42, type: 'private' }, text: 'hola' },
    });
    expect(mensaje).toEqual({ chatId: '42', privado: true, mensajeId: '7', usuarioId: '42', nombre: 'Ana Gómez', texto: 'hola', contacto: undefined });
  });

  it('lee el contacto compartido con el botón', () => {
    const mensaje = leerActualizacion({
      update_id: 2,
      message: { message_id: 8, from: { id: 42 }, chat: { id: 42, type: 'private' }, contact: { phone_number: '573001234567', user_id: 42 } },
    });
    expect(mensaje?.contacto).toEqual({ telefono: '573001234567', usuarioId: '42' });
  });

  it('ignora actualizaciones sin mensaje', () => {
    expect(leerActualizacion({ update_id: 3 })).toBeUndefined();
  });
});

describe('sondeo de Telegram', () => {
  const entornoOriginal = { ...process.env };
  afterEach(() => {
    process.env = { ...entornoOriginal };
    jest.restoreAllMocks();
  });

  it('pide los mensajes nuevos, avanza el offset y entrega cada mensaje al bot', async () => {
    Object.assign(process.env, { JWT_SECRET: 'x'.repeat(32), DATABASE_URL: 'postgresql://sin-uso', TELEGRAM_BOT_TOKEN: 'token-falso' });
    const pedidos: { metodo: string; cuerpo: { offset?: number } }[] = [];
    let entregas = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const metodo = String(url).split('/').pop()!;
      const cuerpo = JSON.parse(String(init?.body ?? '{}'));
      pedidos.push({ metodo, cuerpo });
      let result: unknown = true;
      if (metodo === 'getMe') result = { username: 'restaurante_bot' };
      if (metodo === 'getUpdates') {
        entregas++;
        result = entregas === 1
          ? [{ update_id: 10, message: { message_id: 1, from: { id: 5 }, chat: { id: 5, type: 'private' }, text: 'hola' } }]
          : await new Promise((_, rechazar) => init?.signal?.addEventListener('abort', () => rechazar(new Error('cancelado'))));
      }
      return new Response(JSON.stringify({ ok: true, result }));
    });
    const recibir = { ejecutar: jest.fn().mockResolvedValue(undefined) };
    const sondeo = new SondeoTelegram(recibir as unknown as RecibirTelegramUseCase);

    sondeo.onApplicationBootstrap();
    await new Promise((r) => setTimeout(r, 50));
    sondeo.onApplicationShutdown();

    expect(pedidos.map((p) => p.metodo)).toEqual(['deleteWebhook', 'getMe', 'getUpdates', 'getUpdates']);
    expect(pedidos[3].cuerpo.offset).toBe(11);
    expect(recibir.ejecutar).toHaveBeenCalledWith(expect.objectContaining({ chatId: '5', texto: 'hola' }));
  });
});
