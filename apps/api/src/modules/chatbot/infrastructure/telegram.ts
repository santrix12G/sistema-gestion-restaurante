import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { leerConfig } from '../../../shared/config';
import { ColaPorClave } from '../application/cola-por-clave';
import { EmisorTelegram, OpcionesTelegram } from '../application/puertos';
import { MensajeTelegram, RecibirTelegramUseCase } from '../application/recibir-telegram.use-case';
import { partirTexto } from './emisores';

/** Llama a un método de la API de bots de Telegram. */
async function llamarTelegram<T>(metodo: string, cuerpo: object = {}, cancelar?: AbortSignal): Promise<T> {
  const { token } = leerConfig().telegram;
  const respuesta = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: cancelar ?? AbortSignal.timeout(10_000),
  });
  const datos = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!datos.ok) throw new Error(`Telegram respondió ${respuesta.status}: ${datos.description ?? 'sin detalle'}`);
  return datos.result as T;
}

/** Los textos del bot usan *negrita* al estilo de WhatsApp; Telegram la recibe en HTML. */
export function aHtmlTelegram(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
}

// Solo los campos que usa el bot
interface ActualizacionTelegram {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; last_name?: string };
    chat: { id: number; type: string };
    text?: string;
    contact?: { phone_number: string; user_id?: number };
  };
}

export function leerActualizacion(a: ActualizacionTelegram): MensajeTelegram | undefined {
  const m = a.message;
  if (!m?.from) return undefined;
  const nombre = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') || undefined;
  return {
    chatId: String(m.chat.id),
    privado: m.chat.type === 'private',
    mensajeId: String(m.message_id),
    usuarioId: String(m.from.id),
    nombre,
    texto: m.text,
    contacto: m.contact && { telefono: m.contact.phone_number, usuarioId: m.contact.user_id === undefined ? undefined : String(m.contact.user_id) },
  };
}

/** Sin TELEGRAM_BOT_TOKEN no envía nada. Lo usan las pruebas. */
@Injectable()
export class EmisorTelegramSimulado implements EmisorTelegram {
  async enviarTexto() {}
}

@Injectable()
export class EmisorTelegramBot implements EmisorTelegram {
  async enviarTexto(chatId: string, texto: string, opciones: OpcionesTelegram = {}) {
    const partes = partirTexto(texto, 4000);
    for (const [i, parte] of partes.entries()) {
      const ultima = i === partes.length - 1;
      await llamarTelegram('sendMessage', {
        chat_id: chatId,
        text: aHtmlTelegram(parte),
        parse_mode: 'HTML',
        reply_markup: ultima ? teclado(opciones) : undefined,
      });
    }
  }
}

function teclado({ pedirContacto, quitarTeclado }: OpcionesTelegram) {
  if (pedirContacto) {
    return { keyboard: [[{ text: '📱 Compartir mi número', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
  }
  return quitarTeclado ? { remove_keyboard: true } : undefined;
}

/**
 * Le pregunta a Telegram por mensajes nuevos (long polling). No necesita una dirección pública ni ngrok.
 * Solo debe haber una API sondeando el mismo bot: si hay dos, Telegram responde con un conflicto.
 */
@Injectable()
export class SondeoTelegram implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Telegram');
  private readonly cola = new ColaPorClave();
  private activo = false;
  private detener = new AbortController();
  private siguiente = 0;

  constructor(private readonly recibir: RecibirTelegramUseCase) {}

  onApplicationBootstrap() {
    if (!leerConfig().telegram.token) return;
    this.activo = true;
    void this.escuchar();
  }

  onApplicationShutdown() {
    this.activo = false;
    this.detener.abort();
  }

  private async escuchar() {
    try {
      // Con un webhook registrado, Telegram no entrega mensajes por sondeo
      await llamarTelegram('deleteWebhook');
      const bot = await llamarTelegram<{ username: string }>('getMe');
      this.logger.log(`Bot de Telegram @${bot.username} escuchando mensajes`);
    } catch (e) {
      this.logger.error(`No se pudo conectar con Telegram. Revisa TELEGRAM_BOT_TOKEN. ${e instanceof Error ? e.message : e}`);
    }

    while (this.activo) {
      try {
        const actualizaciones = await llamarTelegram<ActualizacionTelegram[]>(
          'getUpdates',
          { offset: this.siguiente, timeout: 25, allowed_updates: ['message'] },
          AbortSignal.any([this.detener.signal, AbortSignal.timeout(40_000)]),
        );
        for (const a of actualizaciones) {
          this.siguiente = a.update_id + 1;
          const mensaje = leerActualizacion(a);
          if (!mensaje) continue;
          // En orden por chat, sin que un cliente haga esperar a los demás
          this.cola.ejecutar(mensaje.chatId, () => this.recibir.ejecutar(mensaje)).catch((e) =>
            this.logger.error('Falló el procesamiento de un mensaje', e instanceof Error ? e.stack : e),
          );
        }
      } catch (e) {
        if (!this.activo) break;
        const detalle = e instanceof Error ? e.message : String(e);
        this.logger.warn(detalle.includes('409') ? 'Otra API está recibiendo los mensajes de este bot. Deja solo una encendida' : `Error al consultar Telegram: ${detalle}`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
}
