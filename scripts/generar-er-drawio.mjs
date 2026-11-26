// Genera docs/modelo-er.drawio a partir de schema.prisma, para que el diagrama no se desactualice.
// Uso: node scripts/generar-er-drawio.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const esquema = readFileSync(join(raiz, 'apps/api/prisma/schema.prisma'), 'utf8');

// Cada columna del diagrama agrupa las tablas de un módulo
const COLUMNAS = [
  ['Usuario', 'HistorialEstadoPedido', 'EventoOutbox'],
  ['Cliente', 'Direccion', 'Conversacion', 'Mensaje'],
  ['Pedido', 'Mesa', 'Pago'],
  ['Caja', 'MovimientoCaja'],
  ['DetallePedido', 'Entrega', 'Categoria'],
  ['Producto', 'Receta', 'Ingrediente', 'MovimientoInventario'],
];

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const modelos = new Map([...esquema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, nombre, cuerpo]) => [nombre, cuerpo]));

function leerEntidad(nombre) {
  const cuerpo = modelos.get(nombre);
  const campos = [];
  const relaciones = [];
  for (const linea of cuerpo.split('\n').map((l) => l.trim())) {
    if (!linea || linea.startsWith('//') || linea.startsWith('@@')) continue;
    const [campo, tipo] = linea.split(/\s+/);
    const base = tipo.replace(/[?\[\]]/g, '');
    if (modelos.has(base)) {
      const fk = /@relation\((?:"\w+", )?fields: \[(\w+)/.exec(linea);
      if (fk) relaciones.push({ fk: fk[1], destino: base, opcional: tipo.endsWith('?') });
      continue;
    }
    const columna = /@map\("(\w+)"\)/.exec(linea)?.[1] ?? campo;
    campos.push({ campo, columna, tipo, pk: linea.includes('@id') || new RegExp(`@@id\\(\\[.*\\b${campo}\\b`).test(cuerpo), unico: /@unique\b/.test(linea) || new RegExp(`@@unique\\(\\[.*\\b${campo}\\b`).test(cuerpo) });
  }
  const tabla = /@@map\("(\w+)"\)/.exec(cuerpo)[1];
  return { nombre, tabla, campos, relaciones };
}

const ANCHO = 270;
const ALTO_FILA = 22;
const celdas = [];
const entidades = new Map();
let id = 2;

COLUMNAS.forEach((columna, c) => {
  let y = 20;
  for (const nombre of columna) {
    const e = leerEntidad(nombre);
    const fks = new Set(e.relaciones.map((r) => r.fk));
    const alto = 30 + e.campos.length * ALTO_FILA;
    e.celda = `e${id++}`;
    celdas.push(`<mxCell id="${e.celda}" value="${esc(e.tabla)}" style="shape=table;startSize=30;container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;strokeColor=#6c8ebf;fillColor=#dae8fc;align=center;" vertex="1" parent="1"><mxGeometry x="${20 + c * (ANCHO + 110)}" y="${y}" width="${ANCHO}" height="${alto}" as="geometry"/></mxCell>`);
    e.campos.forEach((f, j) => {
      const marcas = [f.pk && 'PK', fks.has(f.campo) && 'FK', f.unico && 'UQ'].filter(Boolean).join(',');
      const texto = `${marcas ? `${marcas}  ` : ''}${f.columna}: ${f.tipo}`;
      celdas.push(`<mxCell id="f${id++}" value="${esc(texto)}" style="text;html=0;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=6;overflow=hidden;fontSize=11;${f.pk ? 'fontStyle=1;' : ''}" vertex="1" parent="${e.celda}"><mxGeometry y="${30 + j * ALTO_FILA}" width="${ANCHO}" height="${ALTO_FILA}" as="geometry"/></mxCell>`);
    });
    entidades.set(nombre, e);
    y += alto + 50;
  }
});

const faltantes = [...modelos.keys()].filter((m) => !entidades.has(m));
if (faltantes.length) throw new Error(`Agrega a COLUMNAS: ${faltantes.join(', ')}`);

for (const e of entidades.values()) {
  for (const r of e.relaciones) {
    celdas.push(`<mxCell id="r${id++}" value="" style="edgeStyle=entityRelationEdgeStyle;rounded=1;html=0;endArrow=${r.opcional ? 'ERzeroToOne' : 'ERmandOne'};startArrow=ERzeroToMany;startFill=0;endFill=0;strokeColor=#6c8ebf;" edge="1" parent="1" source="${e.celda}" target="${entidades.get(r.destino).celda}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  }
}

const xml = `<mxfile host="app.diagrams.net"><diagram name="Modelo entidad-relación" id="er"><mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${celdas.join('')}</root></mxGraphModel></diagram></mxfile>\n`;

mkdirSync(join(raiz, 'docs'), { recursive: true });
writeFileSync(join(raiz, 'docs/modelo-er.drawio'), xml);
console.log(`docs/modelo-er.drawio: ${entidades.size} tablas`);
