import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CatalogoService } from '../../catalogo';
import { ClientesService } from '../../clientes';
import { CrearPedidoClienteUseCase } from '../../pedidos';
import { leerConfig } from '../../../shared/config';
import { DomainError } from '../../../shared/domain-error';
import { PrismaService } from '../../../shared/prisma.service';
import { CONTEXTO_VACIO, ContextoConversacion, EstadoConversacion, Paso, responder } from '../domain/dialogo';
import { ColaPorClave } from './cola-por-clave';
import { CanalChat, EMISOR_TELEGRAM, EMISOR_WHATSAPP, EmisorTelegram, EmisorWhatsApp, MOTOR_NLP, MotorNlp } from './puertos';

export interface MensajeEntrante {
  /** Por defecto, WhatsApp */
  canal?: CanalChat;
  telefono: string;
  /** Vacío si el mensaje no es de texto: audio, imagen, ubicación… */
  texto?: string;
  /** Identificador del mensaje en el canal: descarta los repetidos. */
  idExterno?: string;
  nombre?: string;
}

/** A quién se le responde: por WhatsApp, al teléfono; por Telegram, a su chat. */
export interface Destino {
  canal: CanalChat;
  telefono: string;
  telegramChatId: string | null;
}

const SOLO_TEXTO = 'Por ahora solo entiendo mensajes de texto 🙏. Escríbeme lo que quieres pedir.';

/** Recibe un mensaje del cliente, avanza la conversación y le responde por el mismo canal. */
@Injectable()
export class ProcesarMensajeUseCase {
  private readonly logger = new Logger('Chatbot');
  private readonly cola = new ColaPorClave();
  private readonly costoDomicilio = leerConfig().costoDomicilio;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientes: ClientesService,
    private readonly catalogo: CatalogoService,
    private readonly crearPedido: CrearPedidoClienteUseCase,
    @Inject(MOTOR_NLP) private readonly nlp: MotorNlp,
    @Inject(EMISOR_WHATSAPP) private readonly whatsapp: EmisorWhatsApp,
    @Inject(EMISOR_TELEGRAM) private readonly telegram: EmisorTelegram,
  ) {}

  /** Devuelve las respuestas enviadas. Un mensaje repetido no recibe respuesta. */
  ejecutar(mensaje: MensajeEntrante): Promise<string[]> {
    const canal = mensaje.canal ?? 'WHATSAPP';
    return this.cola.ejecutar(`${canal}:${mensaje.telefono}`, () => this.procesar({ ...mensaje, canal }));
  }

  private async procesar({ canal = 'WHATSAPP', telefono, texto, idExterno, nombre }: MensajeEntrante): Promise<string[]> {
    if (idExterno && (await this.prisma.mensaje.findUnique({ where: { waMessageId: idExterno } }))) return [];

    const cliente = await this.clientes.obtenerOCrear(telefono, nombre);
    const conversacion = await this.prisma.conversacion.upsert({
      where: { clienteId_canal: { clienteId: cliente.id, canal } },
      create: { clienteId: cliente.id, canal },
      update: {},
    });
    const destino: Destino = { canal, telefono: cliente.telefono, telegramChatId: cliente.telegramChatId };

    let entrante;
    try {
      entrante = await this.prisma.mensaje.create({
        data: { conversacionId: conversacion.id, direccion: 'ENTRANTE', texto: texto ?? '[mensaje que no es de texto]', waMessageId: idExterno },
      });
    } catch (e) {
      // El mismo mensaje llegó dos veces casi a la vez
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return [];
      throw e;
    }

    if (!texto?.trim()) {
      await this.enviar(conversacion.id, destino, [SOLO_TEXTO]);
      return [SOLO_TEXTO];
    }

    const estado: EstadoConversacion = {
      paso: conversacion.paso as Paso,
      contexto: { ...CONTEXTO_VACIO, ...(conversacion.contexto as unknown as Partial<ContextoConversacion>) },
    };
    const menu = await this.catalogo.menuParaBot();
    const interpretacion = await this.nlp.interpretar(texto, { paso: estado.paso, menu });
    await this.prisma.mensaje.update({ where: { id: entrante.id }, data: { intencion: interpretacion.intencion } });

    let { paso, contexto, respuestas, crearPedido } = responder(estado, interpretacion, texto, menu, this.costoDomicilio);
    if (crearPedido) {
      ({ paso, contexto, respuestas } = await this.confirmarPedido(canal, cliente.id, contexto, entrante.id));
    }

    await this.prisma.conversacion.update({
      where: { id: conversacion.id },
      data: { paso, contexto: contexto as unknown as Prisma.InputJsonValue },
    });
    await this.enviar(conversacion.id, destino, respuestas);
    return respuestas;
  }

  private async confirmarPedido(canal: CanalChat, clienteId: string, contexto: ContextoConversacion, mensajeId: string) {
    try {
      const pedido = await this.crearPedido.ejecutar({
        canal,
        clienteId,
        tipo: contexto.tipoEntrega ?? 'RECOGER',
        direccion: contexto.direccion,
        items: contexto.carrito.map(({ productoId, cantidad, notas }) => ({ productoId, cantidad, notas })),
        // El mensaje que confirmó es único: si se procesara dos veces, no se duplica el pedido
        claveIdempotencia: `chat-${mensajeId}`,
      });
      const siguiente = pedido.tipo === 'DOMICILIO'
        ? 'Ya lo estamos preparando. Te escribiré cuando salga hacia tu dirección.'
        : 'Ya lo estamos preparando. Pasa a recogerlo al restaurante.';
      return {
        paso: 'INICIO' as Paso,
        contexto: CONTEXTO_VACIO,
        respuestas: [`✅ ¡Pedido *#${pedido.numero}* confirmado!\nTotal: *$${pedido.total.toLocaleString('es-CO')}*\n\n${siguiente} ¡Gracias por tu pedido! 🙌`],
      };
    } catch (e) {
      if (e instanceof DomainError) {
        // Por ejemplo, un producto se agotó mientras la persona pedía
        return { paso: 'ARMANDO_PEDIDO' as Paso, contexto, respuestas: [`😕 No pude crear el pedido: ${e.message}. Ajusta tu pedido y escribe *listo* de nuevo.`] };
      }
      this.logger.error('No se pudo crear el pedido del chat', e instanceof Error ? e.stack : e);
      return { paso: 'CONFIRMACION' as Paso, contexto, respuestas: ['Tuvimos un problema al registrar tu pedido 😓. Responde *sí* en un momento para intentarlo de nuevo.'] };
    }
  }

  /** Envía y guarda cada respuesta. Si el envío falla, queda en el registro y no se marca como enviada. */
  async enviar(conversacionId: string, destino: Destino, textos: string[]) {
    for (const texto of textos) {
      try {
        if (destino.canal === 'TELEGRAM') {
          if (!destino.telegramChatId) throw new Error('El cliente no tiene un chat de Telegram vinculado');
          await this.telegram.enviarTexto(destino.telegramChatId, texto);
        } else {
          await this.whatsapp.enviarTexto(destino.telefono, texto);
        }
        await this.prisma.mensaje.create({ data: { conversacionId, direccion: 'SALIENTE', texto } });
      } catch (e) {
        this.logger.error(`No se pudo enviar un mensaje por ${destino.canal} a ${destino.telefono}`, e instanceof Error ? e.message : e);
      }
    }
  }
}
