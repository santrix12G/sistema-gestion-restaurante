import { Injectable, Logger } from '@nestjs/common';
import { leerConfig } from '../../../shared/config';
import { EmisorWhatsApp } from '../application/puertos';

/** WhatsApp sin conectar: no envía nada. El bot sigue atendiendo por Telegram si tiene token. */
@Injectable()
export class EmisorSimulado implements EmisorWhatsApp {
  async enviarTexto() {}
}

/** Envía por la API de WhatsApp Cloud de Meta. */
@Injectable()
export class EmisorMeta implements EmisorWhatsApp {
  private readonly logger = new Logger('WhatsApp');
  private readonly config = leerConfig().whatsapp;

  async enviarTexto(telefono: string, texto: string) {
    const url = `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`;
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: telefono,
        type: 'text',
        text: { preview_url: false, body: texto },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!respuesta.ok) {
      // Meta explica el motivo en el cuerpo: token vencido, número no autorizado, fuera de la ventana de 24 horas…
      const detalle = await respuesta.text().catch(() => '');
      this.logger.warn(`Meta respondió ${respuesta.status}: ${detalle.slice(0, 500)}`);
      throw new Error(`WhatsApp respondió ${respuesta.status}`);
    }
  }
}

/** WhatsApp no acepta más de 1600 caracteres por mensaje en Twilio: los textos largos se parten por líneas. */
export function partirTexto(texto: string, maximo = 1600): string[] {
  const partes: string[] = [];
  let actual = '';
  for (const linea of texto.split('\n')) {
    const candidato = actual ? `${actual}\n${linea}` : linea;
    if (candidato.length <= maximo) {
      actual = candidato;
      continue;
    }
    if (actual) partes.push(actual);
    actual = linea;
    // Una sola línea más larga que el máximo se corta a la fuerza
    while (actual.length > maximo) {
      partes.push(actual.slice(0, maximo));
      actual = actual.slice(maximo);
    }
  }
  if (actual) partes.push(actual);
  return partes;
}

/** Envía por la API de mensajes de Twilio, que a su vez entrega por WhatsApp. */
@Injectable()
export class EmisorTwilio implements EmisorWhatsApp {
  private readonly logger = new Logger('Twilio');
  private readonly config = leerConfig().whatsapp.twilio;

  async enviarTexto(telefono: string, texto: string) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
    const credenciales = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');
    for (const parte of partirTexto(texto)) {
      const respuesta = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${credenciales}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: `whatsapp:${this.config.numero}`, To: `whatsapp:${telefono}`, Body: parte }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!respuesta.ok) {
        // Twilio explica el motivo: credenciales, número que no se unió al Sandbox, fuera de la ventana de 24 horas…
        const detalle = await respuesta.text().catch(() => '');
        this.logger.warn(`Twilio respondió ${respuesta.status}: ${detalle.slice(0, 500)}`);
        throw new Error(`Twilio respondió ${respuesta.status}`);
      }
    }
  }
}
