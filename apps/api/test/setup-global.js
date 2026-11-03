// Levanta un PostgreSQL temporal, aplica las migraciones y carga los datos iniciales.
const { execSync } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const PUERTO = 5437;

module.exports = async () => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pg = new EmbeddedPostgres({
    databaseDir: mkdtempSync(join(tmpdir(), 'restaurante-pg-')),
    user: 'pruebas',
    password: 'pruebas',
    port: PUERTO,
    persistent: false,
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('restaurante');
  globalThis.__PG__ = pg;

  Object.assign(process.env, {
    DATABASE_URL: `postgresql://pruebas:pruebas@localhost:${PUERTO}/restaurante`,
    JWT_SECRET: 'secreto-solo-para-las-pruebas-de-integracion',
    SEED_ADMIN_PASSWORD: 'Admin-pruebas-1',
    SEED_STAFF_PASSWORD: 'Staff-pruebas-1',
  });
  const opciones = { cwd: resolve(__dirname, '..'), env: process.env, stdio: 'pipe' };
  execSync('npx prisma migrate deploy', opciones);
  execSync('node prisma/seed.mjs', opciones);
};
