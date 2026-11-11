import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { EstadoPedido } from '@/lib/tipos';
import { NOMBRE_ESTADO } from '@/lib/formato';

// Mismos colores que la web
export const COLOR = {
  marca: '#c2410c',
  marcaOscuro: '#9a3412',
  marcaSuave: '#ffedd5',
  fondo: '#f5f5f4',
  tarjeta: '#ffffff',
  texto: '#1c1917',
  suave: '#78716c',
  borde: '#d6d3d1',
  exito: '#059669',
  peligro: '#b91c1c',
  peligroSuave: '#fef2f2',
};

const VARIANTES = {
  primario: { fondo: COLOR.marca, texto: '#fff', borde: COLOR.marca },
  exito: { fondo: COLOR.exito, texto: '#fff', borde: COLOR.exito },
  secundario: { fondo: '#fff', texto: COLOR.texto, borde: COLOR.borde },
  peligro: { fondo: '#fff', texto: COLOR.peligro, borde: '#fecaca' },
};

export function Boton({
  children,
  alPulsar,
  variante = 'primario',
  deshabilitado,
  ocupado,
  icono,
}: {
  children: ReactNode;
  alPulsar: () => void;
  variante?: keyof typeof VARIANTES;
  deshabilitado?: boolean;
  ocupado?: boolean;
  icono?: ReactNode;
}) {
  const v = VARIANTES[variante];
  const inactivo = deshabilitado || ocupado;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: ocupado }}
      disabled={inactivo}
      onPress={alPulsar}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: v.fondo, borderColor: v.borde },
        inactivo && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {ocupado ? <ActivityIndicator color={v.texto} /> : icono}
      <Text style={[estilos.textoBoton, { color: v.texto }]}>{children}</Text>
    </Pressable>
  );
}

export function Campo({ etiqueta, ...props }: TextInputProps & { etiqueta: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor={COLOR.suave} style={estilos.campo} {...props} />
    </View>
  );
}

export function Aviso({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <View accessibilityRole="alert" style={estilos.aviso}>
      <Text style={{ color: COLOR.peligro, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={COLOR.marca} size="large" />
      <Text style={{ color: COLOR.suave }}>{texto}</Text>
    </View>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <View style={estilos.vacio}>
      <Text style={{ color: COLOR.suave, textAlign: 'center' }}>{children}</Text>
    </View>
  );
}

export function Seccion({ titulo, cantidad }: { titulo: string; cantidad?: number }) {
  return (
    <Text style={estilos.seccion}>
      {titulo}
      {cantidad !== undefined ? ` (${cantidad})` : ''}
    </Text>
  );
}

const COLOR_ESTADO: Partial<Record<EstadoPedido, { fondo: string; texto: string }>> = {
  CONFIRMADO: { fondo: '#e7e5e4', texto: '#44403c' },
  EN_PREPARACION: { fondo: '#fef3c7', texto: '#92400e' },
  LISTO: { fondo: '#d1fae5', texto: '#065f46' },
  EN_CAMINO: { fondo: '#dbeafe', texto: '#1e40af' },
};

export function Insignia({ estado }: { estado: EstadoPedido }) {
  const c = COLOR_ESTADO[estado] ?? { fondo: '#e7e5e4', texto: '#44403c' };
  return (
    <View style={[estilos.insignia, { backgroundColor: c.fondo }]}>
      <Text style={{ color: c.texto, fontSize: 12, fontWeight: '700' }}>{NOMBRE_ESTADO[estado]}</Text>
    </View>
  );
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 12, paddingBottom: 32 },
  tarjeta: { backgroundColor: COLOR.tarjeta, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: '#e7e5e4' },
  boton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexGrow: 1,
  },
  textoBoton: { fontSize: 16, fontWeight: '700' },
  etiqueta: { fontSize: 14, fontWeight: '600', color: '#44403c' },
  campo: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLOR.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: COLOR.texto,
  },
  aviso: { backgroundColor: COLOR.peligroSuave, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fecaca' },
  vacio: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLOR.borde, borderRadius: 14, paddingVertical: 32, paddingHorizontal: 16 },
  seccion: { fontSize: 13, fontWeight: '700', color: COLOR.suave, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  insignia: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
