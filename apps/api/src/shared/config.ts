// Lee y valida la configuración al arrancar: mejor fallar de inmediato que con la primera petición.
export interface Config {
  puerto: number;
  corsOrigins: string[];
  jwtSecret: string;
}

export function leerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres. Ver apps/api/.env.example');
  if (!env.DATABASE_URL) throw new Error('Falta DATABASE_URL. Ver apps/api/.env.example');

  return {
    puerto: Number(env.PORT ?? 4000),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean),
    jwtSecret,
  };
}
