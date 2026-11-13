// La conversación del bot como máquina de estados. Lógica pura: recibe lo que entendió el NLP
// y devuelve el nuevo estado y las respuestas. No envía mensajes ni guarda nada.
import { ProductoBot } from './buscador-productos';
import { Interpretacion, ItemInterpretado } from './interpretacion';

export type Paso = 'INICIO' | 'ARMANDO_PEDIDO' | 'TIPO_ENTREGA' | 'DIRECCION' | 'METODO_PAGO' | 'CONFIRMACION';

export interface ItemCarrito {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  notas?: string;
}

export interface ContextoConversacion {
  carrito: ItemCarrito[];
  tipoEntrega?: 'DOMICILIO' | 'RECOGER';
  direccion?: string;
  /** Sin elegir, se paga en efectivo al recibir */
  metodoPago?: 'EFECTIVO' | 'ONLINE';
}

export interface EstadoConversacion {
  paso: Paso;
  contexto: ContextoConversacion;
}

export interface Resultado extends EstadoConversacion {
  respuestas: string[];
  /** El cliente confirmó: hay que crear el pedido con lo que está en el contexto */
  crearPedido: boolean;
}

export const MAX_CANTIDAD = 50;
export const CONTEXTO_VACIO: ContextoConversacion = { carrito: [] };

const pesos = (valor: number) => `$${valor.toLocaleString('es-CO')}`;

export function textoMenu(menu: ProductoBot[]): string {
  const disponibles = menu.filter((p) => p.disponible);
  if (disponibles.length === 0) return 'Por ahora no tenemos productos disponibles. Intenta más tarde, por favor.';
  const categorias = [...new Set(disponibles.map((p) => p.categoria))];
  const secciones = categorias.map(
    (c) => `*${c}*\n${disponibles.filter((p) => p.categoria === c).map((p) => `• ${p.nombre} — ${pesos(p.precio)}`).join('\n')}`,
  );
  return `📋 *Nuestro menú*\n\n${secciones.join('\n\n')}\n\nEscríbeme lo que quieres, por ejemplo: *2 ${disponibles[0].nombre.toLowerCase()}*`;
}

function textoCarrito(carrito: ItemCarrito[]) {
  return carrito.map((i) => `• ${i.cantidad}× ${i.nombre}${i.notas ? ` (${i.notas})` : ''} — ${pesos(i.precio * i.cantidad)}`).join('\n');
}

/** Cómo se paga y qué se le pide responder. El pago en línea solo se ofrece si la pasarela está configurada. */
function textoPago(contexto: ContextoConversacion, pagoEnLinea: boolean): string[] {
  if (!pagoEnLinea) return ['💵 Pago en efectivo al recibir', '', '¿Lo confirmo? Responde *sí* o *no*'];
  if (contexto.metodoPago === 'ONLINE') {
    return ['💳 Pago en línea (tarjeta o PSE): te envío el enlace al confirmar', '', '¿Lo confirmo? Responde *sí* o *no*.\nSi prefieres pagar en efectivo al recibir, escribe *efectivo*.'];
  }
  return [
    '💵 Pagas en efectivo al recibir, o 💳 en línea con tarjeta o PSE',
    '',
    '¿Lo confirmo? Responde *sí* para pagar en efectivo al recibir, *en línea* para pagar ahora, o *no* para cambiarlo.',
  ];
}

export function textoResumen(contexto: ContextoConversacion, costoDomicilio: number, pagoEnLinea = false) {
  const subtotal = contexto.carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const domicilio = contexto.tipoEntrega === 'DOMICILIO' ? costoDomicilio : 0;
  const entrega = contexto.tipoEntrega === 'DOMICILIO' ? `🛵 A domicilio: ${contexto.direccion}` : '🏪 Para recoger en el restaurante';
  return [
    '🧾 *Tu pedido*',
    textoCarrito(contexto.carrito),
    ...(domicilio ? [`• Domicilio — ${pesos(domicilio)}`] : []),
    `*Total: ${pesos(subtotal + domicilio)}*`,
    '',
    entrega,
    ...textoPago(contexto, pagoEnLinea),
  ].join('\n');
}

