import { Injectable, OnModuleInit } from '@nestjs/common';
import { BusEventos, EventosDominio } from '../../../shared/eventos';
import { PrismaService } from '../../../shared/prisma.service';
import { ProcesarMensajeUseCase } from './procesar-mensaje.use-case';

type Evento = EventosDominio['pedido.estado_cambiado'];

function mensajePara(e: Evento): string | undefined {
  const n = `*#${e.numero}*`;
  switch (e.estado) {
    case 'EN_PREPARACION':
      return `👨‍🍳 Estamos preparando tu pedido ${n}.`;
    case 'LISTO':
      return e.tipo === 'DOMICILIO' ? undefined : `🛎️ Tu pedido ${n} está listo. ¡Te esperamos en el restaurante!`;
    case 'EN_CAMINO':
      return `🛵 Tu pedido ${n} va en camino.`;
    case 'ENTREGADO':
      return `✅ Pedido ${n} entregado. ¡Buen provecho y gracias por preferirnos!`;
    case 'CANCELADO':
      return `Lo sentimos, tu pedido ${n} fue cancelado. Si tienes dudas, escríbenos.`;
  }
}

/** Le escribe al cliente, por WhatsApp o Telegram, cada vez que su pedido cambia de estado. */
@Injectable()
export class NotificarCliente implements OnModuleInit {
  constructor(
    private readonly bus: BusEventos,
    private readonly prisma: PrismaService,
    private readonly procesar: ProcesarMensajeUseCase,
  ) {}

  onModuleInit() {
    this.bus.suscribir('pedido.estado_cambiado', (e) => this.notificar(e));
  }

  private async notificar(e: Evento) {
    const canal = e.canal;
    if ((canal !== 'WHATSAPP' && canal !== 'TELEGRAM') || !e.telefonoCliente) return;
    const texto = mensajePara(e);
    if (!texto) return;
    const conversacion = await this.prisma.conversacion.findFirst({
      where: { canal, cliente: { telefono: e.telefonoCliente } },
      select: { id: true, cliente: { select: { telefono: true, telegramChatId: true } } },
    });
    if (conversacion) await this.procesar.enviar(conversacion.id, { canal, ...conversacion.cliente }, [texto]);
  }
}
