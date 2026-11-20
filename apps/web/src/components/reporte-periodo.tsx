'use client';

import { Bot, Download, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Barra, Cifra, HorasPico, NOMBRE_CANAL, NOMBRE_TIPO, Panel, VentasPorCanal, VentasPorTipo, hoy, nombreHora, parteDelChatbot, plural } from '@/components/estadisticas';
import { Aviso, Boton, Cargando, Vacio } from '@/components/ui';
import { llamar } from '@/lib/api';
import { Celda, descargarCsv } from '@/lib/csv';
import { pesos } from '@/lib/formato';
import { useDatos } from '@/lib/hooks';
import { ReportePeriodo as Reporte, TiempoServicio } from '@/lib/tipos';

/** Mismos niveles de espera que las tarjetas de pedido */
const MINUTOS_ATENCION = 15;

/** Suma días a una fecha AAAA-MM-DD */
function sumarDias(dia: string, dias: number) {
  const fecha = new Date(`${dia}T12:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const formatoDia = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
/** "2026-11-09" → "lun, 9 nov" */
const nombreDia = (dia: string) => formatoDia.format(new Date(`${dia}T12:00:00.000Z`)).replace('.', '');
const DIA_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface Rango {
  desde: string;
  hasta: string;
}

/** Los períodos más usados, para no escribir las fechas a mano */
const ATAJOS: { texto: string; rango: () => Rango }[] = [
  { texto: 'Últimos 7 días', rango: () => ({ desde: sumarDias(hoy(), -6), hasta: hoy() }) },
  { texto: 'Últimos 30 días', rango: () => ({ desde: sumarDias(hoy(), -29), hasta: hoy() }) },
  { texto: 'Este mes', rango: () => ({ desde: `${hoy().slice(0, 8)}01`, hasta: hoy() }) },
  {
    texto: 'Mes pasado',
    rango: () => {
      const finMesPasado = sumarDias(`${hoy().slice(0, 8)}01`, -1);
      return { desde: `${finMesPasado.slice(0, 8)}01`, hasta: finMesPasado };
    },
  },
];

const claseFecha = 'rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100';

export function ReportePeriodo() {
  const [rango, setRango] = useState<Rango>(ATAJOS[0].rango);
  const atajo = ATAJOS.find((a) => {
    const r = a.rango();
    return r.desde === rango.desde && r.hasta === rango.hasta;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <div className="flex flex-wrap gap-2">
          {ATAJOS.map((a) => (
            <button
              key={a.texto}
              onClick={() => setRango(a.rango())}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${atajo === a ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-50'}`}
            >
              {a.texto}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3 lg:ml-auto">
          <label className="text-sm font-medium text-stone-700">
            <span className="mb-1 block">Desde</span>
            <input type="date" className={claseFecha} value={rango.desde} max={rango.hasta} onChange={(e) => e.target.value && setRango({ ...rango, desde: e.target.value })} />
          </label>
          <label className="text-sm font-medium text-stone-700">
            <span className="mb-1 block">Hasta</span>
            <input type="date" className={claseFecha} value={rango.hasta} min={rango.desde} max={hoy()} onChange={(e) => e.target.value && setRango({ ...rango, hasta: e.target.value })} />
          </label>
        </div>
      </div>
      {/* Otro período monta el reporte de nuevo con sus propios datos */}
      <Contenido key={`${rango.desde}_${rango.hasta}`} rango={rango} />
    </div>
  );
}

