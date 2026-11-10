import { Module } from '@nestjs/common';
import { IdentidadModule } from '../identidad';
import { TiempoRealGateway } from './tiempo-real.gateway';

@Module({
  imports: [IdentidadModule],
  providers: [TiempoRealGateway],
})
export class TiempoRealModule {}
