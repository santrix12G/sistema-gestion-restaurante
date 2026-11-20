import { Module } from '@nestjs/common';
import { CajaService } from './application/caja.service';
import { CajaController } from './infrastructure/caja.controller';

@Module({
  controllers: [CajaController],
  providers: [CajaService],
})
export class CajaModule {}
