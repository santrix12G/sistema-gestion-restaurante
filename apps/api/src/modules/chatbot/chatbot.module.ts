import { Module } from '@nestjs/common';
import { CatalogoModule } from '../catalogo';
import { ClientesModule } from '../clientes';
import { PagosModule } from '../pagos';
import { PedidosModule } from '../pedidos';
import { leerConfig } from '../../shared/config';
import { NotificarCliente } from './application/notificar-cliente';
import { ProcesarMensajeUseCase } from './application/procesar-mensaje.use-case';
import { AGENTE_CONVERSACIONAL, AgenteConversacional, EMISOR_TELEGRAM, EMISOR_WHATSAPP, MOTOR_NLP } from './application/puertos';
import { RecibirTelegramUseCase } from './application/recibir-telegram.use-case';
import { EmisorMeta, EmisorSimulado, EmisorTwilio } from './infrastructure/emisores';
import { AgenteChatCompletions } from './infrastructure/agente-chat-completions';
import { AgenteClaude } from './infrastructure/agente-claude';
import { AgenteOpenAI } from './infrastructure/agente-openai';
import { MotorReglas } from './infrastructure/motores-nlp';
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

/** Sin LLM configurado, siempre atienden las reglas */
class SinAgente implements AgenteConversacional {
  async responder() {
    return null;
  }
}

function crearAgente(): AgenteConversacional {
  const nlp = leerConfig().nlp;
  switch (nlp.proveedor) {
    case 'groq':
      // Plan gratuito de Groq. gpt-oss razona poco y no devuelve su razonamiento: respuestas más rápidas y baratas
      return new AgenteChatCompletions({
        proveedor: 'Groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: nlp.groqApiKey,
        modelo: nlp.groqModelo,
        extras: nlp.groqModelo.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low', include_reasoning: false } : {},
      });
    case 'claude':
      return new AgenteClaude();
    case 'openai':
      return new AgenteOpenAI();
    default:
      return new SinAgente();
  }
}

// WHATSAPP_PROVIDER, TELEGRAM_BOT_TOKEN y NLP_PROVIDER del .env eligen los adaptadores; el resto del bot no cambia
@Module({
  imports: [CatalogoModule, ClientesModule, PedidosModule, PagosModule],
  controllers: [WebhookWhatsAppController, WebhookTwilioController, WebhookTelegramController],
  providers: [
    ProcesarMensajeUseCase,
    NotificarCliente,
    RecibirTelegramUseCase,
    CanalTelegram,
    { provide: EMISOR_WHATSAPP, useFactory: () => crearEmisor() },
    // Telegram es un canal aparte: funciona junto a cualquier proveedor de WhatsApp
    { provide: EMISOR_TELEGRAM, useFactory: () => (leerConfig().telegram.token ? new EmisorTelegramBot() : new EmisorTelegramSimulado()) },
    // NLP_PROVIDER=claude u openai: un LLM atiende la conversación. Las reglas quedan de respaldo
    { provide: AGENTE_CONVERSACIONAL, useFactory: () => crearAgente() },
    { provide: MOTOR_NLP, useClass: MotorReglas },
  ],
})
export class ChatbotModule {}
