import 'reflect-metadata';
import { BadRequestException, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { VerificadorCaptcha } from '../src/modules/identidad/infrastructure/captcha';
import { EnviadorCorreo, MensajeCorreo } from '../src/modules/identidad/infrastructure/correo';
import { leerConfig } from '../src/shared/config';
import { PrismaService } from '../src/shared/prisma.service';

let app: INestApplication;
const enviados: MensajeCorreo[] = [];
// Captcha falso: cuando está activo, solo acepta 'captcha-valido'
const captcha = { activo: false, respuestas: [] as (string | undefined)[] };

const api = () => request(app.getHttpServer());
const EMAIL = 'olvido@restaurante.test';
let admin: string;

/** El token del enlace del último correo enviado */
const tokenDelCorreo = () => /token=([\w-]+)/.exec(enviados.at(-1)!.texto)![1];
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EnviadorCorreo)
    .useValue({ enviar: async (m: MensajeCorreo) => void enviados.push(m) })
    .overrideProvider(VerificadorCaptcha)
    .useValue({
      exigir: async (respuesta?: string) => {
        captcha.respuestas.push(respuesta);
        if (captcha.activo && respuesta !== 'captcha-valido') throw new BadRequestException('Completa la verificación de seguridad');
      },
    })
    // Estas pruebas hacen más intentos por minuto de los que la API permite
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();
  app = modulo.createNestApplication();
  configurarApp(app, leerConfig());
  await app.init();

  admin = (await api().post('/api/auth/login').send({ email: 'admin@restaurante.test', password: 'Admin-pruebas-1' })).body.token;
  await app.get(PrismaService).usuario.deleteMany({ where: { email: EMAIL } });
  const cuenta = await api()
    .post('/api/personal')
    .set({ Authorization: `Bearer ${admin}` })
    .send({ nombre: 'Olvido', email: EMAIL, rol: 'MESERO', password: 'Clave-vieja-1' });
  expect(cuenta.status).toBe(201);
});

// La cuenta de prueba no se queda: otras pruebas cuentan el personal
afterAll(async () => {
  await app.get(PrismaService).usuario.deleteMany({ where: { email: EMAIL } });
  await app.close();
});

describe('mantener la sesión iniciada', () => {
  const horas = (token: string) => {
    const { iat, exp } = app.get(JwtService).decode<{ iat: number; exp: number }>(token);
    return (exp - iat) / 3600;
  };

  it('sin recordar, la sesión dura 12 horas', async () => {
    const res = await api().post('/api/auth/login').send({ email: EMAIL, password: 'Clave-vieja-1' });
    expect(res.status).toBe(200);
    expect(horas(res.body.token)).toBe(12);
  });

  it('recordándola, dura 30 días', async () => {
    const res = await api().post('/api/auth/login').send({ email: EMAIL, password: 'Clave-vieja-1', recordar: true });
    expect(horas(res.body.token)).toBe(30 * 24);
    expect(res.body.expiraEn).toBe('30d');
  });
});

describe('captcha', () => {
  it('el inicio de sesión de la web lo exige', async () => {
    captcha.activo = true;
    try {
      const sin = await api().post('/api/auth/login').send({ email: EMAIL, password: 'Clave-vieja-1' });
      expect(sin.status).toBe(400);
      expect(sin.body.mensaje).toMatch(/verificación de seguridad/);
      const con = await api().post('/api/auth/login').send({ email: EMAIL, password: 'Clave-vieja-1', captcha: 'captcha-valido' });
      expect(con.status).toBe(200);
    } finally {
      captcha.activo = false;
    }
  });

  it('la app móvil entra por su propia ruta, sin captcha', async () => {
    captcha.activo = true;
    try {
      const antes = captcha.respuestas.length;
      const res = await api().post('/api/auth/login/movil').send({ email: EMAIL, password: 'Clave-vieja-1' });
      expect(res.status).toBe(200);
      expect(captcha.respuestas.length).toBe(antes);
    } finally {
      captcha.activo = false;
    }
  });
});