const BIENVENIDA =
  '¡Hola! 👋 Soy el asistente de pedidos del restaurante.\n\nEscríbeme lo que quieres, por ejemplo: *2 hamburguesas clásicas y una limonada*.\nEscribe *menú* para ver la carta o *cancelar* en cualquier momento.';

const AYUDA =
  'Así funciona:\n1. Dime qué productos quieres y cuántos\n2. Escribe *listo* cuando termines\n3. Elige *domicilio* o *recoger*\n4. Confirma tu pedido\n\nEscribe *menú* para ver la carta.';

/** Agrega los productos al carrito y avisa de los que no están disponibles. */
function agregar(contexto: ContextoConversacion, items: ItemInterpretado[], menu: ProductoBot[]) {
  const carrito = contexto.carrito.map((i) => ({ ...i }));
  const avisos: string[] = [];
  for (const item of items) {
    const producto = menu.find((p) => p.id === item.productoId);
    if (!producto) continue;
    if (!producto.disponible) {
      avisos.push(`😕 *${producto.nombre}* está agotado en este momento.`);
      continue;
    }
    const igual = carrito.find((i) => i.productoId === item.productoId && (i.notas ?? '') === (item.notas ?? ''));
    const nuevaCantidad = (igual?.cantidad ?? 0) + item.cantidad;
    if (item.cantidad < 1 || nuevaCantidad > MAX_CANTIDAD) {
      avisos.push(`Puedo anotar entre 1 y ${MAX_CANTIDAD} unidades de ${producto.nombre}. Para pedidos más grandes, llámanos.`);
      continue;
    }
    if (igual) igual.cantidad = nuevaCantidad;
    else carrito.push({ productoId: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: item.cantidad, notas: item.notas });
  }
  return { contexto: { ...contexto, carrito }, avisos };
}

function quitar(contexto: ContextoConversacion, items: ItemInterpretado[]) {
  const ids = new Set(items.map((i) => i.productoId));
  return { ...contexto, carrito: contexto.carrito.filter((i) => !ids.has(i.productoId)) };
}

function noEncontrados(interpretacion: Interpretacion): string[] {
  if (interpretacion.noReconocidos.length === 0) return [];
  return [`No encontré eso en nuestro menú 🤔. Escribe *menú* para ver lo que tenemos.`];
}

function mostrarCarrito(contexto: ContextoConversacion, avisos: string[]): string[] {
  if (contexto.carrito.length === 0) return [...avisos, 'Tu pedido está vacío. ¿Qué te gustaría pedir?'];
  return [...avisos, `🛒 Llevas:\n${textoCarrito(contexto.carrito)}\n\n¿Algo más? Escribe *listo* cuando termines.`];
}

const PREGUNTA_ENTREGA = '¿Lo quieres *a domicilio* o *para recoger* en el restaurante?';
const PREGUNTA_DIRECCION = '📍 ¿A qué dirección lo enviamos? Incluye barrio y alguna referencia.\nEjemplo: *Calle 15 # 8-22, barrio Centro, casa azul*';

/** Una dirección mínima: algo de texto y al menos un número. */
const pareceDireccion = (texto: string) => texto.trim().length >= 8 && /\d/.test(texto);

