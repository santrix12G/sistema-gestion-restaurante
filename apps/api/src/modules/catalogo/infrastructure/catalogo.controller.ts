import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { Roles } from '../../identidad';
import { CatalogoService } from '../application/catalogo.service';

class CategoriaDto {
  @IsString()
  @Length(2, 60)
  nombre!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

class ActualizarCategoriaDto extends PartialType(CategoriaDto) {
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

class ProductoDto {
  @IsUUID()
  categoriaId!: string;

  @IsString()
  @Length(2, 80)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @IsInt({ message: 'El precio debe ser un valor entero en pesos' })
  @Min(0)
  @Max(10_000_000)
  precio!: number;

  @IsOptional()
  @IsBoolean()
  disponible?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  sinonimos?: string[];
}

class ActualizarProductoDto extends PartialType(ProductoDto) {}

class DisponibilidadDto {
  @IsBoolean()
  disponible!: boolean;
}

@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get('categorias')
  categorias() {
    return this.catalogo.listarCategorias();
  }

  @Roles('ADMIN')
  @Post('categorias')
  crearCategoria(@Body() datos: CategoriaDto) {
    return this.catalogo.crearCategoria(datos);
  }

  @Roles('ADMIN')
  @Patch('categorias/:id')
  actualizarCategoria(@Param('id', ParseUUIDPipe) id: string, @Body() datos: ActualizarCategoriaDto) {
    return this.catalogo.actualizarCategoria(id, datos);
  }

  @Get('productos')
  productos() {
    return this.catalogo.listarProductos();
  }

  @Roles('ADMIN')
  @Post('productos')
  crearProducto(@Body() datos: ProductoDto) {
    return this.catalogo.crearProducto(datos);
  }

  @Roles('ADMIN')
  @Patch('productos/:id')
  actualizarProducto(@Param('id', ParseUUIDPipe) id: string, @Body() datos: ActualizarProductoDto) {
    return this.catalogo.actualizarProducto(id, datos);
  }

  // El mesero también puede marcar un plato como agotado, cuando la cocina se lo avisa
  @Roles('ADMIN', 'MESERO')
  @Patch('productos/:id/disponibilidad')
  cambiarDisponibilidad(@Param('id', ParseUUIDPipe) id: string, @Body() { disponible }: DisponibilidadDto) {
    return this.catalogo.actualizarProducto(id, { disponible });
  }
}
