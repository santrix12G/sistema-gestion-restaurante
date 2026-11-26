import { Logger } from '@nestjs/common';
import { AgenteConversacional } from '../application/puertos';
import { contextoAgente, EntradaAgente, HERRAMIENTAS, INSTRUCCIONES_AGENTE, SesionAgente } from '../domain/agente';
import { Resultado } from '../domain/dialogo';

const MAX_VUELTAS = 6;

/**
 * Groq rechaza con 400 toda la petición si una herramienta sin parámetros trae "required": []
 * ("'required' present but 'properties' is missing"). Sin esa lista vacía el esquema sigue siendo estricto.
 */
function sinRequeridosVacios(esquema: Record<string, unknown>): Record<string, unknown> {
  const { required, ...resto } = esquema;
  return Array.isArray(required) && required.length === 0 ? resto : esquema;
}

const TOOLS = HERRAMIENTAS.map((h) => ({
  type: 'function',
  function: { name: h.nombre, description: h.descripcion, parameters: sinRequeridosVacios(h.esquema), strict: true },
}));

export interface OpcionesChatCompletions {
  /** Nombre para los registros, por ejemplo Groq */
  proveedor: string;
  /** Dirección completa del endpoint, por ejemplo https://api.groq.com/openai/v1/chat/completions */
  url: string;
  apiKey: string;
  modelo: string;
  /** Campos propios del proveedor que se agregan a cada petición */
  extras?: Record<string, unknown>;
  fetch?: typeof fetch;
}

interface LlamadaHerramienta {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface MensajeAsistente {
  role: 'assistant';
  content: string | null;
  tool_calls?: LlamadaHerramienta[];
}

/**
 * Atiende el chat con cualquier API compatible con Chat Completions de OpenAI: Groq (plan gratuito),
 * y también OpenRouter u Ollama. Mismas herramientas y reglas que AgenteClaude y AgenteOpenAI.
 */
export class AgenteChatCompletions implements AgenteConversacional {
  private readonly logger: Logger;
  private readonly fetch: typeof fetch;

  constructor(private readonly opciones: OpcionesChatCompletions) {
    this.logger = new Logger(`Agente${opciones.proveedor}`);
    this.fetch = opciones.fetch ?? fetch;
  }

  async responder(entrada: EntradaAgente): Promise<Resultado | null> {
    const { proveedor, url, apiKey, modelo, extras } = this.opciones;
    const sesion = new SesionAgente(entrada);
    const messages: unknown[] = [
      { role: 'system', content: `${INSTRUCCIONES_AGENTE}\n\n${contextoAgente(entrada)}` },
      ...entrada.historial.map((t) => ({ role: t.rol === 'cliente' ? 'user' : 'assistant', content: t.texto })),
      { role: 'user', content: entrada.texto },
    ];

    try {
      for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
        const respuesta = await this.fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelo, messages, tools: TOOLS, ...extras }),
          signal: AbortSignal.timeout(25_000),
        });
        if (!respuesta.ok) {
          // 429: se acabó el cupo del plan gratuito. Ese mensaje lo atienden las reglas
          const detalle = await respuesta.text().catch(() => '');
          this.logger.warn(`${proveedor} respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
          return null;
        }

        const cuerpo = (await respuesta.json()) as { choices?: { message?: MensajeAsistente; finish_reason?: string }[] };
        const opcion = cuerpo.choices?.[0];
        const mensaje = opcion?.message;
        if (!mensaje || opcion.finish_reason === 'length') {
          this.logger.warn(`${proveedor} no devolvió una respuesta completa; responden las reglas`);
          return null;
        }

        const llamadas = mensaje.tool_calls ?? [];
        if (llamadas.length === 0) return sesion.terminar(mensaje.content ?? '');

        // Se devuelve solo lo estándar del mensaje: el razonamiento interno del modelo no hace falta
        messages.push({ role: 'assistant', content: mensaje.content ?? '', tool_calls: llamadas });
        for (const llamada of llamadas) {
          let argumentos: unknown;
          try {
            argumentos = JSON.parse(llamada.function.arguments || '{}');
          } catch {
            messages.push({ role: 'tool', tool_call_id: llamada.id, content: 'Error: los argumentos no son JSON válido.' });
            continue;
          }
          const salida = sesion.ejecutar(llamada.function.name, argumentos);
          messages.push({ role: 'tool', tool_call_id: llamada.id, content: salida.error ? `Error: ${salida.texto}` : salida.texto });
        }
      }
      this.logger.warn(`${proveedor} pasó de ${MAX_VUELTAS} vueltas de herramientas; responden las reglas`);
      return null;
    } catch (e) {
      this.logger.warn(`No se pudo consultar a ${proveedor}: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }
}
