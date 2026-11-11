import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PersonalService } from '../application/personal.service';
import { MAX_CONTRASENA, RolPersonal, ROLES_PERSONAL } from '../domain/personal';
import { Roles } from './seguridad';

const MENSAJE_ROL = 'El rol debe ser MESERO o REPARTIDOR';
/** Quita los espacios que se cuelan al copiar y pegar un correo */
const SinEspacios = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

class CrearCuentaDto {
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  nombre!: string;

  @SinEspacios()
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @MaxLength(120)
  email!: string;

  @IsIn(ROLES_PERSONAL, { message: MENSAJE_ROL })
  rol!: RolPersonal;

  // La longitud y las reglas las valida el dominio
  @IsString()
  @MaxLength(MAX_CONTRASENA * 4)
  password!: string;
}

class ActualizarCuentaDto {
  @IsOptional()
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  nombre?: string;

  @IsOptional()
  @SinEspacios()
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsIn(ROLES_PERSONAL, { message: MENSAJE_ROL })
  rol?: RolPersonal;

  /** Nueva contraseña, si el administrador la cambia */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTRASENA * 4)
  password?: string;

  /** false suspende la cuenta: no puede entrar y su sesión abierta deja de funcionar al instante */
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

@Roles('ADMIN')
@Controller('personal')
export class PersonalController {
  constructor(private readonly personal: PersonalService) {}

  @Get()
  listar() {
    return this.personal.listar();
  }

  @Post()
  crear(@Body() datos: CrearCuentaDto) {
    return this.personal.crear(datos);
  }

  @Patch(':id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() datos: ActualizarCuentaDto) {
    return this.personal.actualizar(id, datos);
  }

  @Delete(':id')
  @HttpCode(204)
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    await this.personal.eliminar(id);
  }
}
