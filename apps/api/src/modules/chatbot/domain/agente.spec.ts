import { contextoAgente, EntradaAgente, SesionAgente } from './agente';
import { ProductoBot } from './buscador-productos';
import { CONTEXTO_VACIO, EstadoConversacion } from './dialogo';

const MENU: ProductoBot[] = [
  { id: 'hq', nombre: 'Hamburguesa con queso', precio: 21000, disponible: true, sinonimos: ['cheeseburger'], categoria: 'Hamburguesas' },
  { id: 'li', nombre: 'Limonada natural', precio: 6000, disponible: true, sinonimos: ['limonada'], categoria: 'Bebidas' },
  { id: 'ca', nombre: 'Carne asada', precio: 28000, disponible: false, sinonimos: ['carne'], categoria: 'Platos fuertes' },
];

const entrada = (estado: EstadoConversacion = { paso: 'INICIO', contexto: CONTEXTO_VACIO }, pagoEnLinea = false): EntradaAgente => ({
  texto: '',
  historial: [],
  estado,
  menu: MENU,
  costoDomicilio: 5000,
  pagoEnLinea,
});

/** Un pedido con productos y dirección, al que ya se le mostró el resumen */
function conResumenVisto() {
  const s = new SesionAgente(entrada());
  s.ejecutar('agregar_productos', { items: [{ producto: 'Hamburguesa con queso', cantidad: 2, notas: null }] });
  s.ejecutar('elegir_entrega', { tipo: 'DOMICILIO', direccion: 'Calle 15 # 8-22, barrio Centro' });
  s.ejecutar('mostrar_resumen', {});
  const r = s.terminar('Este es tu pedido:')!;
  return { paso: r.paso, contexto: r.contexto };
}

