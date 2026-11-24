import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { leerConfig } from '../../../shared/config';

const URL_VERIFICACION = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifica el captcha de Cloudflare Turnstile con la API de Cloudflare.
 * Sin TURNSTILE_SECRET_KEY no se exige (desarrollo y pruebas), igual que los demás servicios externos.
 */
@Injectable()
export class VerificadorCaptcha {
  private readonly logger = new Logger('Captcha');
  private readonly secreto = leerConfig().captcha.turnstileSecret;

  get activo() {
    return Boolean(this.secreto);
  }

  async exigir(respuesta: string | undefined) {
    if (!this.activo) return;
    if (!respuesta) throw new BadRequestException('Completa la verificación de seguridad');
    const cuerpo = new URLSearchParams({ secret: this.secreto, response: respuesta });
    let valido = false;
    try {
      const res = await fetch(URL_VERIFICACION, { method: 'POST', body: cuerpo, signal: AbortSignal.timeout(8000) });
      valido = res.ok && ((await res.json()) as { success?: boolean }).success === true;
    } catch (error) {
      this.logger.error(`No se pudo verificar el captcha: ${(error as Error).message}`);
    }
    if (!valido) throw new BadRequestException('La verificación de seguridad falló o venció. Inténtalo de nuevo');
  }
}