export function responder(
  estado: EstadoConversacion,
  interpretacion: Interpretacion,
  textoOriginal: string,
  menu: ProductoBot[],
  costoDomicilio: number,
  /** True si la pasarela de pagos está configurada */
  pagoEnLinea = false,
): Resultado {
  const { paso, contexto } = estado;
  const resultado = (siguiente: Paso, ctx: ContextoConversacion, respuestas: string[], crearPedido = false): Resultado => ({
    paso: siguiente,
    contexto: ctx,
    respuestas,
    crearPedido,
  });
  const resumen = (ctx: ContextoConversacion) => textoResumen(ctx, costoDomicilio, pagoEnLinea);
  const i = interpretacion;

  // Válidas en cualquier paso
  if (i.intencion === 'cancelar') {
    const habiaAlgo = contexto.carrito.length > 0;
    return resultado('INICIO', CONTEXTO_VACIO, [habiaAlgo ? 'Listo, cancelé tu pedido. Cuando quieras, escríbeme de nuevo. 👋' : 'No tienes un pedido en curso. Escríbeme cuando quieras pedir algo. 👋']);
  }
  if (i.intencion === 'menu') return resultado(paso === 'INICIO' ? 'ARMANDO_PEDIDO' : paso, contexto, [textoMenu(menu)]);
  if (i.intencion === 'ayuda') return resultado(paso, contexto, [AYUDA]);
  if (i.intencion === 'vaciar') return resultado('ARMANDO_PEDIDO', CONTEXTO_VACIO, ['Empecemos de nuevo. ¿Qué te gustaría pedir?']);

  // Mientras se espera la dirección, cualquier texto sin productos es la dirección,
  // aunque diga "quiero que lo traigan a la calle 15"
  if (paso === 'DIRECCION' && i.items.length === 0 && i.intencion !== 'recoger') {
    if (!pareceDireccion(textoOriginal)) return resultado('DIRECCION', contexto, ['No reconocí una dirección. ' + PREGUNTA_DIRECCION]);
    return confirmar({ ...contexto, tipoEntrega: 'DOMICILIO', direccion: textoOriginal.trim().slice(0, 200) }, resumen, resultado);
  }

  if (i.intencion === 'pago_en_linea' || i.intencion === 'pago_efectivo') {
    if (i.intencion === 'pago_en_linea' && !pagoEnLinea) {
      const sigue = paso === 'CONFIRMACION' ? ' Responde *sí* para confirmar tu pedido o *no* para cambiarlo.' : '';
      return resultado(paso, contexto, [`Por ahora solo recibimos pago en efectivo al recibir 💵.${sigue}`]);
    }
    const ctx: ContextoConversacion = { ...contexto, metodoPago: i.intencion === 'pago_en_linea' ? 'ONLINE' : 'EFECTIVO' };
    // En la confirmación, elegir cómo pagar también confirma: el resumen ya mostró el total
    if (paso === 'CONFIRMACION') return resultado('CONFIRMACION', ctx, [], true);
    const anotado = ctx.metodoPago === 'ONLINE' ? 'Anotado: te enviaré el enlace de pago al confirmar 💳.' : 'Anotado: pagas en efectivo al recibir 💵.';
    const siguiente: Record<Paso, string> = {
      INICIO: '¿Qué te gustaría pedir?',
      ARMANDO_PEDIDO: ctx.carrito.length ? '¿Algo más? Escribe *listo* cuando termines.' : '¿Qué te gustaría pedir?',
      TIPO_ENTREGA: PREGUNTA_ENTREGA,
      DIRECCION: PREGUNTA_DIRECCION,
      METODO_PAGO: '¿Algo más? Escribe *listo* cuando termines.',
      CONFIRMACION: '',
    };
    return resultado(paso === 'INICIO' ? 'ARMANDO_PEDIDO' : paso, ctx, [`${anotado} ${siguiente[paso]}`]);
  }

  // Agregar o quitar productos se puede en cualquier paso: vuelve a armar el pedido
  if (i.intencion === 'agregar' || i.intencion === 'quitar') {
    if (i.items.length === 0) return resultado(paso === 'INICIO' ? 'ARMANDO_PEDIDO' : paso, contexto, noEncontrados(i).length ? noEncontrados(i) : [AYUDA]);
    const { contexto: ctx, avisos } = i.intencion === 'agregar' ? agregar(contexto, i.items, menu) : { contexto: quitar(contexto, i.items), avisos: [] };
    const conTipo = i.tipoEntrega ? { ...ctx, tipoEntrega: i.tipoEntrega } : ctx;
    return resultado('ARMANDO_PEDIDO', conTipo, [...noEncontrados(i), ...mostrarCarrito(conTipo, avisos)]);
  }

  switch (paso) {
    case 'INICIO':
      return resultado('ARMANDO_PEDIDO', contexto, [BIENVENIDA]);

    case 'ARMANDO_PEDIDO':
    case 'METODO_PAGO':
      if (i.intencion === 'terminar' || i.intencion === 'negar' || i.intencion === 'confirmar') {
        if (contexto.carrito.length === 0) return resultado('ARMANDO_PEDIDO', contexto, ['Aún no has pedido nada. ¿Qué te gustaría? Escribe *menú* para ver la carta.']);
        return elegirEntrega(contexto, contexto.tipoEntrega, resumen, resultado);
      }
      if (i.intencion === 'domicilio' || i.intencion === 'recoger') {
        if (contexto.carrito.length === 0) return resultado('ARMANDO_PEDIDO', { ...contexto, tipoEntrega: i.tipoEntrega }, ['Perfecto. ¿Qué te gustaría pedir?']);
        return elegirEntrega(contexto, i.tipoEntrega, resumen, resultado);
      }
      if (i.intencion === 'saludo') return resultado('ARMANDO_PEDIDO', contexto, contexto.carrito.length ? mostrarCarrito(contexto, []) : [BIENVENIDA]);
      return resultado('ARMANDO_PEDIDO', contexto, ['No te entendí 🤔. Dime qué productos quieres, escribe *menú* para ver la carta o *ayuda* para saber cómo pedir.']);

    case 'TIPO_ENTREGA':
      if (i.tipoEntrega) return elegirEntrega(contexto, i.tipoEntrega, resumen, resultado);
      return resultado('TIPO_ENTREGA', contexto, [PREGUNTA_ENTREGA]);

    case 'DIRECCION':
      return elegirEntrega(contexto, 'RECOGER', resumen, resultado);

    case 'CONFIRMACION':
      if (i.intencion === 'confirmar' || i.intencion === 'terminar') return resultado('CONFIRMACION', contexto, [], true);
      if (i.intencion === 'negar') return resultado('ARMANDO_PEDIDO', contexto, ['Sin problema. ¿Qué quieres cambiar? Puedes agregar productos, pedir que *quite* alguno o escribir *cancelar*.']);
      if (i.intencion === 'domicilio' || i.intencion === 'recoger') return elegirEntrega(contexto, i.tipoEntrega, resumen, resultado);
      return resultado('CONFIRMACION', contexto, ['Responde *sí* para confirmar tu pedido o *no* para cambiarlo.']);
  }
}

type Resumen = (contexto: ContextoConversacion) => string;

function elegirEntrega(
  contexto: ContextoConversacion,
  tipo: ContextoConversacion['tipoEntrega'],
  resumen: Resumen,
  resultado: (p: Paso, c: ContextoConversacion, r: string[]) => Resultado,
): Resultado {
  if (tipo === 'RECOGER') return confirmar({ ...contexto, tipoEntrega: 'RECOGER', direccion: undefined }, resumen, resultado);
  if (tipo === 'DOMICILIO') return resultado('DIRECCION', { ...contexto, tipoEntrega: 'DOMICILIO' }, [PREGUNTA_DIRECCION]);
  return resultado('TIPO_ENTREGA', contexto, [PREGUNTA_ENTREGA]);
}

function confirmar(contexto: ContextoConversacion, resumen: Resumen, resultado: (p: Paso, c: ContextoConversacion, r: string[]) => Resultado): Resultado {
  return resultado('CONFIRMACION', contexto, [resumen(contexto)]);
}
