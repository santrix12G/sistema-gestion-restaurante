import { aFormatoChat } from './formato-chat';

describe('aFormatoChat', () => {
  it('pasa la negrita de Markdown a la de WhatsApp', () => {
    expect(aFormatoChat('Te recomiendo la **Hamburguesa sencilla** y una __Limonada__.')).toBe('Te recomiendo la *Hamburguesa sencilla* y una *Limonada*.');
  });

  it('deja intacto el formato que ya es de WhatsApp', () => {
    const texto = 'Agregué *2 limonadas* y _sin hielo_. ¿Algo más?';
    expect(aFormatoChat(texto)).toBe(texto);
    expect(aFormatoChat('*Hamburguesa* *Limonada*')).toBe('*Hamburguesa* *Limonada*');
  });

  it('convierte títulos y listas, y quita los separadores', () => {
    const md = '## Nuestras hamburguesas\n\n- **Sencilla**: $15.000\n* Doble: $20.000\n\n---\n\n¿Cuál te provoca?';
    expect(aFormatoChat(md)).toBe('*Nuestras hamburguesas*\n\n• *Sencilla*: $15.000\n• Doble: $20.000\n\n¿Cuál te provoca?');
  });

  it('convierte las tablas en líneas', () => {
    expect(aFormatoChat('| Producto | Precio |\n|---|---|\n| Limonada | $6.000 |')).toBe('Producto · Precio\nLimonada · $6.000');
  });

  it('muestra los enlaces completos y quita el código', () => {
    expect(aFormatoChat('[Paga aquí](https://mpago.la/abc) con `tarjeta`')).toBe('Paga aquí: https://mpago.la/abc con tarjeta');
  });

  it('quita una pregunta repetida seguida', () => {
    expect(aFormatoChat('Listo: *2 Gaseosas*. ¿A domicilio o para recoger?¿A domicilio o para recoger?')).toBe('Listo: *2 Gaseosas*. ¿A domicilio o para recoger?');
    expect(aFormatoChat('¿Algo más? Dime. ¿Algo más?')).toBe('¿Algo más? Dime. ¿Algo más?');
  });

  it('quita espacios y saltos de línea de sobra', () => {
    expect(aFormatoChat('  Hola  \n\n\n\n¿Qué te provoca?  ')).toBe('Hola\n\n¿Qué te provoca?');
  });
});
