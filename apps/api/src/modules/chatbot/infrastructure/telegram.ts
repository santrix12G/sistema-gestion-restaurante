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
export interface ActualizacionTelegram {
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
 * Conecta el bot con Telegram de una de dos formas:
 * - Sondeo (por defecto): la API le pregunta a Telegram por mensajes nuevos. No necesita dirección pública ni ngrok.
 * - Webhook (con TELEGRAM_WEBHOOK_SECRET): Telegram llama a la API. En Render gratis, ese llamado la despierta.
 * Solo debe haber una API conectada al mismo bot: si hay dos, se quitan los mensajes entre sí.
 */
@Injectable()
export class CanalTelegram implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Telegram');
  private readonly config = leerConfig().telegram;
  private readonly cola = new ColaPorClave();
  private activo = false;
  private detener = new AbortController();
  private siguiente = 0;

  constructor(private readonly recibir: RecibirTelegramUseCase) {}

  onApplicationBootstrap() {
    if (!this.config.token) return;
    this.activo = true;
    void (this.config.secretoWebhook ? this.registrarWebhook() : this.sondear());
  }

  onApplicationShutdown() {
    this.activo = false;
    this.detener.abort();
  }

  /** Procesa un mensaje en orden por chat, sin que un cliente haga esperar a los demás. */
  entregar(actualizacion: ActualizacionTelegram) {
    const mensaje = leerActualizacion(actualizacion);
    if (!mensaje) return;
    this.cola.ejecutar(mensaje.chatId, () => this.recibir.ejecutar(mensaje)).catch((e) =>
      this.logger.error('Falló el procesamiento de un mensaje', e instanceof Error ? e.stack : e),
    );
  }

  private async registrarWebhook() {
    const url = `${this.config.urlPublica}/api/webhooks/telegram`;
    try {
      await llamarTelegram('setWebhook', { url, secret_token: this.config.secretoWebhook, allowed_updates: ['message'] });
      const bot = await llamarTelegram<{ username: string }>('getMe');
      this.logger.log(`Bot de Telegram @${bot.username} recibe mensajes en ${url}`);
    } catch (e) {
      this.logger.error(`No se pudo registrar el webhook de Telegram. ${e instanceof Error ? e.message : e}`);
    }
  }

  private async sondear() {
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
          this.entregar(a);
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
