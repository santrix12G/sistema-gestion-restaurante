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
  // Para cobrar hace falta una caja abierta. Si ya hay una, la API responde 409 y se usa esa
  await api().post('/api/caja/abrir').set(como('admin')).send({ base: 0 });
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

describe('personal', () => {
  const crear = (datos: object, rol = 'admin') => api().post('/api/personal').set(como(rol)).send(datos);
  const cambiar = (id: string, datos: object) => api().patch(`/api/personal/${id}`).set(como('admin')).send(datos);
  const entrar = (email: string, password: string) => api().post('/api/auth/login').send({ email, password });

  it('solo el administrador gestiona al personal, y no puede tocar cuentas de administrador', async () => {
    expect((await api().get('/api/personal').set(como('mesero'))).status).toBe(403);
    const { body: lista } = await api().get('/api/personal').set(como('admin'));
    expect(lista.map((c: { rol: string }) => c.rol).sort()).toEqual(['MESERO', 'REPARTIDOR']);
    expect(lista[0]).not.toHaveProperty('passwordHash');

    const { body: admin } = await api().get('/api/auth/yo').set(como('admin'));
    expect((await cambiar(admin.id, { activo: false })).status).toBe(404);
    expect((await crear({ nombre: 'Otro admin', email: 'jefe@restaurante.test', rol: 'ADMIN', password: 'Clave-1234' })).status).toBe(400);
  });

  it('crea un mesero que puede entrar; valida correo repetido y contraseña débil', async () => {
    const nuevo = await crear({ nombre: 'Ana Mesera', email: ' Ana@Restaurante.test ', rol: 'MESERO', password: 'Ana-clave-1' });
    expect(nuevo.status).toBe(201);
    expect(nuevo.body).toMatchObject({ nombre: 'Ana Mesera', email: 'ana@restaurante.test', rol: 'MESERO', activo: true });
    expect(nuevo.body).not.toHaveProperty('passwordHash');
    expect((await entrar('ana@restaurante.test', 'Ana-clave-1')).status).toBe(200);

    const repetido = await crear({ nombre: 'Ana 2', email: 'ana@restaurante.test', rol: 'MESERO', password: 'Ana-clave-1' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.mensaje).toMatch(/Ya existe una cuenta con ese correo/);
    const debil = await crear({ nombre: 'Beto', email: 'beto@restaurante.test', rol: 'REPARTIDOR', password: 'corta' });
    expect(debil.status).toBe(400);
    expect(debil.body.mensaje).toMatch(/al menos 8/);
  });

  it('suspender corta la sesión al instante; no se suspende a quien tiene pedidos activos', async () => {
    const { body: cuenta } = await crear({ nombre: 'Carlos', email: 'carlos@restaurante.test', rol: 'MESERO', password: 'Carlos-123' });
    const { body: sesion } = await entrar('carlos@restaurante.test', 'Carlos-123');
    const comoCarlos = { Authorization: `Bearer ${sesion.token}` };
    const { body: mesas } = await api().get('/api/mesas').set(comoCarlos);
    const gaseosa = await producto('Gaseosa');
    const { body: pedido } = await api().post('/api/pedidos').set(comoCarlos).send({ tipo: 'MESA', mesaId: mesas[0].id, items: [{ productoId: gaseosa.id, cantidad: 1 }] });

    const bloqueado = await cambiar(cuenta.id, { activo: false });
    expect(bloqueado.status).toBe(409);
    expect(bloqueado.body.mensaje).toMatch(/Carlos tiene un pedido activo/);
    expect((await cambiar(cuenta.id, { rol: 'REPARTIDOR' })).status).toBe(409);

    await api().patch(`/api/pedidos/${pedido.id}/estado`).set(comoCarlos).send({ estado: 'PAGADO' });
    expect((await cambiar(cuenta.id, { activo: false })).body.activo).toBe(false);
    // La sesión que tenía abierta deja de funcionar (el login usa la misma regla). El login tiene un límite de 10 intentos por minuto
    expect((await api().get('/api/pedidos').set(comoCarlos)).status).toBe(401);

    // Ya tiene pedidos: no se borra, se queda suspendido
    const borrar = await api().delete(`/api/personal/${cuenta.id}`).set(como('admin'));
    expect(borrar.status).toBe(409);
    expect(borrar.body.mensaje).toMatch(/Suspende su cuenta/);

    // Reactivado y con contraseña nueva vuelve a entrar
    expect((await cambiar(cuenta.id, { activo: true, password: 'Nueva-clave-9' })).status).toBe(200);
    expect((await entrar('carlos@restaurante.test', 'Nueva-clave-9')).status).toBe(200);
  });

  it('borra una cuenta sin historial y cambia datos y rol', async () => {
    const { body: cuenta } = await crear({ nombre: 'Dora', email: 'dora@restaurante.test', rol: 'REPARTIDOR', password: 'Dora-clave-1' });
    const editada = await cambiar(cuenta.id, { nombre: 'Dora Díaz', rol: 'MESERO' });
    expect(editada.body).toMatchObject({ nombre: 'Dora Díaz', rol: 'MESERO' });
    expect((await api().delete(`/api/personal/${cuenta.id}`).set(como('admin'))).status).toBe(204);
    const { body: lista } = await api().get('/api/personal').set(como('admin'));
    expect(lista.some((c: { id: string }) => c.id === cuenta.id)).toBe(false);
  });
});

describe('mesas', () => {
  const crear = (datos: object, rol = 'admin') => api().post('/api/mesas').set(como(rol)).send(datos);

  it('lista las mesas por tipo con su código', async () => {
    const { body } = await api().get('/api/mesas').set(como('mesero'));
    const codigos = body.map((m: { codigo: string }) => m.codigo);
    expect(codigos.slice(0, 3)).toEqual(['M1', 'M2', 'M3']);
    expect(codigos).toEqual(expect.arrayContaining(['L1', 'L2', 'AF1', 'AF2']));
    // Primero las normales, luego las largas y al final las de afuera
    expect(codigos.indexOf('M10')).toBeLessThan(codigos.indexOf('L1'));
    expect(codigos.indexOf('L2')).toBeLessThan(codigos.indexOf('AF1'));
  });

  it('solo el administrador registra mesas; sin número toma el siguiente del tipo', async () => {
    expect((await crear({ tipo: 'LARGA' }, 'mesero')).status).toBe(403);
    const nueva = await crear({ tipo: 'LARGA', capacidad: 10 });
    expect(nueva.status).toBe(201);
    expect(nueva.body).toMatchObject({ tipo: 'LARGA', numero: 3, codigo: 'L3', capacidad: 10, activa: true });

    const repetida = await crear({ tipo: 'LARGA', numero: 3 });
    expect(repetida.status).toBe(409);
    expect(repetida.body.mensaje).toMatch(/Ya existe la mesa L3/);
    expect((await crear({ tipo: 'TERRAZA' })).status).toBe(400);
    // El número se repite entre tipos: puede haber M3 y AF3
    expect((await crear({ tipo: 'AFUERA', numero: 3 })).body.codigo).toBe('AF3');
  });

  it('suspende, reactiva y borra mesas; la suspendida no aparece al tomar pedidos', async () => {
    const { body: mesa } = await crear({ tipo: 'AFUERA' });
    const cambiar = (datos: object, rol = 'admin') => api().patch(`/api/mesas/${mesa.id}`).set(como(rol)).send(datos);

    expect((await cambiar({ activa: false }, 'mesero')).status).toBe(403);
    expect((await cambiar({ activa: false })).body.activa).toBe(false);
    const visibles = async (rol: string, ruta = '/api/mesas') => (await api().get(ruta).set(como(rol))).body.map((m: { id: string }) => m.id);
    expect(await visibles('mesero')).not.toContain(mesa.id);
    expect(await visibles('admin', '/api/mesas?todas=true')).toContain(mesa.id);
    expect((await api().get('/api/mesas?todas=true').set(como('mesero'))).status).toBe(403);

    expect((await cambiar({ activa: true, capacidad: 6 })).body).toMatchObject({ activa: true, capacidad: 6 });
    expect((await api().delete(`/api/mesas/${mesa.id}`).set(como('admin'))).status).toBe(204);
  });

  it('no deja suspender ni borrar una mesa con pedidos', async () => {
    const { body: mesa } = await crear({ tipo: 'NORMAL' });
    const gaseosa = await producto('Gaseosa');
    const { body: pedido } = await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId: mesa.id, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
    expect(pedido.mesa).toEqual({ tipo: 'NORMAL', numero: mesa.numero });

    const suspender = await api().patch(`/api/mesas/${mesa.id}`).set(como('admin')).send({ activa: false });
    expect(suspender.status).toBe(409);
    expect(suspender.body.mensaje).toMatch(/tiene un pedido activo/);

    await api().patch(`/api/pedidos/${pedido.id}/estado`).set(como('mesero')).send({ estado: 'PAGADO' });
    const borrar = await api().delete(`/api/mesas/${mesa.id}`).set(como('admin'));
    expect(borrar.status).toBe(409);
    expect(borrar.body.mensaje).toMatch(/Suspéndela/);
    expect((await api().patch(`/api/mesas/${mesa.id}`).set(como('admin')).send({ activa: false })).status).toBe(200);
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
    expect(res.body).toMatchObject({ tipo: 'MESA', canal: 'WEB', estado: 'ACTIVO', subtotal: 42000, total: 42000, mesa: { tipo: 'NORMAL', numero: 1 } });
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

  it('cada rol solo ve sus pedidos: el mesero los que registró y el repartidor solo domicilios', async () => {
    const gaseosa = await producto('Gaseosa');
    const crear = async (rol: string) => (await api().post('/api/pedidos').set(como(rol)).send({ tipo: 'MESA', mesaId, items: [{ productoId: gaseosa.id, cantidad: 1 }] })).body;
    const delMesero = await crear('mesero');
    const delAdmin = await crear('admin');
    const ids = async (rol: string) => (await api().get('/api/pedidos').set(como(rol))).body.map((p: { id: string }) => p.id);

    expect(await ids('mesero')).toContain(delMesero.id);
    expect(await ids('mesero')).not.toContain(delAdmin.id);
    expect(await ids('admin')).toEqual(expect.arrayContaining([delMesero.id, delAdmin.id]));
    const delRepartidor = await api().get('/api/pedidos').set(como('repartidor'));
    expect(delRepartidor.body.every((p: { tipo: string }) => p.tipo === 'DOMICILIO')).toBe(true);
    // Un pedido ajeno no se puede abrir por su id
    expect((await api().get(`/api/pedidos/${delAdmin.id}`).set(como('mesero'))).status).toBe(404);
    expect((await api().get(`/api/pedidos/${delMesero.id}`).set(como('mesero'))).status).toBe(200);
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

describe('estadísticas', () => {
  const delDia = (consulta = '') => api().get(`/api/estadisticas/dia${consulta}`).set(como('admin'));

  it('solo el administrador ve las estadísticas', async () => {
    expect((await api().get('/api/estadisticas/dia').set(como('mesero'))).status).toBe(403);
    expect((await api().get('/api/estadisticas/dia').set(como('repartidor'))).status).toBe(403);
  });

  it('suma lo pagado hoy, cuenta lo cancelado aparte y lleva los más vendidos', async () => {
    const { body: mesas } = await api().get('/api/mesas').set(como('mesero'));
    const gaseosa = await producto('Gaseosa');
    const antes = (await delDia()).body;
    const crear = async (cantidad: number) =>
      (await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId: mesas[0].id, items: [{ productoId: gaseosa.id, cantidad }] })).body;
    const cerrar = (id: string, estado: string) => api().patch(`/api/pedidos/${id}/estado`).set(como('mesero')).send({ estado });

    const pagado = await crear(3);
    await cerrar(pagado.id, 'PAGADO');
    const cancelado = await crear(10);
    await cerrar(cancelado.id, 'CANCELADO');
    const abierto = await crear(1);

    const res = await delDia();
    expect(res.status).toBe(200);
    const despues = res.body;
    expect(despues.ventas.total - antes.ventas.total).toBe(pagado.total);
    expect(despues.ventas.pedidos - antes.ventas.pedidos).toBe(1);
    expect(despues.cancelados.pedidos - antes.cancelados.pedidos).toBe(1);
    expect(despues.cancelados.total - antes.cancelados.total).toBe(cancelado.total);
    expect(despues.activos.pedidos - antes.activos.pedidos).toBe(1);
    expect(despues.activos.total - antes.activos.total).toBe(abierto.total);
    // Lo cancelado no suma a lo más vendido
    const unidades = (r: { masVendidos: { productoId: string; cantidad: number }[] }) => r.masVendidos.find((p) => p.productoId === gaseosa.id)?.cantidad ?? 0;
    expect(unidades(despues) - unidades(antes)).toBe(3);
    expect(despues.porTipo.find((t: { tipo: string }) => t.tipo === 'MESA').total - antes.porTipo.find((t: { tipo: string }) => t.tipo === 'MESA').total).toBe(pagado.total);
    // El pedido del mesero entró por la web; las horas suman lo mismo que lo vendido
    const delCanal = (r: { porCanal: { canal: string; total: number }[] }, canal: string) => r.porCanal.find((c) => c.canal === canal)!.total;
    expect(delCanal(despues, 'WEB') - delCanal(antes, 'WEB')).toBe(pagado.total);
    expect(despues.porCanal.map((c: { canal: string }) => c.canal)).toEqual(['WHATSAPP', 'TELEGRAM', 'WEB', 'MOVIL']);
    expect(despues.porHora).toHaveLength(24);
    expect(despues.porHora.reduce((s: number, h: { total: number }) => s + h.total, 0)).toBe(despues.ventas.total);
    expect(despues.porHora[despues.horaPico].pedidos).toBeGreaterThan(0);
  });

  it('consulta días pasados y valida la fecha', async () => {
    const pasado = await delDia('?fecha=2020-01-15');
    expect(pasado.status).toBe(200);
    expect(pasado.body).toMatchObject({ fecha: '2020-01-15', ventas: { total: 0, pedidos: 0 }, masVendidos: [], activos: null, horaPico: null });
    expect((await delDia('?fecha=2999-01-01')).status).toBe(400);
    expect((await delDia('?fecha=15-01-2020')).status).toBe(400);
  });

  it('el reporte por período cuadra con el del día y valida las fechas', async () => {
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    const periodo = (consulta: string, rol: 'admin' | 'mesero' = 'admin') => api().get(`/api/estadisticas/periodo${consulta}`).set(como(rol));
    expect((await periodo(`?desde=${hoy}&hasta=${hoy}`, 'mesero')).status).toBe(403);

    const [res, dia] = await Promise.all([periodo(`?desde=${hoy}&hasta=${hoy}`), delDia()]);
    expect(res.status).toBe(200);
    const r = res.body;
    expect(r).toMatchObject({ desde: hoy, hasta: hoy, ventas: dia.body.ventas, cancelados: dia.body.cancelados });
    expect(r.porDia).toEqual([{ fecha: hoy, pedidos: dia.body.ventas.pedidos, total: dia.body.ventas.total }]);
    expect(r.porDiaSemana).toHaveLength(7);
    // Están todos los productos del menú, y sus ventas suman lo vendido sin domicilios
    const { body: menu } = await api().get('/api/catalogo/productos').set(como('admin'));
    expect(r.productos.length).toBeGreaterThanOrEqual(menu.length);
    // Lo del mesero y lo del chatbot suman lo vendido; los tiempos cuentan todos los pagados
    const deMeseros = r.personal.meseros.reduce((s: number, m: { total: number }) => s + m.total, 0);
    expect(deMeseros + r.personal.chatbot.total).toBe(r.ventas.total);
    expect(r.tiempos.general.pedidos).toBe(r.ventas.pedidos);
    expect(r.tiempos.general.minutosPromedio).toBeGreaterThanOrEqual(0);

    expect((await periodo('?desde=2020-01-01&hasta=2020-01-31')).body).toMatchObject({ ventas: { total: 0 }, mejorDia: null, comparacion: { variacionVentas: null } });
    expect((await periodo(`?desde=${hoy}&hasta=2020-01-01`)).status).toBe(400);
    expect((await periodo('?desde=2020-01-01&hasta=2999-01-01')).status).toBe(400);
    expect((await periodo('?desde=2020-01-01&hasta=2021-12-31')).status).toBe(400);
    expect((await periodo('')).status).toBe(400);
  });
});

describe('caja', () => {
  const caja = () => api().get('/api/caja/actual').set(como('admin'));
  const cerrarCaja = (efectivoContado: number, notas?: string) => api().post('/api/caja/cerrar').set(como('admin')).send({ efectivoContado, notas });
  const movimiento = (tipo: string, monto: number, motivo = 'Prueba') => api().post('/api/caja/movimientos').set(como('admin')).send({ tipo, monto, motivo });

  async function nuevoPedido(cantidad = 1) {
    const { body: mesas } = await api().get('/api/mesas').set(como('mesero'));
    const gaseosa = await producto('Gaseosa');
    return (await api().post('/api/pedidos').set(como('mesero')).send({ tipo: 'MESA', mesaId: mesas[0].id, items: [{ productoId: gaseosa.id, cantidad }] })).body;
  }
  const cobrar = (id: string, metodo?: string) => api().patch(`/api/pedidos/${id}/estado`).set(como('mesero')).send({ estado: 'PAGADO', metodo });

  it('solo el administrador maneja la caja; el personal ve si está abierta', async () => {
    expect((await api().post('/api/caja/abrir').set(como('mesero')).send({ base: 0 })).status).toBe(403);
    expect((await api().get('/api/caja/actual').set(como('repartidor'))).status).toBe(403);
    const estado = await api().get('/api/caja/estado').set(como('mesero'));
    expect(estado.status).toBe(200);
    expect(estado.body.abierta).toBe(true);
  });

  it('sin caja abierta no se puede cobrar, pero sí cancelar', async () => {
    const { body } = await caja();
    expect((await cerrarCaja(body.caja.efectivoEsperado)).body.diferencia).toBe(0);
    expect((await api().get('/api/caja/estado').set(como('mesero'))).body.abierta).toBe(false);
    expect((await caja()).body).toEqual({ caja: null });

    const pedido = await nuevoPedido();
    const res = await cobrar(pedido.id);
    expect(res.status).toBe(409);
    expect(res.body.mensaje).toMatch(/caja está cerrada/);
    const { body: activos } = await api().get('/api/pedidos').set(como('mesero'));
    expect(activos.map((p: { id: string }) => p.id)).toContain(pedido.id);
    expect((await api().patch(`/api/pedidos/${pedido.id}/estado`).set(como('mesero')).send({ estado: 'CANCELADO' })).status).toBe(200);
    expect((await movimiento('ENTRADA', 1000)).status).toBe(409);
  });

  it('lleva los cobros por método, las entradas y salidas, y cuadra el arqueo al cerrar', async () => {
    const previa = (await caja()).body.caja;
    if (previa) await cerrarCaja(previa.efectivoEsperado);
    const abierta = await api().post('/api/caja/abrir').set(como('admin')).send({ base: 100000 });
    expect(abierta.status).toBe(201);
    expect((await api().post('/api/caja/abrir').set(como('admin')).send({ base: 0 })).status).toBe(409);

    const enEfectivo = await nuevoPedido(2);
    const conTarjeta = await nuevoPedido(3);
    const sinMetodo = await nuevoPedido(1);
    expect((await cobrar(enEfectivo.id, 'EFECTIVO')).status).toBe(200);
    expect((await cobrar(conTarjeta.id, 'TARJETA')).status).toBe(200);
    // Las versiones anteriores de la app no mandan el método: se toma efectivo
    expect((await cobrar(sinMetodo.id)).status).toBe(200);
    const otro = await nuevoPedido();
    expect((await cobrar(otro.id, 'BITCOIN')).status).toBe(400);
    await api().patch(`/api/pedidos/${otro.id}/estado`).set(como('mesero')).send({ estado: 'CANCELADO' });

    expect((await movimiento('ENTRADA', 20000, 'Sencillo para vueltas')).status).toBe(201);
    expect((await movimiento('SALIDA', 5000, 'Compra de hielo')).status).toBe(201);
    expect((await movimiento('SALIDA', 0)).status).toBe(400);
    expect((await movimiento('SALIDA', 10_000_000)).status).toBe(409);
    expect((await api().post('/api/caja/movimientos').set(como('admin')).send({ tipo: 'SALIDA', monto: 1000, motivo: '  ' })).status).toBe(400);

    const { body } = await caja();
    const efectivo = enEfectivo.total + sinMetodo.total;
    expect(body.caja.base).toBe(100000);
    expect(body.caja.porMetodo.find((m: { metodo: string }) => m.metodo === 'EFECTIVO')).toEqual({ metodo: 'EFECTIVO', pagos: 2, total: efectivo });
    expect(body.caja.porMetodo.find((m: { metodo: string }) => m.metodo === 'TARJETA').total).toBe(conTarjeta.total);
    expect(body.caja.vendido).toBe(efectivo + conTarjeta.total);
    expect(body.caja.efectivoEsperado).toBe(100000 + efectivo + 20000 - 5000);
    expect(body.caja.movimientos.map((m: { motivo: string }) => m.motivo)).toEqual(['Compra de hielo', 'Sencillo para vueltas']);
    expect(body.caja.pagos[0]).toMatchObject({ numeroPedido: sinMetodo.numero, metodo: 'EFECTIVO', cobradoPor: { nombre: expect.any(String) } });

    // Faltan mil pesos al contar
    const cierre = await cerrarCaja(body.caja.efectivoEsperado - 1000, 'Faltó un billete');
    expect(cierre.status).toBe(201);
    expect(cierre.body).toMatchObject({ efectivoContado: body.caja.efectivoEsperado - 1000, diferencia: -1000, notasCierre: 'Faltó un billete' });
    expect(cierre.body.cerradaEn).not.toBeNull();
    expect((await cerrarCaja(0)).status).toBe(409);

    const { body: historial } = await api().get('/api/caja/historial').set(como('admin'));
    expect(historial[0]).toMatchObject({ id: abierta.body.id, diferencia: -1000, cobros: 3, movimientos: 2 });
    expect((await api().get(`/api/caja/${abierta.body.id}`).set(como('admin'))).body.pagos).toHaveLength(3);

    // Se deja abierta para las demás pruebas
    await api().post('/api/caja/abrir').set(como('admin')).send({ base: 0 });
  });
});
