import { OnModuleInit } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { leerConfig } from '../../shared/config';
import { BusEventos } from '../../shared/eventos';
import { VerificadorSesion } from '../identidad';

const SALA_PERSONAL = 'personal';

/**
 * Avisa al instante a la web y la app del personal cuando entra un pedido, sale a reparto o se cierra.
 * La web se conecta con su token, y solo recibe avisos si la sesión es válida.
 */
@WebSocketGateway({
  cors: { origin: (origen: string | undefined, cb: (e: Error | null, ok: boolean) => void) => cb(null, !origen || leerConfig().corsOrigins.includes(origen)) },
})
export class TiempoRealGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  private readonly servidor!: Server;

  constructor(
    private readonly verificador: VerificadorSesion,
    private readonly bus: BusEventos,
  ) {}

  onModuleInit() {
    this.bus.suscribir('pedido.creado', (e) => {
      this.servidor.to(SALA_PERSONAL).emit('pedido', { ...e, motivo: 'creado' });
    });
    this.bus.suscribir('pedido.estado_cambiado', (e) => {
      this.servidor.to(SALA_PERSONAL).emit('pedido', { ...e, motivo: 'estado' });
    });
    this.bus.suscribir('pedido.en_camino', (e) => {
      this.servidor.to(SALA_PERSONAL).emit('pedido', { ...e, motivo: 'en_camino' });
    });
    // Con el pago en línea confirmado, la tarjeta del pedido muestra que no hay que cobrarlo
    this.bus.suscribir('pago.estado_cambiado', (e) => {
      this.servidor.to(SALA_PERSONAL).emit('pedido', { pedidoId: e.pedidoId, pago: e.estado, motivo: 'pago' });
    });
  }

  async handleConnection(cliente: Socket) {
    const usuario = await this.verificador.verificar(cliente.handshake.auth?.token);
    if (!usuario) {
      cliente.emit('sesion_invalida');
      cliente.disconnect(true);
      return;
    }
    await cliente.join(SALA_PERSONAL);
  }
}
