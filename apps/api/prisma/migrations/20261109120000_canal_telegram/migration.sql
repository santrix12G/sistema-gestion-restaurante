-- Telegram como segundo canal del chatbot. No modifica ni borra datos existentes.

-- Los pedidos pueden venir de Telegram
ALTER TYPE "canal_pedido" ADD VALUE 'TELEGRAM';

-- El cliente se vincula a su chat de Telegram cuando comparte su número
ALTER TABLE "clientes" ADD COLUMN "telegram_chat_id" TEXT;
CREATE UNIQUE INDEX "clientes_telegram_chat_id_key" ON "clientes"("telegram_chat_id");

-- Una conversación por cliente y canal. Las que existen son de WhatsApp
CREATE TYPE "canal_chat" AS ENUM ('WHATSAPP', 'TELEGRAM');
ALTER TABLE "conversaciones" ADD COLUMN "canal" "canal_chat" NOT NULL DEFAULT 'WHATSAPP';
DROP INDEX "conversaciones_cliente_id_key";
CREATE UNIQUE INDEX "conversaciones_cliente_id_canal_key" ON "conversaciones"("cliente_id", "canal");
