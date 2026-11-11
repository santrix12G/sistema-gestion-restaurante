import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Roles, Usuario, UsuarioActual } from '../../identidad';
import { ActualizarEstadoPedidoUseCase } from '../application/actualizar-estado-pedido.use-case';
import { ConsultarPedidosService } from '../application/consultar-pedidos.service';
import { CrearPedidoUseCase } from '../application/crear-pedido.use-case';
import { EstadoPedido, MAX_CANTIDAD_POR_LINEA } from '../domain/pedido';

const ESTADOS: EstadoPedido[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'];

class ItemDto {
  @IsUUID()
  productoId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_CANTIDAD_POR_LINEA)
  cantidad!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notas?: string;
}

class ClienteDto {
  @IsString()
  @Length(7, 20)
  telefono!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombre?: string;
}

class CrearPedidoDto {
  @IsIn(['MESA', 'RECOGER'])
  tipo!: 'MESA' | 'RECOGER';

  /** La app móvil envía MOVIL; sin este campo, el pedido cuenta como hecho en la web */
  @IsOptional()
  @IsIn(['WEB', 'MOVIL'])
  canal?: 'WEB' | 'MOVIL';

  @IsOptional()
  @IsUUID()
  mesaId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClienteDto)
  cliente?: ClienteDto;

  @ArrayMinSize(1, { message: 'Agrega al menos un producto' })
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notas?: string;
}

class CambiarEstadoDto {
  @IsIn(ESTADOS)
  estado!: EstadoPedido;
}

@Controller()
export class PedidosController {
  constructor(
    private readonly crearPedido: CrearPedidoUseCase,
    private readonly actualizarEstado: ActualizarEstadoPedidoUseCase,
    private readonly consultar: ConsultarPedidosService,
  ) {}

  @Get('mesas')
  mesas() {
    return this.consultar.mesas();
  }

  /** Sin filtro devuelve los pedidos activos. Con ?estados=LISTO,EN_CAMINO filtra por esos estados. */
  @Get('pedidos')
  listar(@Query('estados') estados?: string) {
    if (!estados) return this.consultar.listar();
    const lista = estados.split(',') as EstadoPedido[];
    if (lista.some((e) => !ESTADOS.includes(e))) throw new BadRequestException('Estado de pedido desconocido');
    return this.consultar.listar(lista);
  }

  @Get('pedidos/:id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.consultar.obtener(id);
  }

  // La web envía una clave por cada intento de crear el pedido: un doble clic no lo duplica
  @Roles('ADMIN', 'MESERO')
  @Post('pedidos')
  crear(@Body() datos: CrearPedidoDto, @Usuario() usuario: UsuarioActual, @Headers('idempotency-key') clave?: string) {
    if (clave !== undefined && !/^[\w-]{8,100}$/.test(clave)) throw new BadRequestException('Idempotency-Key no es válida');
    return this.crearPedido.ejecutar({ ...datos, claveIdempotencia: clave }, usuario);
  }

  @Patch('pedidos/:id/estado')
  cambiarEstado(@Param('id', ParseUUIDPipe) id: string, @Body() { estado }: CambiarEstadoDto, @Usuario() usuario: UsuarioActual) {
    return this.actualizarEstado.ejecutar(id, estado, usuario);
  }
}
