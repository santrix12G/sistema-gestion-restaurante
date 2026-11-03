import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma.service';
import { normalizarTelefono } from '../domain/telefono';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Busca al cliente por teléfono, o lo registra. Si llega un nombre, lo actualiza. */
  async obtenerOCrear(telefono: string, nombre?: string) {
    const normalizado = normalizarTelefono(telefono);
    const limpio = nombre?.trim() || undefined;
    return this.prisma.cliente.upsert({
      where: { telefono: normalizado },
      create: { telefono: normalizado, nombre: limpio },
      update: limpio ? { nombre: limpio } : {},
    });
  }
}
