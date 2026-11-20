-- Caja: turnos con base y arqueo, entradas y salidas de efectivo, y el método de cada cobro

-- Formas de pago al cobrar en el local o al entregar
ALTER TYPE "metodo_pago" ADD VALUE 'TARJETA';
ALTER TYPE "metodo_pago" ADD VALUE 'TRANSFERENCIA';

-- Solo el pago en línea necesita pasarela; tarjeta y transferencia se cobran en el local como el efectivo
ALTER TABLE "pagos" DROP CONSTRAINT pagos_proveedor_si_es_online;
ALTER TABLE "pagos" ADD CONSTRAINT pagos_proveedor_si_es_online CHECK (metodo <> 'ONLINE' OR proveedor IS NOT NULL);

CREATE TYPE "tipo_movimiento_caja" AS ENUM ('ENTRADA', 'SALIDA');

CREATE TABLE "cajas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "base" INTEGER NOT NULL,
    "abierta_por_id" UUID NOT NULL,
    "abierta_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrada_por_id" UUID,
    "cerrada_en" TIMESTAMPTZ(3),
    "efectivo_esperado" INTEGER,
    "efectivo_contado" INTEGER,
    "notas_cierre" TEXT,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cajas_abierta_en_idx" ON "cajas"("abierta_en");

-- Solo una caja abierta a la vez, aunque dos personas la abran al mismo tiempo
CREATE UNIQUE INDEX "cajas_una_abierta" ON "cajas" ((true)) WHERE "cerrada_en" IS NULL;

ALTER TABLE "cajas" ADD CONSTRAINT "cajas_abierta_por_id_fkey" FOREIGN KEY ("abierta_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_cerrada_por_id_fkey" FOREIGN KEY ("cerrada_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "movimientos_caja" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caja_id" UUID NOT NULL,
    "tipo" "tipo_movimiento_caja" NOT NULL,
    "monto" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "movimientos_caja_caja_id_idx" ON "movimientos_caja"("caja_id");

ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cada cobro queda en su turno de caja y a nombre de quien recibió el dinero
ALTER TABLE "pagos" ADD COLUMN "caja_id" UUID;
ALTER TABLE "pagos" ADD COLUMN "cobrado_por_id" UUID;
CREATE INDEX "pagos_caja_id_idx" ON "pagos"("caja_id");
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cobrado_por_id_fkey" FOREIGN KEY ("cobrado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
