-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('ADMIN', 'MESERO', 'COCINA', 'REPARTIDOR');

-- CreateEnum
CREATE TYPE "tipo_pedido" AS ENUM ('MESA', 'DOMICILIO', 'RECOGER');

-- CreateEnum
CREATE TYPE "canal_pedido" AS ENUM ('WEB', 'MOVIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "estado_pedido" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "estado_entrega" AS ENUM ('PENDIENTE', 'ASIGNADA', 'EN_CAMINO', 'ENTREGADA', 'FALLIDA');

-- CreateEnum
CREATE TYPE "metodo_pago" AS ENUM ('EFECTIVO', 'ONLINE');

-- CreateEnum
CREATE TYPE "estado_pago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "paso_conversacion" AS ENUM ('INICIO', 'ARMANDO_PEDIDO', 'TIPO_ENTREGA', 'DIRECCION', 'METODO_PAGO', 'CONFIRMACION');

-- CreateEnum
CREATE TYPE "direccion_mensaje" AS ENUM ('ENTRANTE', 'SALIENTE');

-- CreateEnum
CREATE TYPE "unidad_medida" AS ENUM ('GRAMO', 'MILILITRO', 'UNIDAD');

-- CreateEnum
CREATE TYPE "tipo_movimiento" AS ENUM ('ENTRADA', 'AJUSTE', 'SALIDA_PEDIDO', 'DEVOLUCION_PEDIDO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "rol_usuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT,
    "telefono" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "barrio" TEXT,
    "referencia" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoria_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" INTEGER NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "sinonimos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero" INTEGER NOT NULL,
    "capacidad" INTEGER NOT NULL DEFAULT 4,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero" SERIAL NOT NULL,
    "clave_idempotencia" TEXT,
    "tipo" "tipo_pedido" NOT NULL,
    "canal" "canal_pedido" NOT NULL,
    "estado" "estado_pedido" NOT NULL DEFAULT 'PENDIENTE',
    "cliente_id" UUID,
    "mesa_id" UUID,
    "creado_por_id" UUID,
    "subtotal" INTEGER NOT NULL,
    "costo_domicilio" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "notas" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_pedido" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "nombre_producto" TEXT NOT NULL,
    "precio_unitario" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "notas" TEXT,

    CONSTRAINT "detalles_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_estados_pedido" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "estado_antes" "estado_pedido",
    "estado_nuevo" "estado_pedido" NOT NULL,
    "usuario_id" UUID,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_estados_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "direccion_id" UUID NOT NULL,
    "direccion_texto" TEXT NOT NULL,
    "repartidor_id" UUID,
    "estado" "estado_entrega" NOT NULL DEFAULT 'PENDIENTE',
    "observacion" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asignada_en" TIMESTAMPTZ(3),
    "entregada_en" TIMESTAMPTZ(3),

    CONSTRAINT "entregas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "metodo" "metodo_pago" NOT NULL,
    "estado" "estado_pago" NOT NULL DEFAULT 'PENDIENTE',
    "monto" INTEGER NOT NULL,
    "proveedor" TEXT,
    "referencia_externa" TEXT,
    "url_pago" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "paso" "paso_conversacion" NOT NULL DEFAULT 'INICIO',
    "contexto" JSONB NOT NULL DEFAULT '{}',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversacion_id" UUID NOT NULL,
    "direccion" "direccion_mensaje" NOT NULL,
    "texto" TEXT NOT NULL,
    "wa_message_id" TEXT,
    "intencion" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "unidad" "unidad_medida" NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas" (
    "producto_id" UUID NOT NULL,
    "ingrediente_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "recetas_pkey" PRIMARY KEY ("producto_id","ingrediente_id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ingrediente_id" UUID NOT NULL,
    "tipo" "tipo_movimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "pedido_id" UUID,
    "usuario_id" UUID,
    "motivo" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicado_en" TIMESTAMPTZ(3),

    CONSTRAINT "eventos_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_telefono_key" ON "clientes"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "direcciones_cliente_id_texto_key" ON "direcciones"("cliente_id", "texto");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "productos_nombre_key" ON "productos"("nombre");

-- CreateIndex
CREATE INDEX "productos_categoria_id_idx" ON "productos"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_numero_key" ON "mesas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_numero_key" ON "pedidos"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_clave_idempotencia_key" ON "pedidos"("clave_idempotencia");

-- CreateIndex
CREATE INDEX "pedidos_estado_idx" ON "pedidos"("estado");

-- CreateIndex
CREATE INDEX "pedidos_creado_en_idx" ON "pedidos"("creado_en");

-- CreateIndex
CREATE INDEX "pedidos_cliente_id_idx" ON "pedidos"("cliente_id");

-- CreateIndex
CREATE INDEX "detalles_pedido_pedido_id_idx" ON "detalles_pedido"("pedido_id");

-- CreateIndex
CREATE INDEX "detalles_pedido_producto_id_idx" ON "detalles_pedido"("producto_id");

-- CreateIndex
CREATE INDEX "historial_estados_pedido_pedido_id_creado_en_idx" ON "historial_estados_pedido"("pedido_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_pedido_id_key" ON "entregas"("pedido_id");

-- CreateIndex
CREATE INDEX "entregas_repartidor_id_estado_idx" ON "entregas"("repartidor_id", "estado");

-- CreateIndex
CREATE INDEX "pagos_pedido_id_idx" ON "pagos"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_proveedor_referencia_externa_key" ON "pagos"("proveedor", "referencia_externa");

-- CreateIndex
CREATE UNIQUE INDEX "conversaciones_cliente_id_key" ON "conversaciones"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "mensajes_wa_message_id_key" ON "mensajes"("wa_message_id");

-- CreateIndex
CREATE INDEX "mensajes_conversacion_id_creado_en_idx" ON "mensajes"("conversacion_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "ingredientes_nombre_key" ON "ingredientes"("nombre");

-- CreateIndex
CREATE INDEX "recetas_ingrediente_id_idx" ON "recetas"("ingrediente_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_ingrediente_id_creado_en_idx" ON "movimientos_inventario"("ingrediente_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_inventario_pedido_id_ingrediente_id_tipo_key" ON "movimientos_inventario"("pedido_id", "ingrediente_id", "tipo");

-- CreateIndex
CREATE INDEX "eventos_outbox_publicado_en_creado_en_idx" ON "eventos_outbox"("publicado_en", "creado_en");

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_pedido" ADD CONSTRAINT "detalles_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_pedido" ADD CONSTRAINT "detalles_pedido_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_estados_pedido" ADD CONSTRAINT "historial_estados_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_estados_pedido" ADD CONSTRAINT "historial_estados_pedido_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_direccion_id_fkey" FOREIGN KEY ("direccion_id") REFERENCES "direcciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_repartidor_id_fkey" FOREIGN KEY ("repartidor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_ingrediente_id_fkey" FOREIGN KEY ("ingrediente_id") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_ingrediente_id_fkey" FOREIGN KEY ("ingrediente_id") REFERENCES "ingredientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

