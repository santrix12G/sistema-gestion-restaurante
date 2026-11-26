import { Injectable } from '@nestjs/common';
import { ContextoNlp, MotorNlp } from '../application/puertos';
import { BuscadorProductos } from '../domain/buscador-productos';
import { interpretarConReglas } from '../domain/nlu-reglas';

/**
 * Entiende con reglas: sin costo, sin red y predecible. Atiende el chat cuando NLP_PROVIDER=reglas
 * y es el respaldo cuando el LLM (agente-claude.ts o agente-openai.ts) no puede responder.
 */
@Injectable()
export class MotorReglas implements MotorNlp {
  async interpretar(texto: string, { menu }: ContextoNlp) {
    return interpretarConReglas(texto, new BuscadorProductos(menu));
  }
}