function Contenido({ rango }: { rango: Rango }) {
  const { datos, error } = useDatos(() => llamar<Reporte>(`/estadisticas/periodo?desde=${rango.desde}&hasta=${rango.hasta}`));
  if (!datos) return error ? <Aviso>{error}</Aviso> : <Cargando />;

  const { ventas, cancelados, comparacion, porDia, mejorDia, porCanal, porTipo, porHora, horaPico } = datos;
  const dias = porDia.length;
  const sinVentas = 'No hubo ventas en este período';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">
          Del <strong>{nombreDia(datos.desde)}</strong> al <strong>{nombreDia(datos.hasta)}</strong> · {plural(dias, 'día', 'días')}
        </p>
        <Boton variante="secundario" onClick={() => descargarCsv(`reporte-${datos.desde}-a-${datos.hasta}.csv`, filasCsv(datos))}>
          <Download className="size-4" aria-hidden />
          Descargar para Excel
        </Boton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra titulo="Vendido" valor={pesos(ventas.total)} detalle={<Variacion valor={comparacion.variacionVentas} dias={dias} clara />} destacada />
        <Cifra titulo="Pedidos pagados" valor={String(ventas.pedidos)} detalle={<Variacion valor={comparacion.variacionPedidos} dias={dias} />} />
        <Cifra titulo="Promedio por pedido" valor={pesos(ventas.promedio)} detalle={plural(ventas.platos, 'producto vendido', 'productos vendidos')} />
        <Cifra titulo="Cancelados" valor={String(cancelados.pedidos)} detalle={`${pesos(cancelados.total)} que no se cobraron`} />
      </div>

      <Panel titulo="Ventas por día" detalle={mejorDia ? `Mejor día: ${nombreDia(mejorDia.fecha)} con ${pesos(mejorDia.total)}` : undefined}>
        {ventas.pedidos === 0 ? <Vacio>{sinVentas}</Vacio> : <GraficaDias porDia={porDia} mejor={mejorDia?.fecha} />}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Días de la semana" detalle="Promedio vendido cada día">
          <DiasSemana datos={datos} />
        </Panel>
        <Panel titulo="Tiempos de servicio" detalle="Desde que llega el pedido hasta que se cobra">
          <Tiempos datos={datos} />
        </Panel>
        <Panel titulo="Meseros">
          <Meseros datos={datos} />
        </Panel>
        <Panel titulo="Repartidores">
          <Repartidores datos={datos} />
        </Panel>
        <Panel titulo="Ventas por canal" detalle={parteDelChatbot(porCanal, ventas.total)}>
          <VentasPorCanal porCanal={porCanal} />
        </Panel>
        <Panel titulo="Ventas por tipo de pedido">
          <VentasPorTipo porTipo={porTipo} />
        </Panel>
      </div>

      <Panel titulo="Horas pico" detalle={horaPico !== null ? `Más pedidos a las ${nombreHora(horaPico)}` : undefined}>
        <HorasPico porHora={porHora} horaPico={horaPico} sinVentas={sinVentas} />
      </Panel>

      <Panel titulo="Productos" detalle="Del que más vendió al que menos, con los que no se vendieron">
        <Productos datos={datos} />
      </Panel>

      <p className="text-xs text-stone-500">
        Un pedido cuenta el día en que se cobró o se canceló. Lo vendido incluye el costo de los domicilios; los cancelados no suman a ninguna cifra de ventas. La comparación
        es contra los {plural(dias, 'día', 'días')} anteriores al período.
      </p>
    </div>
  );
}

