import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientesService } from '../../clientes';
import { DomainError } from '../../../shared/domain-error';
import { ProcesarMensajeUseCase } from './procesar-mensaje.use-case';
import { EMISOR_TELEGRAM, EmisorTelegram } from './puertos';

/** Lo que el bot necesita de un mensaje de Telegram. */
export interface MensajeTelegram {
  chatId: string;
  /** Solo se atienden chats privados, no grupos */
  privado: boolean;
  mensajeId: string;
  /** Quién escribió */
  usuarioId: string;
  nombre?: string;
  texto?: string;
  /** Si tocó el botón "Compartir mi número" */
  contacto?: { telefono: string; usuarioId?: string };
}

const PEDIR_NUMERO =
  '¡Hola! 👋 Soy el asistente de pedidos del restaurante.\n\nPara tomar tu pedido y avisarte cómo va, necesito tu número de celular. Toca el botón *📱 Compartir mi número*.';

/**
 * Telegram no entrega el teléfono del cliente, y el sistema identifica a los clientes por su celular.
 * Por eso, la primera vez el bot le pide compartir su número; después, cada mensaje sigue el mismo
 * camino que uno de WhatsApp.
 */
@Injectable()
export class RecibirTelegramUseCase {
  private readonly logger = new Logger('Telegram');

  constructor(
    private readonly clientes: ClientesService,
    private readonly procesar: ProcesarMensajeUseCase,
    @Inject(EMISOR_TELEGRAM) private readonly telegram: EmisorTelegram,
  ) {}

  async ejecutar(mensaje: MensajeTelegram) {
    if (!mensaje.privado) return;

    if (mensaje.contacto) {
      await this.vincular(mensaje, mensaje.contacto);
      return;
    }

    const cliente = await this.clientes.buscarPorTelegram(mensaje.chatId);
    if (!cliente) {
      await this.telegram.enviarTexto(mensaje.chatId, PEDIR_NUMERO, { pedirContacto: true });
      return;
    }

    // /start es el primer mensaje que envía Telegram al abrir el bot
    const texto = mensaje.texto?.startsWith('/start') ? 'hola' : mensaje.texto;
    await this.procesar.ejecutar({
      canal: 'TELEGRAM',
      telefono: cliente.telefono,
      texto,
      idExterno: `telegram-${mensaje.chatId}-${mensaje.mensajeId}`,
      nombre: mensaje.nombre,
    });
  }

  private async vincular(mensaje: MensajeTelegram, contacto: { telefono: string; usuarioId?: string }) {
    // El botón comparte el número propio; un contacto reenviado de otra persona no sirve
    if (contacto.usuarioId !== mensaje.usuarioId) {
      await this.telegram.enviarTexto(mensaje.chatId, 'Necesito *tu* número. Toca el botón *📱 Compartir mi número*.', { pedirContacto: true });
      return;
    }
    // Telegram a veces lo envía sin el +
    const telefono = contacto.telefono.startsWith('+') ? contacto.telefono : `+${contacto.telefono}`;
    try {
      const cliente = await this.clientes.vincularTelegram(telefono, mensaje.chatId, mensaje.nombre);
      const saludo = cliente.nombre ? `¡Gracias, ${cliente.nombre}!` : '¡Gracias!';
      await this.telegram.enviarTexto(
        mensaje.chatId,
        `${saludo} ✅ Ya quedaste registrado.\n\nEscríbeme lo que quieres pedir, por ejemplo *2 hamburguesas y una limonada*, o escribe *menú* para ver la carta.`,
        { quitarTeclado: true },
      );
    } catch (e) {
      if (!(e instanceof DomainError)) throw e;
      this.logger.warn(`Número de Telegram no válido: ${e.message}`);
      await this.telegram.enviarTexto(mensaje.chatId, `😕 ${e.message}`, { pedirContacto: true });
    }
  }
}
