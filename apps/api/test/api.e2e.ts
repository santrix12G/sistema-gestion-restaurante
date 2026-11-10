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

  for (const [rol, password] of [['admin', 'Admin-pruebas-1'], ['mesero', 'Staff-pruebas-1'], ['cocina', 'Staff-pruebas-1'], ['repartidor', 'Staff-pruebas-1']]) {
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

  it('devuelve el usuario de la sesión', async () => {
    const res = await api().get('/api/auth/yo').set(como('cocina'));
    expect(res.body).toMatchObject({ email: 'cocina@restaurante.test', rol: 'COCINA' });
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
    expect(res.body).toMatchObject({ tipo: 'MESA', canal: 'WEB', estado: 'CONFIRMADO', subtotal: 42000, total: 42000, mesa: { numero: 1 } });
    expect(res.body.detalles).toHaveLength(2);

    const { body: mesas } = await api().get('/api/mesas').set(como('mesero'));
    expect(mesas[0].pedidosActivos).toBe(1);
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

    expect((await api().patch(`/api/catalogo/productos/${carne.id}/disponibilidad`).set(como('cocina')).send({ disponible: false })).status).toBe(200);
    const agotado = await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId, items: [{ productoId: carne.id, cantidad: 1 }] });
    expect(agotado.status).toBe(409);
    expect(agotado.body.mensaje).toMatch(/Carne asada no está disponible/);
  });

  it('cocina no puede crear pedidos', async () => {
    const gaseosa = await producto('Gaseosa');
    const res = await api().post('/api/pedidos').set(como('cocina')).send({ tipo: 'MESA', mesaId, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
    expect(res.status).toBe(403);
  });

  it('recorre los estados con el rol que corresponde', async () => {
    const gaseosa = await producto('Gaseosa');
    const { body: pedido } = await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
    const cambiar = (rol: string, estado: string) => api().patch(`/api/pedidos/${pedido.id}/estado`).set(como(rol)).send({ estado });

    expect((await cambiar('mesero', 'EN_PREPARACION')).status).toBe(403);
    expect((await cambiar('cocina', 'EN_PREPARACION')).body.estado).toBe('EN_PREPARACION');
    expect((await cambiar('mesero', 'CANCELADO')).status).toBe(409);
    expect((await cambiar('cocina', 'LISTO')).body.estado).toBe('LISTO');
    expect((await cambiar('repartidor', 'ENTREGADO')).status).toBe(403);
    expect((await cambiar('mesero', 'ENTREGADO')).body.estado).toBe('ENTREGADO');

    const { body: activos } = await api().get('/api/pedidos').set(como('cocina'));
    expect(activos.some((p: { id: string }) => p.id === pedido.id)).toBe(false);
    const { body: entregados } = await api().get('/api/pedidos?estados=ENTREGADO').set(como('cocina'));
    expect(entregados.some((p: { id: string }) => p.id === pedido.id)).toBe(true);
  });

  it('si dos personas cambian el mismo pedido a la vez, solo una lo logra', async () => {
    const gaseosa = await producto('Gaseosa');
    const { body: pedido } = await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
    const respuestas = await Promise.all(
      [1, 2, 3].map(() => api().patch(`/api/pedidos/${pedido.id}/estado`).set(como('cocina')).send({ estado: 'EN_PREPARACION' })),
    );
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409, 409]);
  });
});
