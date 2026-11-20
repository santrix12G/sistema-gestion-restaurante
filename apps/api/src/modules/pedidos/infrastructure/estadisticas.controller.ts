import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../identidad';
import { EstadisticasService } from '../application/estadisticas.service';

@Roles('ADMIN')
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticas: EstadisticasService) {}

  /** Lo vendido, lo cancelado y lo más vendido del día. Sin ?fecha=AAAA-MM-DD, el de hoy (hora de Colombia). */
  @Get('dia')
  delDia(@Query('fecha') fecha?: string) {
    return this.estadisticas.delDia(fecha || undefined);
  }

  /** Reporte de un período: ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD, con las dos fechas incluidas y hasta un año. */
  @Get('periodo')
  delPeriodo(@Query('desde') desde = '', @Query('hasta') hasta = '') {
    return this.estadisticas.delPeriodo(desde, hasta);
  }
}
