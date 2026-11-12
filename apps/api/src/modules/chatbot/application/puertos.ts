// Puertos del chatbot: el caso de uso no sabe si habla con Twilio, Meta, Telegram,
// ni si entiende con reglas o con un LLM. Cada proveedor se elige en el .env.
import { ProductoBot } from '../domain/buscador-productos';
import { Paso } from '../domain/dialogo';
import { Interpretacion } from '../domain/interpretacion';

export interface ContextoNlp {
  paso: Paso;
  menu: ProductoBot[];
}

export interface MotorNlp {
  interpretar(texto: string, contexto: ContextoNlp): Promise<Interpretacion>;
}

export type CanalChat = 'WHATSAPP' | 'TELEGRAM';

export interface EmisorWhatsApp {
  /** `telefono` en formato internacional, por ejemplo +573001234567 */
  enviarTexto(telefono: string, texto: string): Promise<void>;
}

export interface OpcionesTelegram {
  /** Muestra el botón que comparte el número del cliente */
  pedirContacto?: boolean;
  /** Quita ese botón después de usarlo */
  quitarTeclado?: boolean;
}

export interface EmisorTelegram {
  enviarTexto(chatId: string, texto: string, opciones?: OpcionesTelegram): Promise<void>;
}

export const MOTOR_NLP = Symbol('MotorNlp');
export const EMISOR_WHATSAPP = Symbol('EmisorWhatsApp');
export const EMISOR_TELEGRAM = Symbol('EmisorTelegram');
