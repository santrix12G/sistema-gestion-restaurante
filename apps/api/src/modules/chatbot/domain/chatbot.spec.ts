import { BuscadorProductos, ProductoBot } from './buscador-productos';
import { CONTEXTO_VACIO, EstadoConversacion, responder } from './dialogo';
import { interpretarConReglas } from './nlu-reglas';

const MENU: ProductoBot[] = [
  { id: 'hc', nombre: 'Hamburguesa clásica', precio: 18000, disponible: true, sinonimos: ['hamburguesa', 'burger'], categoria: 'Hamburguesas' },
  { id: 'hq', nombre: 'Hamburguesa con queso', precio: 21000, disponible: true, sinonimos: ['cheeseburger'], categoria: 'Hamburguesas' },
  { id: 'pf', nombre: 'Papas a la francesa', precio: 7000, disponible: true, sinonimos: ['papas', 'francesas'], categoria: 'Acompañamientos' },
  { id: 'li', nombre: 'Limonada natural', precio: 6000, disponible: true, sinonimos: ['limonada'], categoria: 'Bebidas' },
  { id: 'ca', nombre: 'Carne asada', precio: 28000, disponible: false, sinonimos: ['carne'], categoria: 'Platos fuertes' },
  { id: 'po', nombre: 'Pollo a la plancha', precio: 24000, disponible: true, sinonimos: ['pollo'], categoria: 'Platos fuertes' },
];
const buscador = new BuscadorProductos(MENU);
const entender = (texto: string) => interpretarConReglas(texto, buscador);

describe('NLP por reglas', () => {
  it('reconoce productos por nombre, sinónimo y plural, con cantidades en número o palabra', () => {
    expect(entender('Quiero 2 hamburguesas con queso y una limonada').items).toEqual([
      { productoId: 'hq', cantidad: 2, notas: undefined },
      { productoId: 'li', cantidad: 1, notas: undefined },
    ]);
    expect(entender('dame tres burgers, unas papas').items).toEqual([
      { productoId: 'hc', cantidad: 3, notas: undefined },
      { productoId: 'pf', cantidad: 1, notas: undefined },
    ]);
  });

  it('prefiere el nombre más largo', () => {
    expect(entender('una hamburguesa con queso').items[0].productoId).toBe('hq');
    expect(entender('una hamburguesa').items[0].productoId).toBe('hc');
  });

  it('separa las notas de una parte de la cantidad', () => {
    expect(entender('2 hamburguesas clásicas, una sin cebolla').items).toEqual([
      { productoId: 'hc', cantidad: 1, notas: undefined },
      { productoId: 'hc', cantidad: 1, notas: 'sin cebolla' },
    ]);
    expect(entender('un pollo bien asado').items).toEqual([{ productoId: 'po', cantidad: 1, notas: 'bien asado' }]);
  });

  it('no confunde un producto acompañado de otro con una nota', () => {
    expect(entender('pollo con papas').items.map((i) => [i.productoId, i.notas])).toEqual([['po', undefined], ['pf', undefined]]);
  });

  it.each([
    ['hola, buenas tardes', 'saludo'],
    ['me muestras el menú?', 'menu'],
    ['Sí, confirmo', 'confirmar'],
    ['no', 'negar'],
    ['eso es todo', 'terminar'],
    ['a domicilio por favor', 'domicilio'],
    ['paso a recoger', 'recoger'],
    ['cancela todo', 'cancelar'],
    ['quítale las papas', 'quitar'],
    ['quiero una pizza', 'agregar'],
    ['jajaja', 'otro'],
  ])('"%s" es %s', (texto, intencion) => {
    expect(entender(texto).intencion).toBe(intencion);
  });

  it('marca lo que pidió y no está en el menú', () => {
    expect(entender('quiero una pizza').noReconocidos).toEqual(['quiero una pizza']);
  });
});

describe('diálogo', () => {
  function conversar(mensajes: string[], inicial: EstadoConversacion = { paso: 'INICIO', contexto: CONTEXTO_VACIO }) {
    let estado = inicial;
    let ultimo;
    for (const texto of mensajes) {
      ultimo = responder(estado, entender(texto), texto, MENU, 5000);
      estado = ultimo;
    }
    return ultimo!;
  }

  it('lleva un domicilio de principio a fin', () => {
    const r = conversar(['hola', '2 hamburguesas con queso, una sin cebolla, y una limonada', 'listo', 'a domicilio', 'Calle 15 # 8-22, barrio Centro']);
    expect(r.paso).toBe('CONFIRMACION');
    expect(r.respuestas[0]).toContain('*Total: $53.000*');
    expect(r.respuestas[0]).toContain('Hamburguesa con queso (sin cebolla)');
    expect(r.contexto).toMatchObject({ tipoEntrega: 'DOMICILIO', direccion: 'Calle 15 # 8-22, barrio Centro' });

    const final = responder(r, entender('sí'), 'sí', MENU, 5000);
    expect(final.crearPedido).toBe(true);
  });

  it('para recoger no pide dirección ni cobra domicilio', () => {
    const r = conversar(['una limonada para recoger', 'listo']);
    expect(r.paso).toBe('CONFIRMACION');
    expect(r.respuestas[0]).toContain('*Total: $6.000*');
  });

  it('suma las cantidades de un mismo producto', () => {
    const r = conversar(['una limonada', 'otra limonada']);
    expect(r.contexto.carrito).toEqual([expect.objectContaining({ productoId: 'li', cantidad: 2 })]);
  });

  it('avisa de lo agotado sin agregarlo', () => {
    const r = conversar(['una carne asada y una limonada']);
    expect(r.respuestas[0]).toContain('Carne asada* está agotado');
    expect(r.contexto.carrito.map((i) => i.productoId)).toEqual(['li']);
  });

  it('no avanza sin productos', () => {
    expect(conversar(['hola', 'listo']).respuestas[0]).toMatch(/Aún no has pedido nada/);
  });

  it('pide de nuevo la dirección si no la reconoce', () => {
    const r = conversar(['una limonada', 'listo', 'domicilio', 'en mi casa']);
    expect(r.paso).toBe('DIRECCION');
    expect(r.respuestas[0]).toMatch(/No reconocí una dirección/);
  });

  it('acepta la dirección aunque venga en una frase', () => {
    const r = conversar(['una limonada', 'listo', 'domicilio', 'quiero que me lo traigan a la carrera 7 # 12-30']);
    expect(r.paso).toBe('CONFIRMACION');
  });

  it('al decir que no en la confirmación vuelve a armar el pedido sin perderlo', () => {
    const r = conversar(['una limonada', 'listo', 'recoger', 'no']);
    expect(r.paso).toBe('ARMANDO_PEDIDO');
    expect(r.contexto.carrito).toHaveLength(1);
  });

  it('cancela en cualquier paso', () => {
    const r = conversar(['una limonada', 'listo', 'domicilio', 'cancelar']);
    expect(r).toMatchObject({ paso: 'INICIO', contexto: { carrito: [] } });
  });

  it('limita la cantidad', () => {
    const r = conversar(['60 limonadas']);
    expect(r.contexto.carrito).toHaveLength(0);
    expect(r.respuestas[0]).toMatch(/entre 1 y 50/);
  });
});
