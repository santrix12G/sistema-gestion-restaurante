import { Body, ConflictException, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { normalizarTelefono } from '../../clientes';
import { Roles } from '../../identidad';
import { leerConfig } from '../../../shared/config';
import { PrismaService } from '../../../shared/prisma.service';
import { ProcesarMensajeUseCase } from '../application/procesar-mensaje.use-case';

class MensajeSimuladoDto {
  @IsString()
  @Length(7, 20)
  telefono!: string;

  @IsString()
  @Length(1, 1000)
  texto!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombre?: string;
}

/**
 * Chatea con el bot desde la aplicación web, sin WhatsApp. Pasa por el mismo caso de uso que el webhook,
 * así que los pedidos son reales y aparecen en cocina.
 */
@Controller('chatbot/simulador')
@Roles('ADMIN')
export class SimuladorController {
  private readonly proveedor = leerConfig().whatsapp.proveedor;

  constructor(
    private readonly procesar: ProcesarMensajeUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(200)
  async enviar(@Body() dto: MensajeSimuladoDto) {
    // Con WhatsApp conectado (Meta o Twilio), las respuestas saldrían por WhatsApp hacia el número escrito, que puede ser de cualquiera
    if (this.proveedor !== 'simulado') throw new ConflictException('El simulador solo funciona con WHATSAPP_PROVIDER=simulado');
    const respuestas = await this.procesar.ejecutar({ telefono: normalizarTelefono(dto.telefono), texto: dto.texto, nombre: dto.nombre });
    return { respuestas };
  }

  @Get(':telefono')
  async historial(@Param('telefono') telefono: string) {
    const conversacion = await this.prisma.conversacion.findFirst({
      where: { canal: 'WHATSAPP', cliente: { telefono: normalizarTelefono(telefono) } },
      select: { paso: true, mensajes: { orderBy: { creadoEn: 'asc' }, take: 200, select: { id: true, direccion: true, texto: true, creadoEn: true } } },
    });
    return conversacion ?? { paso: 'INICIO', mensajes: [] };
  }
}