/** "▲ 12 % frente a los 7 días anteriores" */
function Variacion({ valor, dias, clara }: { valor: number | null; dias: number; clara?: boolean }) {
  const anteriores = dias === 1 ? 'el día anterior' : `los ${dias} días anteriores`;
  const contra = `frente a ${anteriores}`;
  if (valor === null) return <>No hubo ventas en {anteriores} para comparar</>;
  const sube = valor >= 0;
  const Icono = sube ? TrendingUp : TrendingDown;
  const color = clara ? 'text-white' : sube ? 'text-emerald-700' : 'text-red-700';
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center gap-1 font-bold ${color}`}>
        <Icono className="size-3.5" aria-hidden />
        {sube ? '+' : ''}
        {valor} %
      </span>
      {contra}
    </span>
  );
}

/** Barras de lo vendido cada día. Con muchos días solo se rotulan algunos para que se lea. */
function GraficaDias({ porDia, mejor }: { porDia: Reporte['porDia']; mejor?: string }) {
  const max = Math.max(...porDia.map((d) => d.total), 1);
  const cada = porDia.length <= 16 ? 1 : porDia.length <= 31 ? 2 : 7;
  return (
    <div className={`flex h-52 items-end ${porDia.length > 31 ? 'gap-px' : 'gap-1'}`} role="list" aria-label="Vendido por día">
      {porDia.map((d, i) => (
        <div key={d.fecha} role="listitem" className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${nombreDia(d.fecha)}: ${pesos(d.total)}, ${plural(d.pedidos, 'pedido', 'pedidos')}`}>
          <div className="flex w-full flex-1 items-end">
            <div className={`w-full rounded-t ${d.fecha === mejor ? 'bg-marca-600' : 'bg-marca-500/40'}`} style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total ? 3 : 0 }} />
          </div>
          <span className="h-3 w-full text-center text-[10px] leading-3 text-stone-500 tabular-nums">{i % cada === 0 ? Number(d.fecha.slice(8)) : ''}</span>
        </div>
      ))}
    </div>
  );
}

function DiasSemana({ datos }: { datos: Reporte }) {
  const max = Math.max(...datos.porDiaSemana.map((d) => d.promedio), 1);
  const mejor = datos.porDiaSemana.reduce((a, b) => (b.promedio > a.promedio ? b : a));
  return (
    <ul className="space-y-2.5">
      {datos.porDiaSemana.map((d) => (
        <li key={d.diaSemana} className={d.dias === 0 ? 'opacity-40' : ''}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">
              {DIA_SEMANA[d.diaSemana]}
              {d === mejor && d.promedio > 0 && <span className="ml-2 rounded-full bg-marca-50 px-2 py-0.5 text-xs font-semibold text-marca-700">El más fuerte</span>}
            </span>
            <span className="text-stone-600">
              <strong className="text-stone-900">{pesos(d.promedio)}</strong> · {plural(d.pedidos, 'pedido', 'pedidos')}
            </span>
          </div>
          <Barra proporcion={d.promedio / max} />
        </li>
      ))}
    </ul>
  );
}

const colorTiempo = (minutos: number | null, limite: number) =>
  minutos === null ? 'text-stone-400' : minutos < MINUTOS_ATENCION ? 'text-emerald-700' : minutos <= limite ? 'text-amber-700' : 'text-red-700';
const textoMinutos = (minutos: number | null) => (minutos === null ? '—' : `${minutos} min`);

function Tiempos({ datos }: { datos: Reporte }) {
  const { general, porTipo, limiteMinutos } = datos.tiempos;
  if (general.pedidos === 0) return <Vacio>No hubo pedidos pagados en este período</Vacio>;
  const fila = (nombre: string, t: TiempoServicio) => (
    <tr key={nombre} className="border-t border-stone-100">
      <td className="py-2 font-medium">{nombre}</td>
      <td className="py-2 text-right tabular-nums text-stone-600">{t.pedidos}</td>
      <td className={`py-2 text-right font-semibold tabular-nums ${colorTiempo(t.minutosPromedio, limiteMinutos)}`}>{textoMinutos(t.minutosPromedio)}</td>
      <td className="py-2 text-right tabular-nums text-stone-600">{t.pedidos ? `${t.demorados} (${t.porcentajeDemorados} %)` : '—'}</td>
    </tr>
  );
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-stone-50 p-3">
          <p className="text-xs text-stone-500">Promedio</p>
          <p className={`text-2xl font-bold tabular-nums ${colorTiempo(general.minutosPromedio, limiteMinutos)}`}>{textoMinutos(general.minutosPromedio)}</p>
        </div>
        <div className="rounded-xl bg-stone-50 p-3">
          <p className="text-xs text-stone-500">Pasaron de {limiteMinutos} min</p>
          <p className="text-2xl font-bold tabular-nums">{general.porcentajeDemorados} %</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-stone-500">
          <tr>
            <th className="pb-1 text-left font-medium">Tipo</th>
            <th className="pb-1 text-right font-medium">Pedidos</th>
            <th className="pb-1 text-right font-medium">Promedio</th>
            <th className="pb-1 text-right font-medium">Más de {limiteMinutos} min</th>
          </tr>
        </thead>
        <tbody>{porTipo.map((t) => fila(NOMBRE_TIPO[t.tipo], t))}</tbody>
      </table>
    </>
  );
}

