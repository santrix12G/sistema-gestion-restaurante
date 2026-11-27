// Los modelos escriben en Markdown (**negrita**, # títulos, - listas). WhatsApp tiene su propio formato
// (*negrita*, _cursiva_, ~tachado~) y muestra el Markdown tal cual, con los asteriscos a la vista.
// Telegram recibe el formato de WhatsApp y lo pasa a HTML (aHtmlTelegram), así que basta con uno.

/** Pasa el Markdown que escribe un LLM al formato de chat de WhatsApp. */
export function aFormatoChat(texto: string): string {
  const lineas = texto
    .replace(/\r\n?/g, '\n')
    // Bloques de código: se deja solo el contenido
    .replace(/```[a-z]*\n?([\s\S]*?)```/gi, '$1')
    .split('\n')
    .map((linea) => {
      // Líneas separadoras (---, ***) y filas separadoras de tablas
      if (/^\s*([-*_]\s*){3,}$/.test(linea) || /^\s*\|?\s*:?-{3,}/.test(linea)) return null;
      return (
        linea
          // # Título -> *Título*
          .replace(/^\s*#{1,6}\s+(.+?)\s*#*\s*$/, (_, t: string) => `*${t.replace(/\*+/g, '')}*`)
          // Listas con guion, asterisco o más -> viñeta
          .replace(/^(\s*)[-*+]\s+/, (_, sangria: string) => `${sangria}• `)
          // Filas de tabla: | a | b | -> a · b
          .replace(/^\s*\|(.+)\|\s*$/, (_, celdas: string) => celdas.split('|').map((c) => c.trim()).filter(Boolean).join(' · '))
      );
    })
    .filter((l): l is string => l !== null);

  return (
    lineas
      .join('\n')
      // **negrita** o __negrita__ -> *negrita*
      .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, '*$1*')
      .replace(/__(?=\S)([^_\n]+?)__/g, '*$1*')
      // ~~tachado~~ -> ~tachado~
      .replace(/~~(?=\S)([^~\n]+?)~~/g, '~$1~')
      // [texto](https://...) -> texto: https://...
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t: string, url: string) => (t === url ? url : `${t}: ${url}`))
      // `código` -> código
      .replace(/`([^`\n]+)`/g, '$1')
      // A veces el modelo repite la misma pregunta seguida: "¿A domicilio?¿A domicilio?"
      .replace(/(¿[^¿?\n]+\?)(\s*\1)+/g, '$1')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
