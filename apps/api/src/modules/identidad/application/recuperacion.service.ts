import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { leerConfig } from '../../../shared/config';
import { DomainError } from '../../../shared/domain-error';
import { PrismaService } from '../../../shared/prisma.service';
import { normalizarEmail, validarContrasena } from '../domain/personal';
import { generarTokenRecuperacion, hashToken, MINUTOS_ENLACE_RECUPERACION, ocultarEmail } from '../domain/sesion';
import { EnviadorCorreo } from '../infrastructure/correo';

export type Idioma = 'es' | 'en';

const ENLACE_INVALIDO = 'El enlace no es válido o ya venció. Pide uno nuevo';

/** «¿Olvidaste tu contraseña?»: envía un enlace de un solo uso y, con él, deja poner una contraseña nueva. */
@Injectable()
export class RecuperacionService {
  private readonly logger = new Logger('Recuperacion');
  private readonly urlWeb = leerConfig().urlWeb;

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: EnviadorCorreo,
  ) {}

  /**
   * Siempre responde igual, exista o no la cuenta, para no revelar qué correos están registrados.
   * Un enlace nuevo anula los anteriores que no se usaron.
   */
  async solicitar(email: string, idioma: Idioma = 'es') {
    const usuario = await this.prisma.usuario.findUnique({ where: { email: normalizarEmail(email) } });
    if (usuario?.activo) {
      const token = generarTokenRecuperacion();
      const ahora = new Date();
      await this.prisma.$transaction([
        this.prisma.tokenRecuperacion.updateMany({ where: { usuarioId: usuario.id, usadoEn: null }, data: { usadoEn: ahora } }),
        this.prisma.tokenRecuperacion.create({
          data: { usuarioId: usuario.id, tokenHash: hashToken(token), expiraEn: new Date(ahora.getTime() + MINUTOS_ENLACE_RECUPERACION * 60_000) },
        }),
      ]);
      const enlace = `${this.urlWeb}/restablecer?token=${token}`;
      try {
        await this.correo.enviar({ para: usuario.email, nombre: usuario.nombre, ...correoRecuperacion(usuario.nombre, enlace, idioma) });
        this.logger.log(`Enlace de recuperación enviado a ${ocultarEmail(usuario.email)}`);
      } catch (error) {
        // No se le dice a quien lo pidió: revelaría que la cuenta existe
        this.logger.error(`No se pudo enviar el enlace a ${ocultarEmail(usuario.email)}: ${(error as Error).message}`);
      }
    }
    return { mensaje: 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña' };
  }

  /** Pone la contraseña nueva, gasta el enlace y cierra las sesiones abiertas en otros equipos */
  async restablecer(token: string, password: string) {
    const guardado = await this.prisma.tokenRecuperacion.findUnique({ where: { tokenHash: hashToken(token) }, include: { usuario: true } });
    if (!guardado || guardado.usadoEn || guardado.expiraEn < new Date() || !guardado.usuario.activo) throw new DomainError('validacion', ENLACE_INVALIDO);
    validarContrasena(password);
    const passwordHash = await bcrypt.hash(password, 10);
    const ahora = new Date();
    // El updateMany con usadoEn: null evita que dos peticiones simultáneas usen el mismo enlace
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.tokenRecuperacion.updateMany({ where: { id: guardado.id, usadoEn: null }, data: { usadoEn: ahora } });
      if (count === 0) throw new DomainError('validacion', ENLACE_INVALIDO);
      await tx.usuario.update({ where: { id: guardado.usuarioId }, data: { passwordHash, sesionesDesde: ahora } });
    });
    this.logger.log(`Contraseña restablecida para ${ocultarEmail(guardado.usuario.email)}`);
    return { mensaje: 'Listo. Ya puedes iniciar sesión con tu nueva contraseña' };
  }
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function correoRecuperacion(nombre: string, enlace: string, idioma: Idioma) {
  const t =
    idioma === 'en'
      ? {
          asunto: 'Reset your password',
          saludo: `Hi ${nombre},`,
          cuerpo: 'We received a request to reset your password. Use this link to choose a new one:',
          boton: 'Reset password',
          vence: `The link works once and expires in ${MINUTOS_ENLACE_RECUPERACION} minutes.`,
          ignora: "If you didn't ask for this, you can ignore this email: your password won't change.",
        }
      : {
          asunto: 'Restablece tu contraseña',
          saludo: `Hola, ${nombre}:`,
          cuerpo: 'Recibimos una solicitud para restablecer tu contraseña. Usa este enlace para elegir una nueva:',
          boton: 'Restablecer contraseña',
          vence: `El enlace sirve una sola vez y vence en ${MINUTOS_ENLACE_RECUPERACION} minutos.`,
          ignora: 'Si no lo pediste, ignora este correo: tu contraseña no cambiará.',
        };
  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;color:#1c1917;max-width:520px">
<p>${esc(t.saludo)}</p><p>${esc(t.cuerpo)}</p>
<p><a href="${esc(enlace)}" style="display:inline-block;background:#9a3412;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(t.boton)}</a></p>
<p style="font-size:14px;color:#44403c">${esc(t.vence)}<br>${esc(t.ignora)}</p>
<p style="font-size:13px;color:#57534e;word-break:break-all">${esc(enlace)}</p></div>`;
  const texto = `${t.saludo}\n\n${t.cuerpo}\n${enlace}\n\n${t.vence}\n${t.ignora}`;
  return { asunto: t.asunto, html, texto };
}
