import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import { leerConfig } from '../../../shared/config';
import { AgenteConversacional } from '../application/puertos';
import { contextoAgente, EntradaAgente, HERRAMIENTAS, INSTRUCCIONES_AGENTE, SesionAgente, TurnoChat } from '../domain/agente';
import { Resultado } from '../domain/dialogo';

/** Vueltas de herramientas por mensaje. Un mensaje normal usa una o dos */
const MAX_VUELTAS = 6;

const TOOLS: Anthropic.Beta.BetaTool[] = HERRAMIENTAS.map((h) => ({
  name: h.nombre,
  description: h.descripcion,
  input_schema: h.esquema as Anthropic.Beta.BetaTool.InputSchema,
  strict: true,
}));

/**
 * Atiende el chat con Claude. El bucle de herramientas corre aquí: cada mensaje del cliente es una
 * petición corta, y el estado del pedido vive en la base de datos del restaurante, no en Anthropic.
 */
export class AgenteClaude implements AgenteConversacional {
  private readonly logger = new Logger('AgenteClaude');
  private readonly modelo: string;
  private readonly client: Anthropic;

  constructor(opciones: { apiKey?: string; modelo?: string; fetch?: typeof fetch } = {}) {
    const config = leerConfig().nlp;
    this.modelo = opciones.modelo ?? config.anthropicModelo;
    // El cliente del chat espera: si Claude tarda, mejor responder con las reglas
    this.client = new Anthropic({ apiKey: opciones.apiKey ?? config.anthropicApiKey, timeout: 25_000, maxRetries: 1, fetch: opciones.fetch });
  }

  async responder(entrada: EntradaAgente): Promise<Resultado | null> {
    const sesion = new SesionAgente(entrada);
    const messages: Anthropic.Beta.BetaMessageParam[] = [...aMensajes(entrada.historial), { role: 'user', content: entrada.texto }];

    try {
      for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
        const respuesta = await this.client.beta.messages.create({
          model: this.modelo,
          max_tokens: 16_000,
          // Si Claude rechaza un mensaje por seguridad, el servidor reintenta con otro modelo en la misma llamada
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          // Conversación sencilla: poco razonamiento, respuestas rápidas
          output_config: { effort: 'low' },
          system: [
            { type: 'text', text: INSTRUCCIONES_AGENTE, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: contextoAgente(entrada) },
          ],
          tools: TOOLS,
          messages,
        });

        if (respuesta.stop_reason === 'refusal' || respuesta.stop_reason === 'max_tokens') {
          this.logger.warn(`Claude terminó con ${respuesta.stop_reason}; responden las reglas`);
          return null;
        }

        const usos = respuesta.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
        if (respuesta.stop_reason !== 'tool_use' || usos.length === 0) {
          const texto = respuesta.content
            .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('\n');
          return sesion.terminar(texto);
        }

        // El contenido va completo, con los bloques de razonamiento: Claude los necesita en la siguiente vuelta
        messages.push({ role: 'assistant', content: respuesta.content });
        const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = usos.map((uso) => {
          const salida = sesion.ejecutar(uso.name, uso.input);
          return { type: 'tool_result', tool_use_id: uso.id, content: salida.texto, is_error: salida.error };
        });
        // Todos los resultados en un solo mensaje
        messages.push({ role: 'user', content: resultados });
      }
      this.logger.warn(`Claude pasó de ${MAX_VUELTAS} vueltas de herramientas; responden las reglas`);
      return null;
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) this.logger.warn('Claude limitó las peticiones; responden las reglas');
      else if (e instanceof Anthropic.APIError) this.logger.warn(`Claude respondió ${e.status}: ${e.message}`);
      else this.logger.warn(`No se pudo consultar a Claude: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }
}

/** El historial como mensajes de la API. Debe empezar por el cliente; los turnos seguidos del mismo rol se unen. */
function aMensajes(historial: TurnoChat[]): Anthropic.Beta.BetaMessageParam[] {
  const inicio = historial.findIndex((t) => t.rol === 'cliente');
  if (inicio < 0) return [];
  return historial.slice(inicio).map((t) => ({ role: t.rol === 'cliente' ? 'user' : 'assistant', content: t.texto }));
}
