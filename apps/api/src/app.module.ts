import { Module } from '@nestjs/common';
import { CatalogoModule } from './modules/catalogo';
import { ChatbotModule } from './modules/chatbot';
import { ClientesModule } from './modules/clientes';
import { IdentidadModule } from './modules/identidad';
import { PedidosModule } from './modules/pedidos';
import { TiempoRealModule } from './modules/tiempo-real';
import { SharedModule } from './shared/shared.module';

// El monolito: cada módulo es una parte del negocio y solo expone lo que está en su index.ts
@Module({
  imports: [SharedModule, IdentidadModule, CatalogoModule, ClientesModule, PedidosModule, TiempoRealModule, ChatbotModule],
})
export class AppModule {}
