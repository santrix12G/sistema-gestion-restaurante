// Datos iniciales del prototipo: personal, mesas, menú e inventario. Se puede repetir sin duplicar.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function contrasena(variable) {
  const valor = process.env[variable];
  if (!valor) throw new Error(`Define ${variable} en apps/api/.env antes de cargar los datos`);
  return valor;
}

const USUARIOS = [
  { nombre: 'Administrador', email: 'admin@restaurante.test', rol: 'ADMIN', variable: 'SEED_ADMIN_PASSWORD' },
  { nombre: 'Mesero', email: 'mesero@restaurante.test', rol: 'MESERO', variable: 'SEED_STAFF_PASSWORD' },
  { nombre: 'Repartidor', email: 'repartidor@restaurante.test', rol: 'REPARTIDOR', variable: 'SEED_STAFF_PASSWORD' },
];

const INGREDIENTES = [
  { nombre: 'Pan de hamburguesa', unidad: 'UNIDAD', inicial: 200, stockMinimo: 40 },
  { nombre: 'Carne de res', unidad: 'GRAMO', inicial: 30000, stockMinimo: 5000 },
  { nombre: 'Pechuga de pollo', unidad: 'GRAMO', inicial: 20000, stockMinimo: 4000 },
  { nombre: 'Queso', unidad: 'GRAMO', inicial: 10000, stockMinimo: 1500 },
  { nombre: 'Arroz', unidad: 'GRAMO', inicial: 40000, stockMinimo: 6000 },
  { nombre: 'Papa', unidad: 'GRAMO', inicial: 50000, stockMinimo: 8000 },
  { nombre: 'Limón', unidad: 'UNIDAD', inicial: 300, stockMinimo: 50 },
  { nombre: 'Gaseosa 400 ml', unidad: 'UNIDAD', inicial: 120, stockMinimo: 25 },
];

const MENU = [
  {
    categoria: 'Hamburguesas',
    productos: [
      { nombre: 'Hamburguesa clásica', precio: 18000, sinonimos: ['hamburguesa', 'burger'], receta: { 'Pan de hamburguesa': 1, 'Carne de res': 150 } },
      { nombre: 'Hamburguesa con queso', precio: 21000, sinonimos: ['cheeseburger'], receta: { 'Pan de hamburguesa': 1, 'Carne de res': 150, Queso: 40 } },
    ],
  },
  {
    categoria: 'Platos fuertes',
    productos: [
      { nombre: 'Pollo a la plancha', precio: 24000, sinonimos: ['pollo'], receta: { 'Pechuga de pollo': 220, Arroz: 150 } },
      { nombre: 'Carne asada', precio: 28000, sinonimos: ['carne'], receta: { 'Carne de res': 250, Arroz: 150 } },
    ],
  },
  {
    categoria: 'Acompañamientos',
    productos: [{ nombre: 'Papas a la francesa', precio: 7000, sinonimos: ['papas', 'francesas'], receta: { Papa: 200 } }],
  },
  {
    categoria: 'Bebidas',
    productos: [
      { nombre: 'Limonada natural', precio: 6000, sinonimos: ['limonada'], receta: { Limón: 2 } },
      { nombre: 'Gaseosa', precio: 5000, sinonimos: ['refresco', 'cola'], receta: { 'Gaseosa 400 ml': 1 } },
    ],
  },
];

async function main() {
  for (const { variable, ...usuario } of USUARIOS) {
    const passwordHash = await bcrypt.hash(contrasena(variable), 10);
    await prisma.usuario.upsert({ where: { email: usuario.email }, create: { ...usuario, passwordHash }, update: {} });
  }

  for (let numero = 1; numero <= 10; numero++) {
    await prisma.mesa.upsert({ where: { tipo_numero: { tipo: 'NORMAL', numero } }, create: { numero }, update: {} });
  }
  // Dos mesas largas (L1, L2) y dos afuera (AF1, AF2)
  for (const [tipo, numero, capacidad] of [['LARGA', 1, 8], ['LARGA', 2, 8], ['AFUERA', 1, 4], ['AFUERA', 2, 4]]) {
    await prisma.mesa.upsert({ where: { tipo_numero: { tipo, numero } }, create: { tipo, numero, capacidad }, update: {} });
  }

  const ingredientes = new Map();
  for (const { inicial, ...datos } of INGREDIENTES) {
    let ingrediente = await prisma.ingrediente.findUnique({ where: { nombre: datos.nombre } });
    if (!ingrediente) {
      // El stock inicial entra como movimiento: el stock siempre es la suma de los movimientos
      ingrediente = await prisma.ingrediente.create({
        data: { ...datos, movimientos: { create: { tipo: 'ENTRADA', cantidad: inicial, motivo: 'Inventario inicial' } } },
      });
    }
    ingredientes.set(datos.nombre, ingrediente.id);
  }

  for (const [orden, { categoria, productos }] of MENU.entries()) {
    const { id: categoriaId } = await prisma.categoria.upsert({
      where: { nombre: categoria },
      create: { nombre: categoria, orden },
      update: {},
    });
    for (const { receta, ...producto } of productos) {
      const { id: productoId } = await prisma.producto.upsert({
        where: { nombre: producto.nombre },
        create: { ...producto, categoriaId },
        update: {},
      });
      for (const [nombre, cantidad] of Object.entries(receta)) {
        const ingredienteId = ingredientes.get(nombre);
        await prisma.receta.upsert({
          where: { productoId_ingredienteId: { productoId, ingredienteId } },
          create: { productoId, ingredienteId, cantidad },
          update: {},
        });
      }
    }
  }

  console.log(`Datos listos: ${await prisma.usuario.count()} usuarios, ${await prisma.mesa.count()} mesas, ${await prisma.producto.count()} productos, ${await prisma.ingrediente.count()} ingredientes.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
