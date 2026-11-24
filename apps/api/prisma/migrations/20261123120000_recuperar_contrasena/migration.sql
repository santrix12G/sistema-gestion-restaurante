-- Cambiar la contraseña cierra las sesiones abiertas: las iniciadas antes de esta fecha dejan de valer
ALTER TABLE "usuarios" ADD COLUMN "sesiones_desde" TIMESTAMPTZ(3);

-- Enlaces de un solo uso para restablecer la contraseña. Se guarda el hash SHA-256, nunca el token
CREATE TABLE "tokens_recuperacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "usado_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_recuperacion_token_hash_key" ON "tokens_recuperacion"("token_hash");
CREATE INDEX "tokens_recuperacion_usuario_id_idx" ON "tokens_recuperacion"("usuario_id");

ALTER TABLE "tokens_recuperacion" ADD CONSTRAINT "tokens_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Como el resto de tablas: fuera del alcance de la API de datos de Supabase
ALTER TABLE "tokens_recuperacion" ENABLE ROW LEVEL SECURITY;
