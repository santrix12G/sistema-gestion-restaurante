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

  buscarPorTelegram(chatId: string) {
    return this.prisma.cliente.findUnique({ where: { telegramChatId: chatId } });
  }

  /**
   * Vincula el chat de Telegram al cliente de ese teléfono, o lo registra.
   * Si el chat estaba vinculado a otro número, pasa al nuevo.
   */
  async vincularTelegram(telefono: string, chatId: string, nombre?: string) {
    const cliente = await this.obtenerOCrear(telefono, nombre);
    return this.prisma.$transaction(async (tx) => {
      await tx.cliente.updateMany({ where: { telegramChatId: chatId, id: { not: cliente.id } }, data: { telegramChatId: null } });
      return tx.cliente.update({ where: { id: cliente.id }, data: { telegramChatId: chatId } });
    });
  }

  /** Guarda la dirección en la libreta del cliente, sin repetir una que ya tenga escrita igual. */
  async guardarDireccion(clienteId: string, texto: string) {
    const limpio = texto.trim().replace(/\s+/g, ' ');
    return this.prisma.direccion.upsert({
      where: { clienteId_texto: { clienteId, texto: limpio } },
      create: { clienteId, texto: limpio },
      update: {},
    });
  }
}
