// Lo que el motor de NLP entendió de un mensaje. Es igual venga de las reglas o del LLM.

export const INTENCIONES = [
  'saludo',
  'menu',
  'agregar',
  'quitar',
  'vaciar',
  'terminar',
  'confirmar',
  'negar',
  'cancelar',
  'domicilio',
  'recoger',
  'ayuda',
  'otro',
] as const;

export type Intencion = (typeof INTENCIONES)[number];

export interface ItemInterpretado {
  productoId: string;
  cantidad: number;
  notas?: string;
}

export interface Interpretacion {
  intencion: Intencion;
  items: ItemInterpretado[];
  /** Tipo de entrega mencionado de paso, como en "2 hamburguesas a domicilio" */
  tipoEntrega?: 'DOMICILIO' | 'RECOGER';
  /** Productos que la persona pidió y no están en el menú */
  noReconocidos: string[];
}
