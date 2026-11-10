import { partirTexto } from './emisores';
import { mensajeDelAvisoTwilio } from './webhook-twilio.controller';

describe('adaptador de Twilio', () => {
  it('lee el teléfono, el texto y el nombre del aviso', () => {
    const mensaje = mensajeDelAvisoTwilio({ From: 'whatsapp:+573001234567', MessageSid: 'SM1', Body: 'hola', ProfileName: 'Ana' });
    expect(mensaje).toEqual({ telefono: '+573001234567', texto: 'hola', idExterno: 'SM1', nombre: 'Ana' });
  });

  it('trata una foto sin texto como mensaje que no es de texto', () => {
    expect(mensajeDelAvisoTwilio({ From: 'whatsapp:+573001234567', MessageSid: 'SM2', Body: '', NumMedia: '1' })?.texto).toBeUndefined();
  });

  it('ignora avisos que no son de WhatsApp', () => {
    expect(mensajeDelAvisoTwilio({ From: '+573001234567', MessageSid: 'SM3', Body: 'hola' })).toBeUndefined();
  });

  it('parte los textos largos por líneas sin pasar del máximo', () => {
    const texto = Array.from({ length: 10 }, (_, i) => `línea ${i} ${'x'.repeat(30)}`).join('\n');
    const partes = partirTexto(texto, 100);
    expect(partes.every((p) => p.length <= 100)).toBe(true);
    expect(partes.join('\n')).toBe(texto);
  });
});
