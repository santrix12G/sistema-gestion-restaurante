import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { leerConfig } from '../src/shared/config';

let app: INestApplication;
const tokens: Record<string, string> = {};

const api = () => request(app.getHttpServer());
const como = (rol: string) => ({ Authorization: `Bearer ${tokens[rol]}` });

async function producto(nombre: string) {
  const { body } = await api().get('/api/catalogo/productos').set(como('admin'));
  return body.find((p: { nombre: string }) => p.nombre === nombre);
}

beforeAll(async () => {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = modulo.createNestApplication({ rawBody: true });
  configurarApp(app, leerConfig());
  await app.init();

  for (const [rol, password] of [['admin', 'Admin-pruebas-1'], ['mesero', 'Staff-pruebas-1'], ['repartidor', 'Staff-pruebas-1']]) {
    const res = await api().post('/api/auth/login').send({ email: `${rol}@restaurante.test`, password });
    expect(res.status).toBe(200);
    tokens[rol] = res.body.token;
  }
});

afterAll(() => app.close());

describe('identidad', () => {
  it('rechaza una contraseña incorrecta sin revelar si el correo existe', async () => {
    const malaClave = await api().post('/api/auth/login').send({ email: 'admin@restaurante.test', password: 'no-es' });
    const sinCuenta = await api().post('/api/auth/login').send({ email: 'nadie@restaurante.test', password: 'no-es' });
    expect(malaClave.status).toBe(401);
    expect(sinCuenta.body).toEqual(malaClave.body);
  });

  it('exige sesión', async () => {
    const res = await api().get('/api/pedidos');
    expect(res.status).toBe(401);
    expect(res.body.mensaje).toMatch(/Inicia sesión/);
  });

  it('ya no existe el usuario de cocina', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'cocina@restaurante.test', password: 'Staff-pruebas-1' });
    expect(res.status).toBe(401);
  });

  it('devuelve el usuario de la sesión', async () => {
    const res = await api().get('/api/auth/yo').set(como('repartidor'));
    expect(res.body).toMatchObject({ email: 'repartidor@restaurante.test', rol: 'REPARTIDOR' });
    expect(res.body.passwordHash).toBeUndefined();
  });
});

describe('catálogo', () => {
  it('solo el administrador crea productos', async () => {
    const { body: categorias } = await api().get('/api/catalogo/categorias').set(como('mesero'));
    const nuevo = { categoriaId: categorias[0].id, nombre: 'Hamburguesa doble', precio: 26000 };

    expect((await api().post('/api/catalogo/productos').set(como('mesero')).send(nuevo)).status).toBe(403);
    const res = await api().post('/api/catalogo/productos').set(como('admin')).send(nuevo);
    expect(res.status).toBe(201);
    expect((await api().post('/api/catalogo/productos').set(como('admin')).send(nuevo)).status).toBe(409);
  });

  it('valida los datos del producto', async () => {
    const res = await api().post('/api/catalogo/productos').set(como('admin')).send({ nombre: 'X', precio: 10.5, extra: 1 });
    expect(res.status).toBe(400);
    expect(res.body.mensaje).toMatch(/precio/);
  });
});

