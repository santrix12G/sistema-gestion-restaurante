import { createHmac } from 'node:crypto';
import { firmaMercadoPagoValida, textoFirmado } from './firma-mercadopago';

const SECRETO = 'secreto-de-prueba';
const firmar = (texto: string, secreto = SECRETO) => createHmac('sha256', secreto).update(texto).digest('hex');

describe('firma de MercadoPago', () => {
  it('arma el texto firmado como el SDK oficial', () => {
    expect(textoFirmado('123', 'req-1', '1704908010')).toBe('id:123;request-id:req-1;ts:1704908010;');
    expect(textoFirmado(undefined, 'req-1', '1704908010')).toBe('request-id:req-1;ts:1704908010;');
    expect(textoFirmado('123', undefined, '1704908010')).toBe('id:123;ts:1704908010;');
  });

  const v1 = firmar('id:123;request-id:req-1;ts:1704908010;');
  const datos = { xSignature: `ts=1704908010,v1=${v1}`, xRequestId: 'req-1', dataId: '123', secreto: SECRETO };

  it('acepta un aviso firmado con la clave correcta', () => {
    expect(firmaMercadoPagoValida(datos)).toBe(true);
  });

  it('acepta espacios y mayúsculas en las claves de la cabecera', () => {
    expect(firmaMercadoPagoValida({ ...datos, xSignature: ` TS=1704908010 , V1=${v1} ` })).toBe(true);
  });

  it.each([
    ['otro pago', { dataId: '999' }],
    ['otra petición', { xRequestId: 'req-2' }],
    ['otra hora', { xSignature: `ts=1704908011,v1=${v1}` }],
    ['otra clave', { secreto: 'otra-clave' }],
    ['sin clave configurada', { secreto: '' }],
    ['sin cabecera', { xSignature: undefined }],
    ['cabecera sin firma', { xSignature: 'ts=1704908010' }],
    ['cabecera sin hora', { xSignature: `v1=${v1}` }],
    ['hora que no es número', { xSignature: `ts=abc,v1=${v1}` }],
    ['firma recortada', { xSignature: `ts=1704908010,v1=${v1.slice(0, 10)}` }],
  ])('rechaza un aviso con %s', (_caso, cambio) => {
    expect(firmaMercadoPagoValida({ ...datos, ...cambio })).toBe(false);
  });
});
