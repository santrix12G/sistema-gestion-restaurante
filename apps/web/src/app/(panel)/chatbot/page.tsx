'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Aviso, Boton, Campo, Titulo } from '@/components/ui';
import { llamar, mensajeDeError } from '@/lib/api';
import { MensajeChat } from '@/lib/tipos';

const EJEMPLOS = ['hola', 'menú', '2 hamburguesas con queso, una sin cebolla, y una limonada', 'listo', 'a domicilio', 'Calle 15 # 8-22, barrio Centro', 'sí'];

/** WhatsApp lo marca con *asteriscos*; aquí se muestra en negrita. */
function TextoWhatsApp({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
        /^\*[^*]+\*$/.test(parte) ? <strong key={i}>{parte.slice(1, -1)}</strong> : <span key={i}>{parte}</span>,
      )}
    </>
  );
}

/**
 * Habla con el bot como si fuera un cliente de WhatsApp. Los pedidos que se confirman aquí son reales:
 * aparecen en Pedidos.
 */
export default function SimuladorChatbot() {
  const [telefono, setTelefono] = useState('3001234567');
  const [nombre, setNombre] = useState('Cliente de prueba');
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();
  const final = useRef<HTMLDivElement>(null);

  async function cargarHistorial(numero = telefono) {
    try {
      const { mensajes } = await llamar<{ mensajes: MensajeChat[] }>(`/chatbot/simulador/${encodeURIComponent(numero)}`);
      setMensajes(mensajes);
      setError(undefined);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  useEffect(() => {
    void cargarHistorial();
    // Solo al abrir la página; al cambiar de número se carga con el botón
  }, []);

  // Entre llaves: en navegadores recientes scrollIntoView devuelve una promesa y React la tomaría como limpieza
  useEffect(() => {
    final.current?.scrollIntoView({ block: 'end' });
  }, [mensajes]);

  async function enviar(contenido: string) {
    const limpio = contenido.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setError(undefined);
    setTexto('');
    // Se muestra de una vez, como en WhatsApp
    setMensajes((m) => [...m, { id: `local-${Date.now()}`, direccion: 'ENTRANTE', texto: limpio, creadoEn: new Date().toISOString() }]);
    try {
      await llamar('/chatbot/simulador', { metodo: 'POST', cuerpo: { telefono, texto: limpio, nombre: nombre.trim() || undefined } });
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      await cargarHistorial();
      setEnviando(false);
    }
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    void enviar(texto);
  }

  return (
    <>
      <Titulo>Simulador de WhatsApp</Titulo>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Campo etiqueta="Celular del cliente" value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" />
          <Campo etiqueta="Nombre en WhatsApp" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Boton variante="secundario" className="w-full" onClick={() => cargarHistorial()}>Ver la conversación de este número</Boton>
          <div>
            <p className="mb-2 text-sm font-medium text-stone-700">Mensajes de ejemplo</p>
            <div className="flex flex-wrap gap-2">
              {EJEMPLOS.map((ejemplo) => (
                <button
                  key={ejemplo}
                  onClick={() => enviar(ejemplo)}
                  disabled={enviando}
                  className="rounded-full bg-white px-3 py-1 text-left text-xs text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50 disabled:text-stone-400"
                >
                  {ejemplo}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-stone-500">
            Los pedidos confirmados aquí son reales y aparecen en Pedidos. Con WhatsApp real conectado (Twilio o Meta), el simulador se desactiva.
          </p>
        </aside>

        <section className="flex h-[70vh] min-h-96 flex-col overflow-hidden rounded-2xl bg-[#efeae2] ring-1 ring-stone-200">
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {mensajes.length === 0 && <p className="py-10 text-center text-sm text-stone-500">Escribe un mensaje para empezar la conversación.</p>}
            {mensajes.map((m) => (
              <div key={m.id} className={`flex ${m.direccion === 'ENTRANTE' ? 'justify-end' : 'justify-start'}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm shadow-sm ${
                    m.direccion === 'ENTRANTE' ? 'bg-[#d9fdd3] text-stone-900' : 'bg-white text-stone-900'
                  }`}
                >
                  <TextoWhatsApp texto={m.texto} />
                </p>
              </div>
            ))}
            {enviando && <p className="text-xs text-stone-500">El bot está escribiendo…</p>}
            <div ref={final} />
          </div>
          {error && <div className="px-4 pb-2"><Aviso>{error}</Aviso></div>}
          <form onSubmit={alEnviar} className="flex gap-2 border-t border-stone-200 bg-stone-50 p-3">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe un mensaje"
              maxLength={1000}
              aria-label="Mensaje"
              className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none focus:border-marca-500"
            />
            <Boton type="submit" disabled={enviando || !texto.trim()}>Enviar</Boton>
          </form>
        </section>
      </div>
    </>
  );
}
