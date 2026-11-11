import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Aviso, Boton, Campo, Cargando, COLOR, estilos, Seccion, Vacio } from '@/components/ui';
import { llamar, mensajeDeError, nuevaClave } from '@/lib/api';
import { avisar } from '@/lib/confirmar';
import { NOMBRE_TIPO_MESA, pesos } from '@/lib/formato';
import { Categoria, Mesa, Pedido, Producto, TipoMesa } from '@/lib/tipos';

const TIPOS_MESA: TipoMesa[] = ['NORMAL', 'LARGA', 'AFUERA'];

type Paso = 'destino' | 'productos' | 'resumen';
type Linea = { cantidad: number; notas: string };

interface Menu {
  categorias: Categoria[];
  productos: Producto[];
  mesas: Mesa[];
}

/** Tomar un pedido en tres pasos: a quién va, qué lleva y revisar antes de registrarlo. */
export default function NuevoPedido() {
  const router = useRouter();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [errorMenu, setErrorMenu] = useState<string | null>(null);

  const [paso, setPaso] = useState<Paso>('destino');
  const [tipo, setTipo] = useState<'MESA' | 'RECOGER'>('MESA');
  const [mesaId, setMesaId] = useState<string | null>(null);
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [lineas, setLineas] = useState<Record<string, Linea>>({});
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Una clave por pedido: si la red falla y se vuelve a enviar, el pedido no queda dos veces
  const clave = useRef(nuevaClave());

  // El menú y las mesas se actualizan cada vez que se abre la pestaña (por si alguien marcó algo agotado)
  useFocusEffect(
    useCallback(() => {
      Promise.all([
        llamar<Categoria[]>('/catalogo/categorias'),
        llamar<Producto[]>('/catalogo/productos'),
        llamar<Mesa[]>('/mesas'),
      ])
        .then(([categorias, productos, mesas]) => {
          setMenu({ categorias: categorias.filter((c) => c.activa), productos, mesas });
          setErrorMenu(null);
        })
        .catch((e) => setErrorMenu(mensajeDeError(e)));
    }, []),
  );

  // El botón atrás de Android vuelve al paso anterior en lugar de salir
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (paso === 'destino') return false;
        setPaso(paso === 'resumen' ? 'productos' : 'destino');
        return true;
      });
      return () => sub.remove();
    }, [paso]),
  );

  const productos = useMemo(() => new Map((menu?.productos ?? []).map((p) => [p.id, p])), [menu]);
  const elegidos = Object.entries(lineas).filter(([, l]) => l.cantidad > 0);
  const total = elegidos.reduce((suma, [id, l]) => suma + (productos.get(id)?.precio ?? 0) * l.cantidad, 0);
  const unidades = elegidos.reduce((suma, [, l]) => suma + l.cantidad, 0);
  const mesa = menu?.mesas.find((m) => m.id === mesaId);

  const destinoListo = tipo === 'MESA' ? !!mesaId : telefono.replace(/\D/g, '').length >= 7;

  function sumar(id: string, cambio: number) {
    setLineas((actual) => {
      const linea = actual[id] ?? { cantidad: 0, notas: '' };
      return { ...actual, [id]: { ...linea, cantidad: Math.max(0, Math.min(50, linea.cantidad + cambio)) } };
    });
  }

  function reiniciar() {
    setPaso('destino');
    setMesaId(null);
    setTelefono('');
    setNombre('');
    setLineas({});
    setNotas('');
    setError(null);
    clave.current = nuevaClave();
  }

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      const pedido = await llamar<Pedido>('/pedidos', {
        metodo: 'POST',
        encabezados: { 'Idempotency-Key': clave.current },
        cuerpo: {
          tipo,
          canal: 'MOVIL',
          ...(tipo === 'MESA' ? { mesaId } : { cliente: { telefono: telefono.trim(), ...(nombre.trim() && { nombre: nombre.trim() }) } }),
          items: elegidos.map(([productoId, l]) => ({ productoId, cantidad: l.cantidad, ...(l.notas.trim() && { notas: l.notas.trim() }) })),
          ...(notas.trim() && { notas: notas.trim() }),
        },
      });
      reiniciar();
      avisar(`Pedido #${pedido.numero} registrado`, 'Ya aparece en tus pedidos activos.');
      router.navigate('/pedidos');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  if (!menu) {
    return (
      <View style={[estilos.pantalla, estilos.contenido]}>
        {errorMenu ? <Aviso>{errorMenu}</Aviso> : <Cargando texto="Cargando el menú…" />}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pasos actual={paso} />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        {paso === 'destino' ? (
          <>
            <View style={estilos.fila}>
              <Opcion activa={tipo === 'MESA'} alPulsar={() => setTipo('MESA')} icono="restaurant-outline" texto="En mesa" />
              <Opcion activa={tipo === 'RECOGER'} alPulsar={() => setTipo('RECOGER')} icono="bag-handle-outline" texto="Para recoger" />
            </View>

            {tipo === 'MESA' ? (
              <>
                <Seccion titulo="Elige la mesa" />
                {menu.mesas.length === 0 ? <Vacio>No hay mesas activas. El administrador debe crearlas.</Vacio> : null}
                {TIPOS_MESA.map((t) => {
                  const delTipo = menu.mesas.filter((m) => m.tipo === t);
                  if (delTipo.length === 0) return null;
                  return (
                    <View key={t} style={{ gap: 6 }}>
                      <Text style={{ color: COLOR.suave, fontSize: 13, fontWeight: '700' }}>{NOMBRE_TIPO_MESA[t]}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {delTipo.map((m) => (
                          <Pressable
                            key={m.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Mesa ${m.codigo}`}
                            accessibilityState={{ selected: mesaId === m.id }}
                            onPress={() => setMesaId(m.id)}
                            style={[estiloMesa.mesa, mesaId === m.id && estiloMesa.elegida]}
                          >
                            <Text style={[estiloMesa.numero, mesaId === m.id && { color: '#fff' }]}>{m.codigo}</Text>
                            <Text style={{ fontSize: 11, color: mesaId === m.id ? '#fff' : COLOR.suave }}>
                              {m.pedidosActivos > 0 ? `${m.pedidosActivos} activo${m.pedidosActivos > 1 ? 's' : ''}` : 'Libre'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </>
            ) : (
              <>
                <Campo etiqueta="Teléfono del cliente" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" placeholder="3001234567" />
                <Campo etiqueta="Nombre (opcional)" value={nombre} onChangeText={setNombre} autoCapitalize="words" />
              </>
            )}
          </>
        ) : null}

        {paso === 'productos'
          ? menu.categorias.map((c) => {
              const deCategoria = menu.productos.filter((p) => p.categoriaId === c.id);
              if (deCategoria.length === 0) return null;
              return (
                <View key={c.id} style={{ gap: 8 }}>
                  <Seccion titulo={c.nombre} />
                  {deCategoria.map((p) => (
                    <FilaProducto
                      key={p.id}
                      producto={p}
                      linea={lineas[p.id]}
                      sumar={(cambio) => sumar(p.id, cambio)}
                      anotar={(texto) => setLineas((a) => ({ ...a, [p.id]: { ...(a[p.id] ?? { cantidad: 0 }), notas: texto } }))}
                    />
                  ))}
                </View>
              );
            })
          : null}

        {paso === 'resumen' ? (
          <>
            <View style={estilos.tarjeta}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLOR.texto }}>
                {tipo === 'MESA' ? `Mesa ${mesa?.codigo ?? ''}` : `Recoger · ${nombre.trim() || telefono}`}
              </Text>
              {elegidos.map(([id, l]) => {
                const p = productos.get(id);
                return (
                  <View key={id} style={[estilos.fila, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={{ fontSize: 15, color: COLOR.texto }}>
                        <Text style={{ fontWeight: '700' }}>{l.cantidad}×</Text> {p?.nombre}
                      </Text>
                      {l.notas.trim() ? <Text style={{ color: COLOR.marcaOscuro, fontSize: 13 }}>{l.notas.trim()}</Text> : null}
                    </View>
                    <Text style={{ color: COLOR.texto }}>{pesos((p?.precio ?? 0) * l.cantidad)}</Text>
                  </View>
                );
              })}
              <View style={[estilos.fila, { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e7e5e4', paddingTop: 8 }]}>
                <Text style={{ color: COLOR.suave }}>Total</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: COLOR.texto }}>{pesos(total)}</Text>
              </View>
            </View>
            <Campo etiqueta="Nota del pedido (opcional)" value={notas} onChangeText={setNotas} placeholder="Ej.: traer los jugos primero" maxLength={300} multiline />
            <Aviso>{error}</Aviso>
          </>
        ) : null}
      </ScrollView>

      {/* Barra fija con el total y el siguiente paso */}
      <View style={estiloBarra.barra}>
        {paso !== 'destino' ? (
          <View style={{ flexGrow: 0 }}>
            <Boton variante="secundario" alPulsar={() => setPaso(paso === 'resumen' ? 'productos' : 'destino')} icono={<Ionicons name="chevron-back" size={18} color={COLOR.texto} />}>
              Atrás
            </Boton>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          {paso === 'destino' ? (
            <Boton alPulsar={() => setPaso('productos')} deshabilitado={!destinoListo}>
              {destinoListo ? 'Elegir productos' : tipo === 'MESA' ? 'Elige una mesa' : 'Escribe el teléfono'}
            </Boton>
          ) : paso === 'productos' ? (
            <Boton alPulsar={() => setPaso('resumen')} deshabilitado={unidades === 0}>
              {unidades === 0 ? 'Agrega productos' : `Revisar · ${unidades} · ${pesos(total)}`}
            </Boton>
          ) : (
            <Boton variante="exito" alPulsar={enviar} ocupado={enviando} icono={<Ionicons name="send" size={18} color="#fff" />}>
              {`Registrar pedido · ${pesos(total)}`}
            </Boton>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Pasos({ actual }: { actual: Paso }) {
  const pasos: [Paso, string][] = [['destino', '1. Destino'], ['productos', '2. Productos'], ['resumen', '3. Revisar']];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e7e5e4' }}>
      {pasos.map(([id, texto]) => (
        <Text
          key={id}
          style={{
            flex: 1,
            textAlign: 'center',
            paddingVertical: 10,
            fontWeight: '700',
            fontSize: 13,
            color: actual === id ? COLOR.marca : COLOR.suave,
            borderBottomWidth: 3,
            borderBottomColor: actual === id ? COLOR.marca : 'transparent',
          }}
        >
          {texto}
        </Text>
      ))}
    </View>
  );
}

function Opcion({ activa, alPulsar, icono, texto }: { activa: boolean; alPulsar: () => void; icono: keyof typeof Ionicons.glyphMap; texto: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: activa }}
      onPress={alPulsar}
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 6,
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: activa ? COLOR.marca : COLOR.borde,
        backgroundColor: activa ? COLOR.marcaSuave : '#fff',
      }}
    >
      <Ionicons name={icono} size={26} color={activa ? COLOR.marca : COLOR.suave} />
      <Text style={{ fontWeight: '700', color: activa ? COLOR.marcaOscuro : COLOR.texto }}>{texto}</Text>
    </Pressable>
  );
}

function FilaProducto({ producto, linea, sumar, anotar }: { producto: Producto; linea?: Linea; sumar: (cambio: number) => void; anotar: (texto: string) => void }) {
  const cantidad = linea?.cantidad ?? 0;
  const agotado = !producto.disponible;
  return (
    <View style={[estilos.tarjeta, { gap: 8, opacity: agotado ? 0.55 : 1 }, cantidad > 0 && { borderColor: COLOR.marca }]}>
      <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: COLOR.texto }}>{producto.nombre}</Text>
          <Text style={{ color: agotado ? COLOR.peligro : COLOR.suave }}>{agotado ? 'Agotado' : pesos(producto.precio)}</Text>
        </View>
        {agotado ? null : (
          <View style={estilos.fila}>
            {cantidad > 0 ? (
              <>
                <BotonCantidad icono="remove" etiqueta={`Quitar ${producto.nombre}`} alPulsar={() => sumar(-1)} />
                <Text style={{ minWidth: 24, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLOR.texto }}>{cantidad}</Text>
              </>
            ) : null}
            <BotonCantidad icono="add" etiqueta={`Agregar ${producto.nombre}`} alPulsar={() => sumar(1)} />
          </View>
        )}
      </View>
      {cantidad > 0 ? (
        <TextInput
          value={linea?.notas ?? ''}
          onChangeText={anotar}
          placeholder="Nota (ej.: sin cebolla)"
          placeholderTextColor={COLOR.suave}
          maxLength={200}
          style={[estilos.campo, { minHeight: 40, fontSize: 14 }]}
        />
      ) : null}
    </View>
  );
}

function BotonCantidad({ icono, etiqueta, alPulsar }: { icono: 'add' | 'remove'; etiqueta: string; alPulsar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={alPulsar}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: icono === 'add' ? COLOR.marca : '#fff',
        borderWidth: 1,
        borderColor: icono === 'add' ? COLOR.marca : COLOR.borde,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icono} size={22} color={icono === 'add' ? '#fff' : COLOR.texto} />
    </Pressable>
  );
}

const estiloMesa = {
  mesa: {
    width: 76,
    height: 76,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLOR.borde,
    backgroundColor: '#fff',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 2,
  },
  elegida: { backgroundColor: COLOR.marca, borderColor: COLOR.marca },
  // Cabe AF12 en la casilla
  numero: { fontSize: 21, fontWeight: '800' as const, color: COLOR.texto },
};

const estiloBarra = {
  barra: {
    flexDirection: 'row' as const,
    gap: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e7e5e4',
  },
};