function Meseros({ datos }: { datos: Reporte }) {
  const { meseros, chatbot } = datos.personal;
  if (meseros.length === 0 && chatbot.pedidos === 0) return <Vacio>No hubo pedidos pagados en este período</Vacio>;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-stone-500">
        <tr>
          <th className="pb-1 text-left font-medium">Quién registró el pedido</th>
          <th className="pb-1 text-right font-medium">Pedidos</th>
          <th className="pb-1 text-right font-medium">Vendido</th>
          <th className="hidden pb-1 text-right font-medium sm:table-cell">Promedio</th>
        </tr>
      </thead>
      <tbody>
        {meseros.map((m) => (
          <tr key={m.id} className="border-t border-stone-100">
            <td className="py-2 font-medium">{m.nombre}</td>
            <td className="py-2 text-right tabular-nums">{m.pedidos}</td>
            <td className="py-2 text-right font-semibold tabular-nums">{pesos(m.total)}</td>
            <td className="hidden py-2 text-right tabular-nums text-stone-600 sm:table-cell">{pesos(m.promedio)}</td>
          </tr>
        ))}
        {chatbot.pedidos > 0 && (
          <tr className="border-t border-stone-100 text-stone-600">
            <td className="py-2">
              <span className="inline-flex items-center gap-1.5">
                <Bot className="size-4 text-marca-600" aria-hidden />
                Chatbot (el cliente)
              </span>
            </td>
            <td className="py-2 text-right tabular-nums">{chatbot.pedidos}</td>
            <td className="py-2 text-right font-semibold tabular-nums">{pesos(chatbot.total)}</td>
            <td className="hidden py-2 text-right tabular-nums sm:table-cell">{pesos(Math.round(chatbot.total / chatbot.pedidos))}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Repartidores({ datos }: { datos: Reporte }) {
  const { repartidores } = datos.personal;
  if (repartidores.length === 0) return <Vacio>No hubo domicilios entregados en este período</Vacio>;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-stone-500">
        <tr>
          <th className="pb-1 text-left font-medium">Repartidor</th>
          <th className="pb-1 text-right font-medium">Entregas</th>
          <th className="pb-1 text-right font-medium">Vendido</th>
          <th className="pb-1 text-right font-medium" title="Desde que toma el domicilio hasta que lo entrega">
            En camino
          </th>
        </tr>
      </thead>
      <tbody>
        {repartidores.map((r) => (
          <tr key={r.id} className="border-t border-stone-100">
            <td className="py-2 font-medium">{r.nombre}</td>
            <td className="py-2 text-right tabular-nums">{r.entregas}</td>
            <td className="py-2 text-right font-semibold tabular-nums">{pesos(r.total)}</td>
            <td className="py-2 text-right tabular-nums text-stone-600">{textoMinutos(r.minutosEnCamino)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Productos({ datos }: { datos: Reporte }) {
  const max = Math.max(...datos.productos.map((p) => p.total), 1);
  if (datos.productos.length === 0) return <Vacio>No hay productos en el menú</Vacio>;
  return (
    <div>
      <table className="w-full text-sm">
        <thead className="text-xs text-stone-500">
          <tr>
            <th className="w-8 pb-1 text-left font-medium">#</th>
            <th className="pb-1 text-left font-medium">Producto</th>
            <th className="pb-1 text-right font-medium">Unidades</th>
            <th className="pb-1 text-right font-medium">Vendido</th>
            <th className="hidden w-1/4 pb-1 pl-4 text-left font-medium sm:table-cell">Parte de lo vendido</th>
          </tr>
        </thead>
        <tbody>
          {datos.productos.map((p, i) => (
            <tr key={p.productoId} className={`border-t border-stone-100 ${p.cantidad === 0 ? 'text-stone-400' : ''}`}>
              <td className="py-2 tabular-nums text-stone-400">{p.cantidad ? i + 1 : ''}</td>
              <td className="py-2 font-medium">
                {p.nombre}
                {p.cantidad === 0 && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Sin ventas</span>}
              </td>
              <td className="py-2 text-right tabular-nums">{p.cantidad}</td>
              <td className="py-2 text-right font-semibold tabular-nums">{pesos(p.total)}</td>
              <td className="hidden py-2 pl-4 sm:table-cell">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Barra proporcion={p.total / max} />
                  </div>
                  <span className="w-12 text-right text-xs tabular-nums">{p.porcentaje.toLocaleString('es-CO')} %</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** El reporte entero en filas para Excel, por secciones separadas con una fila vacía */
function filasCsv(d: Reporte): Celda[][] {
  const { general, porTipo, limiteMinutos } = d.tiempos;
  return [
    ['Reporte de ventas', `Del ${d.desde} al ${d.hasta}`],
    [],
    ['Resumen'],
    ['Vendido', d.ventas.total],
    ['Pedidos pagados', d.ventas.pedidos],
    ['Promedio por pedido', d.ventas.promedio],
    ['Productos vendidos', d.ventas.platos],
    ['Pedidos cancelados', d.cancelados.pedidos],
    ['Valor cancelado', d.cancelados.total],
    ['Vendido en el período anterior', d.comparacion.anterior.total],
    ['Variación de ventas (%)', d.comparacion.variacionVentas],
    [],
    ['Ventas por día'],
    ['Fecha', 'Pedidos', 'Vendido'],
    ...d.porDia.map((x) => [x.fecha, x.pedidos, x.total]),
    [],
    ['Días de la semana'],
    ['Día', 'Días en el período', 'Pedidos', 'Vendido', 'Promedio por día'],
    ...d.porDiaSemana.map((x) => [DIA_SEMANA[x.diaSemana], x.dias, x.pedidos, x.total, x.promedio]),
    [],
    ['Productos'],
    ['Puesto', 'Producto', 'Unidades', 'Vendido', '% de lo vendido'],
    ...d.productos.map((p, i) => [p.cantidad ? i + 1 : '', p.nombre, p.cantidad, p.total, p.porcentaje]),
    [],
    ['Meseros'],
    ['Mesero', 'Pedidos', 'Vendido', 'Promedio'],
    ...d.personal.meseros.map((m) => [m.nombre, m.pedidos, m.total, m.promedio]),
    ['Chatbot (el cliente)', d.personal.chatbot.pedidos, d.personal.chatbot.total, null],
    [],
    ['Repartidores'],
    ['Repartidor', 'Entregas', 'Vendido', 'Minutos en camino (promedio)'],
    ...d.personal.repartidores.map((r) => [r.nombre, r.entregas, r.total, r.minutosEnCamino]),
    [],
    ['Tiempos de servicio (minutos desde que llega el pedido hasta que se cobra)'],
    ['Tipo', 'Pedidos', 'Minutos promedio', `Más de ${limiteMinutos} min`, `% más de ${limiteMinutos} min`],
    ['Todos', general.pedidos, general.minutosPromedio, general.demorados, general.porcentajeDemorados],
    ...porTipo.map((t) => [NOMBRE_TIPO[t.tipo], t.pedidos, t.minutosPromedio, t.demorados, t.porcentajeDemorados]),
    [],
    ['Ventas por canal'],
    ['Canal', 'Pedidos', 'Vendido'],
    ...d.porCanal.map((c) => [NOMBRE_CANAL[c.canal], c.pedidos, c.total]),
    [],
    ['Ventas por tipo de pedido'],
    ['Tipo', 'Pedidos', 'Vendido'],
    ...d.porTipo.map((t) => [NOMBRE_TIPO[t.tipo], t.pedidos, t.total]),
  ];
}
