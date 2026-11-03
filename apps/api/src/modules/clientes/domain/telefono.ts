import { DomainError } from '../../../shared/domain-error';

/**
 * Lleva un teléfono al formato internacional que usa WhatsApp, por ejemplo +573001234567.
 * Acepta celulares colombianos escritos como se acostumbra: 300 123 4567, 300-123-4567 o 57 300 1234567.
 */
export function normalizarTelefono(entrada: string): string {
  const digitos = entrada.replace(/[\s\-().]/g, '');
  let telefono = digitos;
  if (/^3\d{9}$/.test(digitos)) telefono = `+57${digitos}`;
  else if (/^573\d{9}$/.test(digitos)) telefono = `+${digitos}`;

  if (!/^\+[1-9]\d{7,14}$/.test(telefono)) {
    throw new DomainError('validacion', 'El teléfono no es válido. Escribe un celular de 10 dígitos o un número con indicativo, como +57');
  }
  return telefono;
}