describe('pedidos', () => {
  let mesaId: string;

  beforeAll(async () => {
    const { body: mesas } = await api().get('/api/mesas').set(como('mesero'));
    mesaId = mesas[0].id;
  });

  it('el mesero crea un pedido de mesa con los precios del menú', async () => {
    const hamburguesa = await producto('Hamburguesa clásica');
    const limonada = await producto('Limonada natural');
    const res = await api()
      .post('/api/pedidos')
      .set(como('mesero'))
      .send({ tipo: 'MESA', mesaId, items: [{ productoId: hamburguesa.id, cantidad: 2, notas: 'sin cebolla' }, { productoId: limonada.id, cantidad: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tipo: 'MESA', canal: 'WEB', estado: 'ACTIVO', subtotal: 42000, total: 42000, mesa: { numero: 1 } });
    expect(res.body.detalles).toHaveLength(2);
    expect(res.body.creadoPor).toEqual({ id: expect.any(String), nombre: 'Mesero' });

    const { body: mesas } = await api().get('/api/mesas').set(como('mesero'));
    expect(mesas[0].pedidosActivos).toBe(1);
  });

  it('marca con el canal MOVIL los pedidos de la app y rechaza otros canales', async () => {
    const gaseosa = await producto('Gaseosa');
    const enviar = (canal: string) => api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId, canal, items: [{ productoId: gaseosa.id, cantidad: 1 }] });

    const movil = await enviar('MOVIL');
    expect(movil.status).toBe(201);
    expect(movil.body.canal).toBe('MOVIL');
    expect((await enviar('WHATSAPP')).status).toBe(400);
  });

  it('un reintento con la misma clave no duplica el pedido', async () => {
    const gaseosa = await producto('Gaseosa');
    const enviar = () => api().post('/api/pedidos').set(como('mesero')).set('Idempotency-Key', 'clave-de-prueba-1').send({ tipo: 'MESA', mesaId, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
    const [a, b] = await Promise.all([enviar(), enviar()]);
    expect(a.body.id).toBe(b.body.id);
  });

  it('un pedido para recoger registra al cliente con su teléfono normalizado', async () => {
    const papas = await producto('Papas a la francesa');
    const res = await api()
      .post('/api/pedidos')
      .set(como('mesero'))
      .send({ tipo: 'RECOGER', cliente: { telefono: '300 123 4567', nombre: 'Ana' }, items: [{ productoId: papas.id, cantidad: 3 }] });
    expect(res.status).toBe(201);
    expect(res.body.cliente).toEqual({ nombre: 'Ana', telefono: '+573001234567' });
    expect(res.body.total).toBe(21000);
  });

  it('rechaza pedidos incompletos o con productos agotados', async () => {
    const carne = await producto('Carne asada');
    const sinMesa = await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', items: [{ productoId: carne.id, cantidad: 1 }] });
    expect(sinMesa.status).toBe(400);

    expect((await api().patch(`/api/catalogo/productos/${carne.id}/disponibilidad`).set(como('mesero')).send({ disponible: false })).status).toBe(200);
    const agotado = await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId, items: [{ productoId: carne.id, cantidad: 1 }] });
    expect(agotado.status).toBe(409);
    expect(agotado.body.mensaje).toMatch(/Carne asada no está disponible/);
  });

  it('el repartidor no puede crear pedidos', async () => {
    const gaseosa = await producto('Gaseosa');
    const res = await api().post('/api/pedidos').set(como('repartidor')).send({ tipo: 'MESA', mesaId, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
    expect(res.status).toBe(403);
  });

  it('el mesero cobra su pedido, que pasa a la lista de cerrados de hoy', async () => {
    const gaseosa = await producto('Gaseosa');
    const { body: pedido } = await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
    const cambiar = (rol: string, estado: string) => api().patch(`/api/pedidos/${pedido.id}/estado`).set(como(rol)).send({ estado });

    expect((await cambiar('mesero', 'LISTO')).status).toBe(400);
    expect((await cambiar('repartidor', 'PAGADO')).status).toBe(403);
    expect((await cambiar('mesero', 'PAGADO')).body.estado).toBe('PAGADO');
    expect((await cambiar('admin', 'CANCELADO')).status).toBe(409);

    const { body: activos } = await api().get('/api/pedidos').set(como('mesero'));
    expect(activos.some((p: { id: string }) => p.id === pedido.id)).toBe(false);
    const { body: cerrados } = await api().get('/api/pedidos?estados=PAGADO,CANCELADO').set(como('mesero'));
    expect(cerrados.some((p: { id: string }) => p.id === pedido.id)).toBe(true);
    expect((await api().get('/api/pedidos?estados=LISTO').set(como('mesero'))).status).toBe(400);
  });

  it('el administrador puede cancelar el pedido de un mesero', async () => {
    const gaseosa = await producto('Gaseosa');
    const { body: pedido } = await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
    const res = await api().patch(`/api/pedidos/${pedido.id}/estado`).set(como('admin')).send({ estado: 'CANCELADO' });
    expect(res.body.estado).toBe('CANCELADO');
  });

  it('si dos personas cambian el mismo pedido a la vez, solo una lo logra', async () => {
    const gaseosa = await producto('Gaseosa');
    const { body: pedido } = await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
    const respuestas = await Promise.all(
      [1, 2, 3].map(() => api().patch(`/api/pedidos/${pedido.id}/estado`).set(como('mesero')).send({ estado: 'PAGADO' })),
    );
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409, 409]);
  });
});
