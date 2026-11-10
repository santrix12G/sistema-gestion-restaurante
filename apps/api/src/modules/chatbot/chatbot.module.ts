import { Module } from '@nestjs/common';
import { CatalogoModule } from '../catalogo';
import { ClientesModule } from '../clientes';
import { PedidosModule } from '../pedidos';
import { leerConfig } from '../../shared/config';
import { NotificarCliente } from './application/notificar-cliente';
import { ProcesarMensajeUseCase } from './application/procesar-mensaje.use-case';
import { EMISOR_TELEGRAM, EMISOR_WHATSAPP, MOTOR_NLP } from './application/puertos';
import { RecibirTelegramUseCase } from './application/recibir-telegram.use-case';
import { EmisorMeta, EmisorSimulado, EmisorTwilio } from './infrastructure/emisores';
import { MotorOpenAI, MotorReglas } from './infrastructure/motores-nlp';
import { SimuladorController } from './infrastructure/simulador.controller';
import { CanalTelegram, EmisorTelegramBot, EmisorTelegramSimulado } from './infrastructure/telegram';
import { WebhookTelegramController } from './infrastructure/webhook-telegram.controller';
import { WebhookTwilioController } from './infrastructure/webhook-twilio.controller';
import { WebhookWhatsAppController } from './infrastructure/webhook-whatsapp.controller';

function crearEmisor() {
  switch (leerConfig().whatsapp.proveedor) {
    case 'meta':
      return new EmisorMeta();
    case 'twilio':
      return new EmisorTwilio();
    default:
      return new EmisorSimulado();
  }
}

// WHATSAPP_PROVIDER, TELEGRAM_BOT_TOKEN y NLP_PROVIDER del .env eligen los adaptadores; el resto del bot no cambia
@Module({
  imports: [CatalogoModule, ClientesModule, PedidosModule],
  controllers: [WebhookWhatsAppController, WebhookTwilioController, WebhookTelegramController, SimuladorController],
  providers: [
    ProcesarMensajeUseCase,
    NotificarCliente,
    RecibirTelegramUseCase,
    CanalTelegram,
    { provide: EMISOR_WHATSAPP, useFactory: () => crearEmisor() },
    // Telegram es un canal aparte: funciona junto a cualquier proveedor de WhatsApp
    { provide: EMISOR_TELEGRAM, useFactory: () => (leerConfig().telegram.token ? new EmisorTelegramBot() : new EmisorTelegramSimulado()) },
    { provide: MOTOR_NLP, useFactory: () => (leerConfig().nlp.proveedor === 'openai' ? new MotorOpenAI() : new MotorReglas()) },
  ],
})
export class ChatbotModule {}
