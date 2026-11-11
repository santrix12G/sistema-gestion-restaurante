import { Injectable, OnModuleInit } from '@nestjs/common';
import { BusEventos, EventosDominio, PedidoEvento } from '../../../shared/eventos';
import { PrismaService } from '../../../shared/prisma.service';
import { ProcesarMensajeUseCase } from './procesar-mensaje.use-case';

type Evento = EventosDominio['pedido.estado_cambiado'];

function mensajePara(e: Evento): string | undefined {
  const n = `*#${e.numero}*`;
  switch (e.estado) {
    case 'PAGADO':
      return e.tipo === 'DOMICILIO'
        ? `✅ Pedido ${n} entregado. ¡Buen provecho y gracias por preferirnos!`
        : `✅ Gracias por recoger tu pedido ${n}. ¡Buen provecho!`;
    case 'CANCELADO':
      return `Lo sentimos, tu pedido ${n} fue cancelado. Si tienes dudas, escríbenos.`;
  }
}

/** Le escribe al cliente, por WhatsApp o Telegram, cuando su domicilio sale y cuando su pedido se paga o se cancela. */
@Injectable()
export class NotificarCliente implements OnModuleInit {
  constructor(
    private readonly bus: BusEventos,
    private readonly prisma: PrismaService,
    private readonly procesar: ProcesarMensajeUseCase,
  ) {}

  onModuleInit() {
    this.bus.suscribir('pedido.estado_cambiado', (e) => this.notificar(e, mensajePara(e)));
    this.bus.suscribir('pedido.en_camino', (e) => this.notificar(e, `🛵 Tu pedido *#${e.numero}* va en camino con ${e.repartidor}.`));
  }

  private async notificar(e: PedidoEvento, texto: string | undefined) {
    const canal = e.canal;
    if ((canal !== 'WHATSAPP' && canal !== 'TELEGRAM') || !e.telefonoCliente || !texto) return;
    const conversacion = await this.prisma.conversacion.findFirst({
      where: { canal, cliente: { telefono: e.telefonoCliente } },
      select: { id: true, cliente: { select: { telefono: true, telegramChatId: true } } },
    });
    if (conversacion) await this.procesar.enviar(conversacion.id, { canal, ...conversacion.cliente }, [texto]);
  }
}