describe('Agente: herramientas del pedido', () => {
  it('agrega con el precio del menú, no con el que diga el modelo', () => {
    const s = new SesionAgente(entrada());
    const salida = s.ejecutar('agregar_productos', { items: [{ producto: 'cheeseburger', cantidad: 2, notas: 'sin cebolla' }], precio: 1 });
    expect(salida.error).toBe(false);
    expect(s.terminar('Listo')!.contexto.carrito).toEqual([
      { productoId: 'hq', nombre: 'Hamburguesa con queso', precio: 21000, cantidad: 2, notas: 'sin cebolla' },
    ]);
  });

  it('avisa lo que no está en el menú o está agotado, sin agregarlo', () => {
    const s = new SesionAgente(entrada());
    const salida = s.ejecutar('agregar_productos', {
      items: [
        { producto: 'pizza', cantidad: 1, notas: null },
        { producto: 'Carne asada', cantidad: 1, notas: null },
      ],
    });
    expect(salida.texto).toMatch(/"pizza" no está en el menú/);
    expect(salida.texto).toMatch(/Carne asada está agotado/);
    expect(s.terminar('...')!.contexto.carrito).toEqual([]);
  });

  it('quita unidades o el producto completo', () => {
    const s = new SesionAgente(entrada());
    s.ejecutar('agregar_productos', { items: [{ producto: 'limonada', cantidad: 3, notas: null }, { producto: 'cheeseburger', cantidad: 1, notas: null }] });
    s.ejecutar('quitar_productos', { items: [{ producto: 'limonada', cantidad: 1 }, { producto: 'Hamburguesa con queso', cantidad: null }] });
    expect(s.terminar('ok')!.contexto.carrito).toEqual([expect.objectContaining({ productoId: 'li', cantidad: 2 })]);
  });

  it('un domicilio necesita una dirección con número', () => {
    const s = new SesionAgente(entrada());
    s.ejecutar('agregar_productos', { items: [{ producto: 'limonada', cantidad: 1, notas: null }] });
    expect(s.ejecutar('elegir_entrega', { tipo: 'DOMICILIO', direccion: null }).texto).toMatch(/Falta la dirección/);
    expect(s.ejecutar('elegir_entrega', { tipo: 'DOMICILIO', direccion: 'por el parque' }).error).toBe(true);
    expect(s.ejecutar('mostrar_resumen', {}).texto).toMatch(/Falta la dirección/);
    expect(s.terminar('¿A qué dirección?')!.paso).toBe('DIRECCION');
  });

  it('el resumen oficial con el total se envía después del texto del modelo', () => {
    const s = new SesionAgente(entrada());
    s.ejecutar('agregar_productos', { items: [{ producto: 'Hamburguesa con queso', cantidad: 2, notas: null }] });
    s.ejecutar('elegir_entrega', { tipo: 'DOMICILIO', direccion: 'Calle 15 # 8-22, barrio Centro' });
    s.ejecutar('mostrar_resumen', {});
    const r = s.terminar('¡Perfecto! Revisa tu pedido:')!;
    expect(r.paso).toBe('CONFIRMACION');
    expect(r.respuestas[0]).toBe('¡Perfecto! Revisa tu pedido:');
    expect(r.respuestas[1]).toContain('*Total: $47.000*');
    expect(r.crearPedido).toBe(false);
  });

  it('no confirma un pedido cuyo resumen el cliente no ha visto', () => {
    const s = new SesionAgente(entrada());
    s.ejecutar('agregar_productos', { items: [{ producto: 'limonada', cantidad: 1, notas: null }] });
    s.ejecutar('elegir_entrega', { tipo: 'RECOGER', direccion: null });
    s.ejecutar('mostrar_resumen', {});
    expect(s.ejecutar('confirmar_pedido', {}).error).toBe(true);
    expect(s.terminar('Revisa tu pedido')!.crearPedido).toBe(false);
  });

  it('confirma cuando el cliente acepta el resumen que vio, y deja la respuesta al caso de uso', () => {
    const s = new SesionAgente(entrada(conResumenVisto()));
    expect(s.ejecutar('confirmar_pedido', {}).error).toBe(false);
    expect(s.terminar('¡Listo!')).toMatchObject({ crearPedido: true, respuestas: [] });
  });

  it('si el pedido cambia después del resumen, hay que mostrarlo de nuevo', () => {
    const s = new SesionAgente(entrada(conResumenVisto()));
    s.ejecutar('agregar_productos', { items: [{ producto: 'limonada', cantidad: 1, notas: null }] });
    expect(s.ejecutar('confirmar_pedido', {}).texto).toMatch(/mostrar_resumen/);
  });

  it('el pago en línea solo se acepta si la pasarela está configurada', () => {
    expect(new SesionAgente(entrada()).ejecutar('elegir_pago', { metodo: 'ONLINE' }).error).toBe(true);
    const conPasarela = new SesionAgente(entrada(undefined, true));
    expect(conPasarela.ejecutar('elegir_pago', { metodo: 'ONLINE' }).error).toBe(false);
  });

  it('cancelar descarta el pedido y una herramienta desconocida es un error', () => {
    const s = new SesionAgente(entrada(conResumenVisto()));
    expect(s.ejecutar('regalar_pedido', {}).error).toBe(true);
    s.ejecutar('cancelar_pedido', {});
    expect(s.terminar('Listo, lo cancelé')).toMatchObject({ paso: 'INICIO', contexto: { carrito: [] } });
  });

  it('sin texto ni resumen no hay nada que enviar: responden las reglas', () => {
    expect(new SesionAgente(entrada()).terminar('  ')).toBeNull();
  });

  it('el contexto le muestra al modelo el menú con precios, los agotados y el pedido en curso', () => {
    const texto = contextoAgente(entrada(conResumenVisto()));
    expect(texto).toContain('Hamburguesa con queso (Hamburguesas): $21.000');
    expect(texto).toContain('Agotados hoy: Carne asada');
    expect(texto).toContain('2× Hamburguesa con queso');
    expect(texto).toContain('se espera que lo confirme');
  });
});
