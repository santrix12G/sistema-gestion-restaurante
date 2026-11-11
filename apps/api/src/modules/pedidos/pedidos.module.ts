import { Module } from '@nestjs/common';
import { CatalogoModule } from '../catalogo';
import { ClientesModule } from '../clientes';
import { ActualizarEstadoPedidoUseCase } from './application/actualizar-estado-pedido.use-case';
import { ConsultarPedidosService } from './application/consultar-pedidos.service';
import { CrearPedidoClienteUseCase } from './application/crear-pedido-cliente.use-case';
import { CrearPedidoUseCase } from './application/crear-pedido.use-case';
import { MesasService } from './application/mesas.service';
import { PEDIDO_REPOSITORY } from './application/pedido.repository';
import { MesasController } from './infrastructure/mesas.controller';
import { PedidosController } from './infrastructure/pedidos.controller';
import { PrismaPedidoRepository } from './infrastructure/prisma-pedido.repository';

@Module({
  imports: [CatalogoModule, ClientesModule],
  controllers: [PedidosController, MesasController],
  providers: [
    CrearPedidoUseCase,
    CrearPedidoClienteUseCase,
    ActualizarEstadoPedidoUseCase,
    ConsultarPedidosService,
    MesasService,
    { provide: PEDIDO_REPOSITORY, useClass: PrismaPedidoRepository },
  ],
  exports: [CrearPedidoClienteUseCase],
})
export class PedidosModule {}
