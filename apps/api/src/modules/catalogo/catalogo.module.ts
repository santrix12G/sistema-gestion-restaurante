import { Module } from '@nestjs/common';
import { CatalogoService } from './application/catalogo.service';
import { CatalogoController } from './infrastructure/catalogo.controller';

@Module({
  controllers: [CatalogoController],
  providers: [CatalogoService],
  exports: [CatalogoService],
})
export class CatalogoModule {}
