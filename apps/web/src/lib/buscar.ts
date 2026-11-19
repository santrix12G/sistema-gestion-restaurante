import { codigoMesa, destino } from './formato';
import { Pedido } from './tipos';

/** Minúsculas y sin tildes: "Limonáda" y "limonada" coinciden */
export const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * ¿El pedido coincide con lo que se escribió en el buscador? Busca por número de pedido (12 o #12),
 * por mesa (L1, AF2, M3 o mesa 3) y por palabras: cliente, teléfono, productos, notas, dirección y personal.
 * Todas las palabras deben aparecer.
 */
export function coincide(pedido: Pedido, consulta: string) {
  const palabras = normalizar(consulta)
    // "mesa 3" es la M3; "mesa L1" es la L1
    .replace(/\bmesa\s*(\d+)/g, 'm$1')
    .replace(/\bmesa\s+(?=[a-z]+\d)/g, '')
    .split(/[\s#,]+/)
    .filter(Boolean);
  if (palabras.length === 0) return true;

  const mesa = pedido.mesa ? normalizar(codigoMesa(pedido.mesa)) : null;
  const texto = normalizar(
    [
      destino(pedido),
      pedido.cliente?.nombre,
      pedido.cliente?.telefono,
      pedido.creadoPor?.nombre,
      pedido.entrega?.direccionTexto,
      pedido.entrega?.direccion.barrio,
      pedido.entrega?.repartidor?.nombre,
      pedido.notas,
      ...pedido.detalles.flatMap((d) => [d.nombreProducto, d.notas]),
    ]
      .filter(Boolean)
      .join(' '),
  );

  return palabras.every((palabra) => {
    if (palabra === mesa) return true;
    // Un número corto es un número de pedido; uno largo, parte de un teléfono
    if (/^\d+$/.test(palabra)) return palabra === String(pedido.numero) || (palabra.length >= 4 && texto.includes(palabra));
    return texto.includes(palabra);
  });
}
