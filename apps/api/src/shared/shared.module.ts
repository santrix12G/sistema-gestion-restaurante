import { Global, Module } from '@nestjs/common';
import { BusEventos } from './eventos';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, BusEventos],
  exports: [PrismaService, BusEventos],
})
export class SharedModule {}
