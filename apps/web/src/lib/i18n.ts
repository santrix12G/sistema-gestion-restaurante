import { EN } from './traducciones';

/**
 * Idiomas de la web. Los textos se escriben en español en el código y `t` los traduce con el
 * diccionario de traducciones.ts. Un texto sin traducción sale en español (y avisa en desarrollo).
 */
export type Idioma = 'es' | 'en';
export const IDIOMAS: { codigo: Idioma; nombre: string }[] = [
  { codigo: 'es', nombre: 'Español' },
  { codigo: 'en', nombre: 'English' },
];

let actual: Idioma = 'es';
const avisados = new Set<string>();

/** Lo fija el proveedor de preferencias. Al cambiarlo, la página se vuelve a dibujar completa */
export function fijarIdioma(idioma: Idioma) {
  actual = idioma;
}

export const idiomaActual = () => actual;

/** Formato regional de fechas y números del idioma actual */
export const regionActual = () => (actual === 'en' ? 'en-US' : 'es-CO');

/** Traduce un texto. Las variables van entre llaves: t('Mesa {codigo}', { codigo: 'M3' }) */
export function t(texto: string, variables?: Record<string, string | number>) {
  let traducido = texto;
  if (actual === 'en') {
    const en = EN[texto];
    if (en !== undefined) traducido = en;
    else if (process.env.NODE_ENV !== 'production' && !avisados.has(texto)) {
      avisados.add(texto);
      console.warn(`[i18n] Falta traducir: ${JSON.stringify(texto)}`);
    }
  }
  return variables ? traducido.replace(/\{(\w+)\}/g, (marca, clave: string) => (clave in variables ? String(variables[clave]) : marca)) : traducido;
}

/** Plural sencillo: plural(3, 'pedido', 'pedidos') → "3 pedidos", traducido */
export const plural = (n: number, uno: string, varios: string) => `${n} ${t(n === 1 ? uno : varios)}`;
