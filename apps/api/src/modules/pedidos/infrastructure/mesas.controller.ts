import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Roles, Usuario, UsuarioActual } from '../../identidad';
import { MesasService } from '../application/mesas.service';
import { MAX_CAPACIDAD_MESA, MAX_NUMERO_MESA, TipoMesa, TIPOS_MESA } from '../domain/mesa';

class CrearMesaDto {
  @IsIn(TIPOS_MESA, { message: 'El tipo de mesa debe ser NORMAL, LARGA o AFUERA' })
  tipo!: TipoMesa;

  /** Sin número, toma el siguiente libre del tipo */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_NUMERO_MESA)
  numero?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CAPACIDAD_MESA)
  capacidad?: number;
}

class ActualizarMesaDto {
  @IsOptional()
  @IsIn(TIPOS_MESA, { message: 'El tipo de mesa debe ser NORMAL, LARGA o AFUERA' })
  tipo?: TipoMesa;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_NUMERO_MESA)
  numero?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CAPACIDAD_MESA)
  capacidad?: number;

  /** false suspende la mesa: deja de aparecer al tomar pedidos */
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

@Controller('mesas')
export class MesasController {
  constructor(private readonly mesas: MesasService) {}

  /** Las mesas activas. Con ?todas=true, también las suspendidas (solo el administrador). */
  @Get()
  listar(@Usuario() usuario: UsuarioActual, @Query('todas') todas?: string) {
    const incluirSuspendidas = todas === 'true';
    if (incluirSuspendidas && usuario.rol !== 'ADMIN') throw new ForbiddenException('Solo el administrador ve las mesas suspendidas');
    return this.mesas.listar(incluirSuspendidas);
  }

  @Roles('ADMIN')
  @Post()
  crear(@Body() datos: CrearMesaDto) {
    return this.mesas.crear(datos);
  }

  @Roles('ADMIN')
  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() datos: ActualizarMesaDto) {
    return this.mesas.actualizar(id, datos);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(204)
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    await this.mesas.eliminar(id);
  }
}
