import { Controller, Get } from '@nestjs/common';
import { Publico } from './modules/identidad';

/** Render la consulta para saber si la API arrancó bien. */
@Controller('salud')
export class SaludController {
  @Publico()
  @Get()
  revisar() {
    return { estado: 'ok' };
  }
}
