import { Injectable, OnModuleInit } from '@nestjs/common';
import { BusEventos, EventosDominio, PagoEvento, PedidoEvento } from '../../../shared/eventos';
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

function mensajePago(e: PagoEvento, numero: number): string | undefined {
  const n = `*#${numero}*`;
  const monto = `$${e.monto.toLocaleString('es-CO')}`;
  switch (e.estado) {
    case 'APROBADO':
      return `✅ Recibimos tu pago de *${monto}* del pedido ${n}. ¡Gracias!`;
    case 'RECHAZADO':
      return `❌ El pago del pedido ${n} no se pudo completar. Puedes intentarlo otra vez con el mismo enlace, con otra tarjeta, o pagar en efectivo al recibir.`;
    case 'REEMBOLSADO':
      return `↩️ Te devolvimos el pago de *${monto}* del pedido ${n}.`;
  }
}

/** Le escribe al cliente, por WhatsApp o Telegram, cuando su domicilio sale, cuando su pedido se paga o se cancela, y cuando cambia su pago en línea. */
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
    this.bus.suscribir('pago.estado_cambiado', (e) => this.notificarPago(e));
  }

  /** El evento de pago solo trae el pedidoId: el canal y el teléfono del cliente se consultan. */
  private async notificarPago(e: PagoEvento) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: e.pedidoId },
      select: { id: true, numero: true, tipo: true, canal: true, estado: true, total: true, cliente: { select: { telefono: true } } },
    });
    if (!pedido) return;
    await this.notificar(
      { pedidoId: pedido.id, numero: pedido.numero, tipo: pedido.tipo, canal: pedido.canal, estado: pedido.estado, total: pedido.total, telefonoCliente: pedido.cliente?.telefono ?? null },
      mensajePago(e, pedido.numero),
    );
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
