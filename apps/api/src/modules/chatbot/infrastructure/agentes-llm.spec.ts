// Los adaptadores de Claude y OpenAI con respuestas simuladas: prueban el bucle de herramientas sin red ni costo.
import { EntradaAgente } from '../domain/agente';
import { CONTEXTO_VACIO } from '../domain/dialogo';
import { AgenteChatCompletions } from './agente-chat-completions';
import { AgenteClaude } from './agente-claude';
import { AgenteOpenAI } from './agente-openai';

process.env.JWT_SECRET ??= 'x'.repeat(32);
process.env.DATABASE_URL ??= 'postgresql://pruebas@localhost/pruebas';

const ENTRADA: EntradaAgente = {
  texto: 'Quiero una limonada para recoger',
  historial: [
    { rol: 'bot', texto: 'Mensaje viejo del bot' },
    { rol: 'cliente', texto: 'hola' },
    { rol: 'bot', texto: '¡Hola! ¿Qué te gustaría pedir?' },
  ],
  estado: { paso: 'INICIO', contexto: CONTEXTO_VACIO },
  menu: [{ id: 'li', nombre: 'Limonada natural', precio: 6000, disponible: true, sinonimos: ['limonada'], categoria: 'Bebidas' }],
  costoDomicilio: 5000,
  pagoEnLinea: false,
};

/** Un fetch que responde en orden y guarda lo que se le envió */
function fetchSimulado(respuestas: unknown[]) {
  const cuerpos: Record<string, unknown>[] = [];
  const fn = jest.fn(async (_url: unknown, init?: RequestInit) => {
    cuerpos.push(JSON.parse(String(init?.body)));
    const siguiente = respuestas.shift();
    if (siguiente instanceof Response) return siguiente;
    return new Response(JSON.stringify(siguiente), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return { fetch: fn as unknown as typeof fetch, cuerpos };
}

const mensajeClaude = (stop_reason: string, content: unknown[]) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  stop_reason,
  stop_sequence: null,
  content,
  usage: { input_tokens: 10, output_tokens: 10 },
});

describe('AgenteClaude', () => {
  it('ejecuta las herramientas que pide Claude y devuelve su respuesta final', async () => {
    const { fetch, cuerpos } = fetchSimulado([
      mensajeClaude('tool_use', [
        { type: 'tool_use', id: 'tu_1', name: 'agregar_productos', input: { items: [{ producto: 'Limonada natural', cantidad: 1, notas: null }] } },
        { type: 'tool_use', id: 'tu_2', name: 'elegir_entrega', input: { tipo: 'RECOGER', direccion: null } },
      ]),
      mensajeClaude('tool_use', [{ type: 'tool_use', id: 'tu_3', name: 'mostrar_resumen', input: {} }]),
      mensajeClaude('end_turn', [{ type: 'text', text: '¡Anotado! Revisa tu pedido 👇' }]),
    ]);
    const agente = new AgenteClaude({ apiKey: 'sk-prueba', modelo: 'claude-opus-5-5', fetch });

    const r = await agente.responder(ENTRADA);

    expect(r).toMatchObject({ paso: 'CONFIRMACION', crearPedido: false, contexto: { tipoEntrega: 'RECOGER' } });
    expect(r!.respuestas[0]).toBe('¡Anotado! Revisa tu pedido 👇');
    expect(r!.respuestas[1]).toContain('*Total: $6.000*');

    const primera = cuerpos[0] as { model: string; tools: { name: string; strict: boolean }[]; messages: { role: string }[]; fallbacks: string };
    expect(primera.model).toBe('claude-opus-5-5');
    expect(primera.fallbacks).toBe('default');
    expect(primera.tools.every((t) => t.strict)).toBe(true);
    // El historial empieza por el cliente y termina con el mensaje nuevo
    expect(primera.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    // Los dos resultados de la primera vuelta van juntos en un solo mensaje
    const segunda = cuerpos[1] as { messages: { role: string; content: { type: string; is_error: boolean }[] }[] };
    const resultados = segunda.messages.at(-1)!;
    expect(resultados.content.map((c) => [c.type, c.is_error])).toEqual([
      ['tool_result', false],
      ['tool_result', false],
    ]);
  });

  it('si Claude falla, devuelve null para que respondan las reglas', async () => {
    // El SDK reintenta una vez: las dos respuestas fallan
    const sobrecargado = () => new Response('{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}', { status: 529 });
    const { fetch } = fetchSimulado([sobrecargado(), sobrecargado()]);
    const agente = new AgenteClaude({ apiKey: 'sk-prueba', modelo: 'claude-opus-5-5', fetch });
    await expect(agente.responder(ENTRADA)).resolves.toBeNull();
  });
});

describe('AgenteChatCompletions (Groq)', () => {
  const groq = (fetch: typeof globalThis.fetch) =>
    new AgenteChatCompletions({
      proveedor: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: 'gsk-prueba',
      modelo: 'openai/gpt-oss-120b',
      extras: { reasoning_effort: 'low', include_reasoning: false },
      fetch,
    });

  it('ejecuta las herramientas que pide el modelo y devuelve su respuesta final', async () => {
    const { fetch, cuerpos } = fetchSimulado([
      {
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: null,
              reasoning: 'El cliente quiere una limonada',
              tool_calls: [
                { id: 'call_1', type: 'function', function: { name: 'agregar_productos', arguments: '{"items":[{"producto":"limonada","cantidad":2,"notas":null}]}' } },
              ],
            },
          },
        ],
      },
      { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Listo, 2 limonadas. ¿Algo más?' } }] },
    ]);

    const r = await groq(fetch).responder(ENTRADA);

    expect(r).toMatchObject({ paso: 'ARMANDO_PEDIDO', respuestas: ['Listo, 2 limonadas. ¿Algo más?'] });
    expect(r!.contexto.carrito).toEqual([expect.objectContaining({ productoId: 'li', cantidad: 2, precio: 6000 })]);

    const primera = cuerpos[0] as { model: string; reasoning_effort: string; tools: { function: { strict: boolean } }[] };
    expect(primera).toMatchObject({ model: 'openai/gpt-oss-120b', reasoning_effort: 'low' });
    expect(primera.tools.every((t) => t.function.strict)).toBe(true);
    // Groq rechaza "required": [] en las herramientas sin parámetros
    const sinParametros = (primera.tools as unknown as { function: { name: string; parameters: Record<string, unknown> } }[]).find(
      (t) => t.function.name === 'vaciar_pedido',
    )!;
    expect(sinParametros.function.parameters).toEqual({ type: 'object', additionalProperties: false, properties: {} });
    // Vuelve el mensaje del asistente sin su razonamiento, seguido del resultado de la herramienta
    const segunda = cuerpos[1] as { messages: Record<string, unknown>[] };
    const [asistente, herramienta] = segunda.messages.slice(-2);
    expect(asistente).not.toHaveProperty('reasoning');
    expect(asistente.tool_calls).toHaveLength(1);
    expect(herramienta).toMatchObject({ role: 'tool', tool_call_id: 'call_1' });
  });

  it('si se acaba el cupo gratuito (429), devuelve null para que respondan las reglas', async () => {
    const { fetch } = fetchSimulado([new Response('{"error":{"message":"Rate limit reached"}}', { status: 429 })]);
    await expect(groq(fetch).responder(ENTRADA)).resolves.toBeNull();
  });
});

