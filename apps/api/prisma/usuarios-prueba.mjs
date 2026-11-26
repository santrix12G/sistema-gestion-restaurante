// Cuentas para pruebas de usabilidad: 2 meseros, 2 repartidores y 1 administrador.
// Usan la base de DATABASE_URL (apps/api/.env). Cada contraseña es aleatoria y se muestra una sola vez.
//
//   npm run db:usuarios-prueba                          crea las que falten
//   npm run db:usuarios-prueba -- --nuevas-contrasenas  además pone contraseñas nuevas a las que ya existen
//   npm run db:usuarios-prueba -- --quitar              al terminar las pruebas: borra las que no registraron
//                                                       nada y suspende las demás (sus pedidos se conservan)
import 'dotenv/config';
import { randomInt } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Un dominio que no existe: estas cuentas se reconocen por él y no reciben correos
const DOMINIO = 'pruebas.restaurante.test';

const CUENTAS = [
  { nombre: 'Mesero de prueba 1', email: `mesero1@${DOMINIO}`, rol: 'MESERO' },
  { nombre: 'Mesero de prueba 2', email: `mesero2@${DOMINIO}`, rol: 'MESERO' },
  { nombre: 'Repartidor de prueba 1', email: `repartidor1@${DOMINIO}`, rol: 'REPARTIDOR' },
  { nombre: 'Repartidor de prueba 2', email: `repartidor2@${DOMINIO}`, rol: 'REPARTIDOR' },
  { nombre: 'Administrador de prueba', email: `admin@${DOMINIO}`, rol: 'ADMIN' },
];

/** Fácil de dictar a quien hace la prueba: 6 letras, guion y 4 números (cumple las reglas de la app) */
function contrasenaAleatoria() {
  const letras = 'abcdefghjkmnpqrstuvwxyz'; // sin i, l ni o, que se confunden con 1 y 0
  let texto = '';
  for (let i = 0; i < 6; i++) texto += letras[randomInt(letras.length)];
  return `${texto[0].toUpperCase()}${texto.slice(1)}-${String(randomInt(10_000)).padStart(4, '0')}`;
}

/** Solo el servidor y la base, nunca el usuario ni la contraseña de la conexión */
function destino() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return `${url.hostname}${url.pathname}`;
  } catch {
    throw new Error('Define DATABASE_URL en apps/api/.env');
  }
}

const prisma = new PrismaClient();
const opciones = new Set(process.argv.slice(2));

async function crear() {
  const nuevasContrasenas = opciones.has('--nuevas-contrasenas');
  const filas = [];
  for (const cuenta of CUENTAS) {
    const existente = await prisma.usuario.findUnique({ where: { email: cuenta.email } });
    if (existente && !nuevasContrasenas) {
      filas.push({ ...cuenta, contrasena: existente.activo ? '(ya existía, sin cambios)' : '(suspendida: usa --nuevas-contrasenas)' });
      continue;
    }
    const contrasena = contrasenaAleatoria();
    const passwordHash = await bcrypt.hash(contrasena, 10);
    await prisma.usuario.upsert({
      where: { email: cuenta.email },
      create: { ...cuenta, passwordHash },
      // Reactiva la cuenta y cierra las sesiones que tuviera con la contraseña anterior
      update: { passwordHash, activo: true, sesionesDesde: new Date() },
    });
    filas.push({ ...cuenta, contrasena });
  }

  console.table(filas.map((f) => ({ Rol: f.rol, Nombre: f.nombre, Correo: f.email, Contraseña: f.contrasena })));
  if (filas.some((f) => !f.contrasena.startsWith('('))) {
    console.log('Guarda estas contraseñas: no se vuelven a mostrar. Con --nuevas-contrasenas se generan otras.');
  }
  console.log('Estas cuentas no reciben correos: si alguien olvida la suya, vuelve a correr el comando con --nuevas-contrasenas.');
}

async function quitar() {
  for (const { email } of CUENTAS) {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: {
        _count: {
          select: {
            pedidosCreados: true,
            entregas: true,
            historial: true,
            movimientos: true,
            cobros: true,
            cajasAbiertas: true,
            cajasCerradas: true,
            movimientosCaja: true,
          },
        },
      },
    });
    if (!usuario) continue;
    const registros = Object.values(usuario._count).reduce((a, b) => a + b, 0);
    if (registros === 0) {
      await prisma.usuario.delete({ where: { id: usuario.id } });
      console.log(`Borrada: ${email}`);
    } else {
      // Borrarla dejaría pedidos y cobros sin autor: se suspende y no puede volver a entrar
      await prisma.usuario.update({ where: { id: usuario.id }, data: { activo: false, sesionesDesde: new Date() } });
      console.log(`Suspendida (tiene ${registros} registros): ${email}`);
    }
  }
}

async function main() {
  console.log(`Base de datos: ${destino()}`);
  if (opciones.has('--quitar')) await quitar();
  else await crear();
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
