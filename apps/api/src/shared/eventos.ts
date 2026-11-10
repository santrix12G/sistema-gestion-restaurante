import { Injectable, Logger } from '@nestjs/common';

/** Datos que viajan en los eventos de pedido. Ningún módulo necesita consultar la base de datos para reaccionar. */
export interface PedidoEvento {
  pedidoId: string;
  numero: number;
  tipo: 'MESA' | 'DOMICILIO' | 'RECOGER';
  canal: 'WEB' | 'MOVIL' | 'WHATSAPP' | 'TELEGRAM';
  estado: string;
  total: number;
  telefonoCliente: string | null;
}

export interface EventosDominio {
  'pedido.creado': PedidoEvento;
  'pedido.estado_cambiado': PedidoEvento & { estadoAnterior: string };
}

type Manejador<T> = (evento: T) => void | Promise<void>;

/**
 * Bus de eventos en memoria. Un módulo publica lo que pasó y los demás reaccionan sin conocerse:
 * pedidos no sabe que existen el chatbot ni la pantalla de cocina.
 * Los eventos se pierden si el proceso se reinicia justo después de publicarlos; ver docs/arquitectura.md.
 */
@Injectable()
export class BusEventos {
  private readonly logger = new Logger('BusEventos');
  private readonly manejadores = new Map<keyof EventosDominio, Manejador<never>[]>();

  suscribir<K extends keyof EventosDominio>(nombre: K, manejador: Manejador<EventosDominio[K]>) {
    this.manejadores.set(nombre, [...(this.manejadores.get(nombre) ?? []), manejador as Manejador<never>]);
  }

  /** No espera a los suscriptores: un error en uno de ellos no afecta a quien publicó. */
  publicar<K extends keyof EventosDominio>(nombre: K, evento: EventosDominio[K]) {
    for (const manejador of this.manejadores.get(nombre) ?? []) {
      setImmediate(async () => {
        try {
          await (manejador as Manejador<EventosDominio[K]>)(evento);
        } catch (e) {
          this.logger.error(`Falló un suscriptor de ${nombre}`, e instanceof Error ? e.stack : e);
        }
      });
    }
  }
}
