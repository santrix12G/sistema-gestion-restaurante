import { CatalogoService } from '../../catalogo';
import { DomainError } from '../../../shared/domain-error';
import { calcularTotales } from '../domain/pedido';

export interface ItemSolicitado {
  productoId: string;
  cantidad: number;
  notas?: string;
}

/** Arma las líneas con los precios y la disponibilidad actuales del menú, y calcula los totales. */
export async function armarPedido(catalogo: CatalogoService, items: ItemSolicitado[], costoDomicilio = 0) {
  const productos = await catalogo.productosParaVenta([...new Set(items.map((i) => i.productoId))]);
  const lineas = items.map((item) => {
    const producto = productos.get(item.productoId)!;
    if (!producto.disponible) throw new DomainError('conflicto', `${producto.nombre} no está disponible en este momento`);
    return { productoId: producto.id, nombre: producto.nombre, precioUnitario: producto.precio, cantidad: item.cantidad, notas: item.notas?.trim() || undefined };
  });
  return calcularTotales(lineas, costoDomicilio);
}
