import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { DomainError, TipoError } from './domain-error';

const ESTADO_POR_TIPO: Record<TipoError, number> = {
  validacion: HttpStatus.BAD_REQUEST,
  no_encontrado: HttpStatus.NOT_FOUND,
  conflicto: HttpStatus.CONFLICT,
  prohibido: HttpStatus.FORBIDDEN,
};

/** Todas las respuestas de error tienen la forma { mensaje }, que la web muestra tal cual. */
@Catch()
export class ErroresHttpFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const [estado, mensaje] = this.traducir(error);
    if (estado >= 500) this.logger.error(error);
    res.status(estado).json({ mensaje });
  }

  private traducir(error: unknown): [number, string] {
    if (error instanceof DomainError) return [ESTADO_POR_TIPO[error.tipo], error.message];
    if (error instanceof HttpException) {
      const cuerpo = error.getResponse();
      const mensaje = typeof cuerpo === 'object' && 'message' in cuerpo ? cuerpo.message : error.message;
      return [error.getStatus(), Array.isArray(mensaje) ? mensaje.join('. ') : String(mensaje)];
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return [HttpStatus.CONFLICT, 'Ya existe un registro con ese valor'];
      if (error.code === 'P2025') return [HttpStatus.NOT_FOUND, 'El registro no existe'];
    }
    return [HttpStatus.INTERNAL_SERVER_ERROR, 'Error interno del servidor'];
  }
}
