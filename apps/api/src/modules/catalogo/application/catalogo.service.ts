import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from '../../../shared/domain-error';
import { PrismaService } from '../../../shared/prisma.service';

export interface ProductoParaVenta {
  id: string;
  nombre: string;
  precio: number;
  disponible: boolean;
}

// El catálogo es CRUD sin reglas de negocio complejas: el servicio usa Prisma directamente,
// sin la capa de dominio y repositorio que sí tiene pedidos.
@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  listarCategorias() {
    return this.prisma.categoria.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });
  }

  crearCategoria(datos: { nombre: string; orden?: number }) {
    return this.prisma.categoria.create({ data: datos });
  }

  actualizarCategoria(id: string, datos: { nombre?: string; orden?: number; activa?: boolean }) {
    return this.prisma.categoria.update({ where: { id }, data: datos });
  }

  listarProductos() {
    return this.prisma.producto.findMany({
      orderBy: [{ categoria: { orden: 'asc' } }, { nombre: 'asc' }],
      include: { categoria: { select: { id: true, nombre: true } } },
    });
  }

  crearProducto(datos: Prisma.ProductoUncheckedCreateInput) {
    return this.prisma.producto.create({ data: datos });
  }

  actualizarProducto(id: string, datos: Prisma.ProductoUncheckedUpdateInput) {
    return this.prisma.producto.update({ where: { id }, data: datos });
  }

  /** Para el módulo de pedidos: el precio siempre sale de aquí, nunca de lo que envía el cliente. */
  async productosParaVenta(ids: string[]): Promise<Map<string, ProductoParaVenta>> {
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, precio: true, disponible: true, categoria: { select: { activa: true } } },
    });
    const encontrados = new Map(
      productos.map(({ categoria, disponible, ...p }) => [p.id, { ...p, disponible: disponible && categoria.activa }]),
    );
    const faltantes = ids.filter((id) => !encontrados.has(id));
    if (faltantes.length) throw new DomainError('validacion', 'Uno de los productos ya no existe en el menú');
    return encontrados;
  }
}
