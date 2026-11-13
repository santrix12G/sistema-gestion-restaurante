// Motor de NLP por reglas: sin costo, sin red y predecible. Es el respaldo del LLM y el que usan las pruebas.
import { BuscadorProductos, normalizar } from './buscador-productos';
import { Interpretacion, ItemInterpretado } from './interpretacion';

const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, docena: 12, par: 2, media: 6,
};

const PALABRAS_DE_NOTA = new Set(['sin', 'con', 'extra', 'bien', 'termino', 'poco', 'poca', 'mucho', 'mucha', 'doble', 'aparte']);

/** Una nota necesita al menos dos palabras: "sin cebolla" sí, pero el "con" de "pollo con papas" no. */
function notaDesde(palabras: string[]): string | undefined {
  const inicio = palabras.findIndex((p) => PALABRAS_DE_NOTA.has(p));
  const nota = inicio >= 0 ? palabras.slice(inicio) : [];
  return nota.length >= 2 ? nota.join(' ') : undefined;
}

const prueba = (texto: string, patron: RegExp) => patron.test(texto);

function cantidadDe(palabra: string | undefined): number | undefined {
  if (!palabra) return undefined;
  if (/^\d{1,3}$/.test(palabra)) return Number(palabra);
  return NUMEROS[palabra];
}

/**
 * Extrae los productos de un mensaje. Entiende cantidades en número o palabra,
 * y notas como "sin cebolla". "2 hamburguesas, una sin cebolla" queda como 1 normal y 1 sin cebolla.
 */
export function extraerItems(texto: string, buscador: BuscadorProductos): ItemInterpretado[] {
  const items: ItemInterpretado[] = [];
  // Se divide antes de normalizar, porque normalizar quita las comas
  const segmentos = texto
    .split(/[,;.\n]/)
    .flatMap((parte) => normalizar(parte).split(/\s+y\s+|\s+mas\s+|\s+tambien\s+|\s+ademas\s+/))
    .filter(Boolean);

  for (const segmento of segmentos) {
    const palabras = segmento.split(' ');
    const encontrados = buscador.encontrar(palabras);

    if (encontrados.length === 0) {
      // "una sin cebolla" o "sin cebolla": se refiere al último producto mencionado
      const anterior = items.at(-1);
      const notas = notaDesde(palabras);
      if (!anterior || !notas) continue;
      const cantidad = cantidadDe(palabras[palabras.findIndex((p) => PALABRAS_DE_NOTA.has(p)) - 1]);
      if (cantidad && cantidad < anterior.cantidad) {
        anterior.cantidad -= cantidad;
        items.push({ productoId: anterior.productoId, cantidad, notas });
      } else {
        anterior.notas = anterior.notas ? `${anterior.notas}, ${notas}` : notas;
      }
      continue;
    }

    encontrados.forEach((c, i) => {
      const limiteAnterior = i === 0 ? 0 : encontrados[i - 1].fin;
      const limiteSiguiente = encontrados[i + 1]?.inicio ?? palabras.length;
      // La cantidad va justo antes del producto: "2 hamburguesas", "dos de pollo", "una limonada"
      let cantidad = 1;
      for (let j = c.inicio - 1; j >= Math.max(limiteAnterior, c.inicio - 3); j--) {
        const n = cantidadDe(palabras[j]);
        if (n !== undefined) {
          cantidad = palabras[j] === 'docena' && palabras[j - 1] === 'media' ? 6 : n;
          break;
        }
      }
      items.push({ productoId: c.producto.id, cantidad, notas: notaDesde(palabras.slice(c.fin, limiteSiguiente)) });
    });
  }
  return items;
}

export function interpretarConReglas(texto: string, buscador: BuscadorProductos): Interpretacion {
  const t = normalizar(texto);
  const items = extraerItems(texto, buscador);
  const tipoEntrega: Interpretacion['tipoEntrega'] = prueba(t, /\b(domicilio|envio|enviar|envian|llevar|llevan|traer|traigan)\b/)
    ? 'DOMICILIO'
    : prueba(t, /\b(recoger|recojo|paso por|voy por|para llevar|en el local)\b/)
      ? 'RECOGER'
      : undefined;
  const base = { items, tipoEntrega, noReconocidos: [] as string[] };

  if (prueba(t, /\b(cancela|cancelar|cancelo|cancelalo|anula|anular)\b/)) return { ...base, intencion: 'cancelar' };
  if (prueba(t, /\b(empezar de nuevo|empecemos de nuevo|borra todo|borrar todo|vaciar|vacia el)\b/)) return { ...base, intencion: 'vaciar' };
  if (items.length && prueba(t, /\b(quita|quitale|quitame|quitar|elimina|eliminar|borra|borrar|saca|sacale|ya no quiero)\b/)) {
    return { ...base, intencion: 'quitar' };
  }
  if (items.length) return { ...base, intencion: 'agregar' };
  if (prueba(t, /\b(menu|carta|que (tienen|venden|hay|ofrecen)|precios?)\b/)) return { ...base, intencion: 'menu' };
  // Antes de confirmar: "sí, en línea" elige el pago en línea
  if (prueba(t, /\b(en linea|online|tarjeta|pse|pagar ahora|pago ahora|link de pago|enlace de pago)\b/)) return { ...base, intencion: 'pago_en_linea' };
  if (prueba(t, /\b(efectivo|contra entrega|al recibir|cash)\b/)) return { ...base, intencion: 'pago_efectivo' };
  if (prueba(t, /^(si+|claro|dale|ok|okey|okay|confirmo|confirmar|correcto|de una|perfecto|esta bien|asi esta bien|listo si)\b/)) {
    return { ...base, intencion: 'confirmar' };
  }
  if (prueba(t, /^(no|nop|nel|negativo)\b/)) return { ...base, intencion: 'negar' };
  if (prueba(t, /\b(listo|eso es todo|es todo|seria todo|nada mas|ya esta|ya es todo|termine|solo eso|eso seria)\b/)) {
    return { ...base, intencion: 'terminar' };
  }
  if (tipoEntrega) return { ...base, intencion: tipoEntrega === 'DOMICILIO' ? 'domicilio' : 'recoger' };
  if (prueba(t, /\b(hola|holi|buenas|buenos dias|buen dia|buenas tardes|buenas noches|hey)\b/)) return { ...base, intencion: 'saludo' };
  if (prueba(t, /\b(ayuda|como funciona|como pido|no entiendo)\b/)) return { ...base, intencion: 'ayuda' };
  if (prueba(t, /\b(quiero|quisiera|dame|deme|me das|regalame|me regala|me trae|me traes|pedir|ordenar|para mi)\b/)) {
    // Quiere pedir algo, pero no se reconoció ningún producto del menú
    return { ...base, intencion: 'agregar', noReconocidos: [texto.trim()] };
  }
  return { ...base, intencion: 'otro' };
}
