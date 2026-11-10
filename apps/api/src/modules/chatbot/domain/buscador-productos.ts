// Encuentra productos del menú dentro de un texto, por su nombre o por sus sinónimos.

export interface ProductoBot {
  id: string;
  nombre: string;
  precio: number;
  disponible: boolean;
  sinonimos: string[];
  categoria: string;
}

/** Minúsculas, sin tildes ni signos: "¡Quiero 2 Limonadas!" → "quiero 2 limonadas" */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Singular aproximado, solo para comparar con el menú: "hamburguesas" → "hamburguesa", "limones" → "limon" */
export function singular(palabra: string): string {
  if (palabra.length <= 3) return palabra;
  if (/[^aeiou]es$/.test(palabra) && palabra.length > 4) return palabra.slice(0, -2);
  if (palabra.endsWith('s')) return palabra.slice(0, -1);
  return palabra;
}

const tokens = (texto: string) => normalizar(texto).split(' ').filter(Boolean);

export interface Coincidencia {
  producto: ProductoBot;
  /** Posición de la primera y la siguiente a la última palabra del producto en el texto */
  inicio: number;
  fin: number;
}

export class BuscadorProductos {
  private readonly alias: { palabras: string[]; producto: ProductoBot }[];

  constructor(readonly productos: ProductoBot[]) {
    this.alias = productos
      .flatMap((producto) => [producto.nombre, ...producto.sinonimos].map((a) => ({ palabras: tokens(a).map(singular), producto })))
      .filter((a) => a.palabras.length > 0)
      // Primero los más largos: "hamburguesa con queso" gana sobre "hamburguesa"
      .sort((a, b) => b.palabras.length - a.palabras.length);
  }

  /** Recorre las palabras ya normalizadas y devuelve cada producto mencionado, sin solaparse. */
  encontrar(palabras: string[]): Coincidencia[] {
    const comparables = palabras.map(singular);
    const encontradas: Coincidencia[] = [];
    for (let i = 0; i < comparables.length; ) {
      const alias = this.alias.find((a) => a.palabras.every((p, j) => comparables[i + j] === p));
      if (alias) {
        encontradas.push({ producto: alias.producto, inicio: i, fin: i + alias.palabras.length });
        i += alias.palabras.length;
      } else {
        i++;
      }
    }
    return encontradas;
  }

  /** Para el LLM, que devuelve el nombre del producto: busca una coincidencia exacta o que lo contenga completo. */
  resolver(nombre: string): ProductoBot | undefined {
    const palabras = tokens(nombre);
    const exacta = this.alias.find((a) => a.palabras.length === palabras.length && a.palabras.every((p, j) => singular(palabras[j]) === p));
    if (exacta) return exacta.producto;
    const encontradas = this.encontrar(palabras);
    return encontradas.length === 1 ? encontradas[0].producto : undefined;
  }
}
