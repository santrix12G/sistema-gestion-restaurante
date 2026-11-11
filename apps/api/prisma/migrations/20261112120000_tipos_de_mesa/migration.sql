-- Las mesas tienen tipo: normal (M1), larga (L1) o afuera (AF1). El número se repite entre tipos.
CREATE TYPE "tipo_mesa" AS ENUM ('NORMAL', 'LARGA', 'AFUERA');

-- Las mesas que ya existen son normales: la mesa 3 pasa a ser la M3
ALTER TABLE "mesas" ADD COLUMN "tipo" "tipo_mesa" NOT NULL DEFAULT 'NORMAL';

DROP INDEX "mesas_numero_key";
CREATE UNIQUE INDEX "mesas_tipo_numero_key" ON "mesas"("tipo", "numero");
