import { Logger } from '@nestjs/common';
import { leerConfig } from '../../../shared/config';
import { AgenteConversacional } from '../application/puertos';
import { contextoAgente, EntradaAgente, HERRAMIENTAS, INSTRUCCIONES_AGENTE, SesionAgente } from '../domain/agente';
import { Resultado } from '../domain/dialogo';

const MAX_VUELTAS = 6;
const URL_OPENAI = 'https://api.openai.com/v1/responses';

const TOOLS = HERRAMIENTAS.map((h) => ({ type: 'function', name: h.nombre, description: h.descripcion, parameters: h.esquema, strict: true }));

/** Lo que interesa de cada elemento de la salida de la API de Responses */
interface ElementoSalida {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type: string; text?: string }[];
  [otro: string]: unknown;
}

/**
 * Atiende el chat con un modelo de OpenAI (API de Responses con funciones).
 * Mismas herramientas y mismas reglas que AgenteClaude: solo cambia el formato de la API.
 */
export class AgenteOpenAI implements AgenteConversacional {
  private readonly logger = new Logger('AgenteOpenAI');
  private readonly apiKey: string;
  private readonly modelo: string;
  private readonly fetch: typeof fetch;

  constructor(opciones: { apiKey?: string; modelo?: string; fetch?: typeof fetch } = {}) {
    const config = leerConfig().nlp;
    this.apiKey = opciones.apiKey ?? config.openaiApiKey;
    this.modelo = opciones.modelo ?? config.openaiModelo;
    this.fetch = opciones.fetch ?? fetch;
  }

  async responder(entrada: EntradaAgente): Promise<Resultado | null> {
    const sesion = new SesionAgente(entrada);
    const input: unknown[] = [
      { role: 'system', content: `${INSTRUCCIONES_AGENTE}\n\n${contextoAgente(entrada)}` },
      ...entrada.historial.map((t) => ({ role: t.rol === 'cliente' ? 'user' : 'assistant', content: t.texto })),
      { role: 'user', content: entrada.texto },
    ];

    try {
      for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
        const respuesta = await this.fetch(URL_OPENAI, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.modelo,
            input,
            tools: TOOLS,
            // Sin guardar nada en OpenAI: el razonamiento cifrado vuelve en cada vuelta
            store: false,
            include: ['reasoning.encrypted_content'],
          }),
          signal: AbortSignal.timeout(25_000),
        });
        if (!respuesta.ok) {
          const detalle = await respuesta.text().catch(() => '');
          this.logger.warn(`OpenAI respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
          return null;
        }

        const { output = [] } = (await respuesta.json()) as { output?: ElementoSalida[] };
        const llamadas = output.filter((o) => o.type === 'function_call');
        if (llamadas.length === 0) {
          const texto = output
            .flatMap((o) => (o.type === 'message' ? (o.content ?? []) : []))
            .filter((c) => c.type === 'output_text')
            .map((c) => c.text ?? '')
            .join('\n');
          return sesion.terminar(texto);
        }

        // La salida vuelve completa (razonamiento y llamadas) seguida del resultado de cada función
        input.push(...output);
        for (const llamada of llamadas) {
          let argumentos: unknown;
          try {
            argumentos = JSON.parse(llamada.arguments ?? '{}');
          } catch {
            input.push({ type: 'function_call_output', call_id: llamada.call_id, output: 'Error: los argumentos no son JSON válido.' });
            continue;
          }
          const salida = sesion.ejecutar(llamada.name ?? '', argumentos);
          input.push({ type: 'function_call_output', call_id: llamada.call_id, output: salida.error ? `Error: ${salida.texto}` : salida.texto });
        }
      }
      this.logger.warn(`OpenAI pasó de ${MAX_VUELTAS} vueltas de herramientas; responden las reglas`);
      return null;
    } catch (e) {
      this.logger.warn(`No se pudo consultar a OpenAI: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }
}
