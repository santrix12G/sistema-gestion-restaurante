import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles, Usuario, UsuarioActual } from '../../identidad';
import { CajaService } from '../application/caja.service';
import { TIPOS_MOVIMIENTO_CAJA, TipoMovimientoCaja } from '../domain/caja';

class AbrirCajaDto {
  @IsInt({ message: 'La base debe ser un valor en pesos' })
  base!: number;
}

class MovimientoCajaDto {
  @IsIn(TIPOS_MOVIMIENTO_CAJA, { message: 'El tipo debe ser ENTRADA o SALIDA' })
  tipo!: TipoMovimientoCaja;

  @IsInt({ message: 'El monto debe ser un valor en pesos' })
  monto!: number;

  @IsString({ message: 'Escribe el motivo del movimiento' })
  @MaxLength(120)
  motivo!: string;
}

class CerrarCajaDto {
  @IsInt({ message: 'El efectivo contado debe ser un valor en pesos' })
  efectivoContado!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notas?: string;
}

/** La caja la maneja el administrador. El resto del personal solo consulta si está abierta para poder cobrar. */
@Roles('ADMIN')
@Controller('caja')
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  @Roles('ADMIN', 'MESERO', 'REPARTIDOR')
  @Get('estado')
  estado() {
    return this.caja.estado();
  }

  /** La caja abierta con sus cuentas, o { caja: null } si no hay ninguna */
  @Get('actual')
  async actual() {
    return { caja: await this.caja.actual() };
  }

  @Get('historial')
  historial() {
    return this.caja.historial();
  }

  @Get(':id')
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.caja.detalle(id);
  }

  @Post('abrir')
  abrir(@Body() { base }: AbrirCajaDto, @Usuario() usuario: UsuarioActual) {
    return this.caja.abrir(base, usuario.id);
  }

  @Post('movimientos')
  movimiento(@Body() { tipo, monto, motivo }: MovimientoCajaDto, @Usuario() usuario: UsuarioActual) {
    return this.caja.registrarMovimiento(tipo, monto, motivo, usuario.id);
  }

  @Post('cerrar')
  cerrar(@Body() { efectivoContado, notas }: CerrarCajaDto, @Usuario() usuario: UsuarioActual) {
    return this.caja.cerrar(efectivoContado, notas, usuario.id);
  }
}