describe('recuperar la contraseña', () => {
  it('responde lo mismo exista o no la cuenta, y solo envía correo si existe', async () => {
    const antes = enviados.length;
    const noExiste = await api().post('/api/auth/recuperar').send({ email: 'nadie@restaurante.test' });
    expect(enviados.length).toBe(antes);
    const existe = await api().post('/api/auth/recuperar').send({ email: EMAIL.toUpperCase() });
    expect(existe.status).toBe(200);
    expect(existe.body).toEqual(noExiste.body);
    expect(enviados.length).toBe(antes + 1);
    expect(enviados.at(-1)).toMatchObject({ para: EMAIL, asunto: 'Restablece tu contraseña' });
    expect(enviados.at(-1)!.html).toContain('/restablecer?token=');
  });

  it('envía el correo en inglés si la web está en inglés', async () => {
    await api().post('/api/auth/recuperar').send({ email: EMAIL, idioma: 'en' });
    expect(enviados.at(-1)!.asunto).toBe('Reset your password');
  });

  it('el enlace cambia la contraseña una sola vez y cierra las sesiones abiertas', async () => {
    const sesionVieja = (await api().post('/api/auth/login').send({ email: EMAIL, password: 'Clave-vieja-1', recordar: true })).body.token;
    expect((await api().get('/api/auth/yo').set({ Authorization: `Bearer ${sesionVieja}` })).status).toBe(200);

    await api().post('/api/auth/recuperar').send({ email: EMAIL });
    const token = tokenDelCorreo();
    await esperar(1100); // la sesión vieja queda claramente antes del cambio

    const debil = await api().post('/api/auth/restablecer').send({ token, password: 'corta' });
    expect(debil.status).toBe(400);

    const ok = await api().post('/api/auth/restablecer').send({ token, password: 'Clave-nueva-2' });
    expect(ok.status).toBe(200);

    const otraVez = await api().post('/api/auth/restablecer').send({ token, password: 'Clave-otra-3' });
    expect(otraVez.status).toBe(400);
    expect(otraVez.body.mensaje).toMatch(/no es válido o ya venció/);

    expect((await api().get('/api/auth/yo').set({ Authorization: `Bearer ${sesionVieja}` })).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: EMAIL, password: 'Clave-vieja-1' })).status).toBe(401);
    const nueva = await api().post('/api/auth/login').send({ email: EMAIL, password: 'Clave-nueva-2' });
    expect(nueva.status).toBe(200);
    expect((await api().get('/api/auth/yo').set({ Authorization: `Bearer ${nueva.body.token}` })).status).toBe(200);
  });

  it('un enlace nuevo anula el anterior, y uno vencido no sirve', async () => {
    await api().post('/api/auth/recuperar').send({ email: EMAIL });
    const primero = tokenDelCorreo();
    await api().post('/api/auth/recuperar').send({ email: EMAIL });
    const segundo = tokenDelCorreo();
    expect(segundo).not.toBe(primero);
    expect((await api().post('/api/auth/restablecer').send({ token: primero, password: 'Clave-nueva-3' })).status).toBe(400);

    await app.get(PrismaService).tokenRecuperacion.updateMany({ where: { usadoEn: null }, data: { expiraEn: new Date(Date.now() - 1000) } });
    expect((await api().post('/api/auth/restablecer').send({ token: segundo, password: 'Clave-nueva-3' })).status).toBe(400);
  });

  it('cuando el administrador cambia la contraseña, también se cierran las sesiones', async () => {
    const sesion = (await api().post('/api/auth/login').send({ email: EMAIL, password: 'Clave-nueva-2' })).body.token;
    const { body } = await api().get('/api/personal').set({ Authorization: `Bearer ${admin}` });
    const id = body.find((u: { email: string }) => u.email === EMAIL).id;
    await esperar(1100);
    const cambio = await api().patch(`/api/personal/${id}`).set({ Authorization: `Bearer ${admin}` }).send({ password: 'Clave-admin-4' });
    expect(cambio.status).toBe(200);
    expect((await api().get('/api/auth/yo').set({ Authorization: `Bearer ${sesion}` })).status).toBe(401);
  });
});
