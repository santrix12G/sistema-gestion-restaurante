import { Injectable, Logger } from '@nestjs/common';
import { leerConfig } from '../../../shared/config';
import { ContextoNlp, MotorNlp } from '../application/puertos';
import { BuscadorProductos } from '../domain/buscador-productos';
import { MAX_CANTIDAD } from '../domain/dialogo';
import { INTENCIONES, Interpretacion } from '../domain/interpretacion';
import { interpretarConReglas } from '../domain/nlu-reglas';

@Injectable()
export class MotorReglas implements MotorNlp {
  async interpretar(texto: string, { menu }: ContextoNlp) {
    return interpretarConReglas(texto, new BuscadorProductos(menu));
  }
}

// Con strict, OpenAI exige que todos los campos estén en required; los opcionales admiten null
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intencion', 'items', 'tipoEntrega'],
  properties: {
    intencion: { type: 'string', enum: INTENCIONES },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['producto', 'cantidad', 'notas'],
        properties: {
          producto: { type: 'string', description: 'Nombre exacto del producto tal como aparece en el menú' },
          cantidad: { type: 'integer' },
          notas: { type: ['string', 'null'], description: 'Indicaciones como "sin cebolla", o null' },
        },
      },
    },
    tipoEntrega: { type: ['string', 'null'], enum: ['DOMICILIO', 'RECOGER', null] },
  },
};

interface RespuestaLlm {
  intencion: Interpretacion['intencion'];
  items: { producto: string; cantidad: number; notas: string | null }[];
  tipoEntrega: 'DOMICILIO' | 'RECOGER' | null;
}

const INSTRUCCIONES = `Eres el intérprete de mensajes del chatbot de pedidos de un restaurante en Colombia.
No respondes al cliente: solo clasificas su mensaje y extraes los productos.
Intenciones:
- saludo, menu (pide la carta o precios), ayuda
- agregar (pide productos), quitar (quiere sacar productos del pedido), vaciar (empezar de nuevo)
- terminar (ya no quiere pedir más: "listo", "eso es todo")
- confirmar (sí) o negar (no), cuando responde a una pregunta
- domicilio o recoger (cómo recibe el pedido), cancelar (abandona el pedido), otro
- pago_en_linea (quiere pagar ahora con tarjeta, PSE o un enlace) o pago_efectivo (paga en efectivo al recibir)
Usa en "producto" el nombre exacto del menú. Si pide algo que no está en el menú, escríbelo tal como lo dijo.
En el paso DIRECCION, si el mensaje es una dirección, la intención es "otro".`;

/**
 * Entiende con un modelo de OpenAI, que tolera mejor la forma libre de escribir.
 * Si OpenAI falla o tarda, responde el motor de reglas: el cliente nunca se queda sin respuesta.
 */
@Injectable()
export class MotorOpenAI implements MotorNlp {
  private readonly logger = new Logger('NLP');
  private readonly config = leerConfig().nlp;
  private readonly respaldo = new MotorReglas();

  async interpretar(texto: string, contexto: ContextoNlp): Promise<Interpretacion> {
    try {
      return await this.consultar(texto, contexto);
    } catch (e) {
      this.logger.warn(`OpenAI no respondió; se usan las reglas. ${e instanceof Error ? e.message : e}`);
      return this.respaldo.interpretar(texto, contexto);
    }
  }

  private async consultar(texto: string, { paso, menu }: ContextoNlp): Promise<Interpretacion> {
    const carta = menu.filter((p) => p.disponible).map((p) => `- ${p.nombre}`).join('\n');
    const respuesta = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.openaiModelo,
        input: [
          { role: 'system', content: `${INSTRUCCIONES}\n\nPaso actual de la conversación: ${paso}\nMenú:\n${carta}` },
          { role: 'user', content: texto },
        ],
        text: { format: { type: 'json_schema', name: 'interpretacion', schema: ESQUEMA, strict: true } },
        store: false,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!respuesta.ok) throw new Error(`OpenAI respondió ${respuesta.status}`);

    const cuerpo = (await respuesta.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[] };
    const salida = cuerpo.output
      ?.flatMap((o) => (o.type === 'message' ? (o.content ?? []) : []))
      .find((c) => c.type === 'output_text')?.text;
    if (!salida) throw new Error('OpenAI no devolvió texto');
    const llm = JSON.parse(salida) as RespuestaLlm;
    if (!INTENCIONES.includes(llm.intencion)) throw new Error(`Intención desconocida: ${llm.intencion}`);

    // El modelo no decide precios ni identificadores: los nombres se cruzan con el menú real
    const buscador = new BuscadorProductos(menu);
    const interpretacion: Interpretacion = { intencion: llm.intencion, items: [], noReconocidos: [], tipoEntrega: llm.tipoEntrega ?? undefined };
    for (const item of llm.items) {
      const producto = buscador.resolver(item.producto);
      if (!producto) {
        interpretacion.noReconocidos.push(item.producto);
        continue;
      }
      const cantidad = Math.min(Math.max(Math.round(item.cantidad) || 1, 1), MAX_CANTIDAD);
      interpretacion.items.push({ productoId: producto.id, cantidad, notas: item.notas?.trim() || undefined });
    }
    return interpretacion;
  }
}
