import { Injectable, Logger } from '@nestjs/common';
import { leerConfig } from '../../../shared/config';

export interface MensajeCorreo {
  para: string;
  nombre: string;
  asunto: string;
  html: string;
  texto: string;
}

/**
 * Envía correos con la API HTTP de Brevo. Se usa HTTP y no SMTP porque los servicios gratis
 * de Render bloquean los puertos SMTP. Sin BREVO_API_KEY no se envía nada: fuera de producción
 * el mensaje se escribe en el log para poder probar el flujo.
 */
@Injectable()
export class EnviadorCorreo {
  private readonly logger = new Logger('Correo');
  private readonly config = leerConfig().correo;

  async enviar(mensaje: MensajeCorreo) {
    if (!this.config.brevoApiKey) {
      if (process.env.NODE_ENV === 'production') this.logger.warn('No hay BREVO_API_KEY: el correo no se envió');
      else this.logger.log(`[sin enviar] Para ${mensaje.para}: ${mensaje.asunto}\n${mensaje.texto}`);
      return;
    }
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': this.config.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: this.config.remitente, name: this.config.nombreRemitente },
        to: [{ email: mensaje.para, name: mensaje.nombre }],
        subject: mensaje.asunto,
        htmlContent: mensaje.html,
        textContent: mensaje.texto,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Brevo respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}
