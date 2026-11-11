-- El restaurante deja de usar la pantalla de cocina, y el pedido solo tiene tres estados:
-- ACTIVO (abierto), PAGADO y CANCELADO. Que un domicilio vaya en camino lo dice su entrega.

-- 1. Estados del pedido. Lo que estaba abierto queda ACTIVO y lo entregado queda PAGADO,
--    porque el pago era contra entrega
CREATE TYPE "estado_pedido_nuevo" AS ENUM ('ACTIVO', 'PAGADO', 'CANCELADO');

ALTER TABLE "pedidos" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "pedidos" ALTER COLUMN "estado" TYPE "estado_pedido_nuevo" USING (
  CASE "estado"::text WHEN 'ENTREGADO' THEN 'PAGADO' WHEN 'CANCELADO' THEN 'CANCELADO' ELSE 'ACTIVO' END
)::"estado_pedido_nuevo";
ALTER TABLE "pedidos" ALTER COLUMN "estado" SET DEFAULT 'ACTIVO';

ALTER TABLE "historial_estados_pedido" ALTER COLUMN "estado_antes" TYPE "estado_pedido_nuevo" USING (
  CASE WHEN "estado_antes" IS NULL THEN NULL
       WHEN "estado_antes"::text = 'ENTREGADO' THEN 'PAGADO'
       WHEN "estado_antes"::text = 'CANCELADO' THEN 'CANCELADO'
       ELSE 'ACTIVO' END
)::"estado_pedido_nuevo";
ALTER TABLE "historial_estados_pedido" ALTER COLUMN "estado_nuevo" TYPE "estado_pedido_nuevo" USING (
  CASE "estado_nuevo"::text WHEN 'ENTREGADO' THEN 'PAGADO' WHEN 'CANCELADO' THEN 'CANCELADO' ELSE 'ACTIVO' END
)::"estado_pedido_nuevo";
-- Los pasos internos que ya no existen (por ejemplo CONFIRMADO -> EN_PREPARACION) quedan como ACTIVO -> ACTIVO
DELETE FROM "historial_estados_pedido" WHERE "estado_antes" = "estado_nuevo";

DROP TYPE "estado_pedido";
ALTER TYPE "estado_pedido_nuevo" RENAME TO "estado_pedido";

-- 2. El rol de cocina desaparece. Sus usuarios se borran; los registros que hicieron se conservan sin autor
UPDATE "historial_estados_pedido" SET "usuario_id" = NULL
  WHERE "usuario_id" IN (SELECT "id" FROM "usuarios" WHERE "rol" = 'COCINA');
UPDATE "pedidos" SET "creado_por_id" = NULL
  WHERE "creado_por_id" IN (SELECT "id" FROM "usuarios" WHERE "rol" = 'COCINA');
DELETE FROM "usuarios" WHERE "rol" = 'COCINA'
  AND NOT EXISTS (SELECT 1 FROM "movimientos_inventario" m WHERE m."usuario_id" = "usuarios"."id")
  AND NOT EXISTS (SELECT 1 FROM "entregas" e WHERE e."repartidor_id" = "usuarios"."id");
-- Si alguno tiene movimientos de inventario (que no se pueden modificar), queda como mesero suspendido
UPDATE "usuarios" SET "rol" = 'MESERO', "activo" = false WHERE "rol" = 'COCINA';

CREATE TYPE "rol_usuario_nuevo" AS ENUM ('ADMIN', 'MESERO', 'REPARTIDOR');
ALTER TABLE "usuarios" ALTER COLUMN "rol" TYPE "rol_usuario_nuevo" USING ("rol"::text::"rol_usuario_nuevo");
DROP TYPE "rol_usuario";
ALTER TYPE "rol_usuario_nuevo" RENAME TO "rol_usuario";
