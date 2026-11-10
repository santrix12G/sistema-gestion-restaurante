// Lo único que otros módulos pueden usar de identidad
export { IdentidadModule } from './identidad.module';
export { VerificadorSesion, type UsuarioActual } from './application/verificador-sesion';
export { Publico, Roles, Usuario } from './infrastructure/seguridad';