describe('AgenteOpenAI', () => {
  it('ejecuta las funciones que pide el modelo y devuelve su respuesta final', async () => {
    const { fetch, cuerpos } = fetchSimulado([
      {
        output: [
          { type: 'function_call', call_id: 'c1', name: 'agregar_productos', arguments: '{"items":[{"producto":"Limonada natural","cantidad":1,"notas":null}]}' },
        ],
      },
      { output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Anoté tu limonada. ¿Algo más?' }] }] },
    ]);
    const agente = new AgenteOpenAI({ apiKey: 'sk-prueba', modelo: 'modelo-prueba', fetch });

    const r = await agente.responder(ENTRADA);

    expect(r).toMatchObject({ paso: 'ARMANDO_PEDIDO', respuestas: ['Anoté tu limonada. ¿Algo más?'] });
    expect(r!.contexto.carrito).toEqual([expect.objectContaining({ productoId: 'li', cantidad: 1, precio: 6000 })]);
    const segunda = cuerpos[1] as { input: { type?: string; call_id?: string }[] };
    expect(segunda.input.at(-1)).toMatchObject({ type: 'function_call_output', call_id: 'c1' });
  });

  it('si OpenAI falla, devuelve null para que respondan las reglas', async () => {
    const { fetch } = fetchSimulado([new Response('sin cupo', { status: 429 })]);
    const agente = new AgenteOpenAI({ apiKey: 'sk-prueba', modelo: 'modelo-prueba', fetch });
    await expect(agente.responder(ENTRADA)).resolves.toBeNull();
  });
});
