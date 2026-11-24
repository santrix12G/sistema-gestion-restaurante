import { idiomaActual } from './i18n';

export type Celda = string | number | null | undefined;

/**
 * Arma un archivo CSV que Excel en español abre bien: separado por punto y coma, con coma decimal
 * y con la marca UTF-8 al inicio para que las tildes y la ñ se vean bien. En inglés, como lo espera
 * Excel en ese idioma: separado por comas y con punto decimal.
 */
export function armarCsv(filas: Celda[][], ingles = idiomaActual() === 'en') {
  const separador = ingles ? ',' : ';';
  const celda = (valor: Celda) => {
    if (valor === null || valor === undefined) return '';
    const texto = typeof valor === 'number' ? (ingles ? String(valor) : String(valor).replace('.', ',')) : valor;
    return /[;,"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return '﻿' + filas.map((fila) => fila.map(celda).join(separador)).join('\r\n');
}

/** Descarga el CSV en el navegador con ese nombre de archivo */
export function descargarCsv(nombre: string, filas: Celda[][]) {
  const url = URL.createObjectURL(new Blob([armarCsv(filas)], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
