import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Aviso, Boton, Campo, COLOR } from '@/components/ui';
import { mensajeDeError } from '@/lib/api';
import { useSesion, useUsuario } from '@/lib/sesion';

const NOMBRE_ROL = { ADMIN: 'Administrador', MESERO: 'Mesero', REPARTIDOR: 'Repartidor' } as const;

/** Mis datos y el cambio de la contraseña propia */
export default function MiCuenta() {
  const usuario = useUsuario();
  const { cambiarContrasena } = useSesion();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setListo(false);
    if (nueva !== confirmacion) {
      setError('Las dos contraseñas no coinciden');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await cambiarContrasena(actual, nueva);
      setActual('');
      setNueva('');
      setConfirmacion('');
      setListo(true);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return null;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4, padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e5e4' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: COLOR.texto }}>{usuario.nombre}</Text>
          <Text style={{ fontSize: 16, color: COLOR.suave }}>{usuario.email}</Text>
          <Text style={{ fontSize: 16, color: COLOR.suave }}>{NOMBRE_ROL[usuario.rol]}</Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: '700', color: COLOR.texto, marginTop: 8 }} accessibilityRole="header">
          Cambiar la contraseña
        </Text>
        <Text style={{ fontSize: 15, color: COLOR.suave }}>
          Usa al menos 8 caracteres, con letras y números. Al cambiarla se cierra tu sesión en los demás equipos; en este celular sigues dentro.
        </Text>
        <Campo etiqueta="Contraseña actual" value={actual} onChangeText={setActual} secureTextEntry autoComplete="current-password" textContentType="password" />
        <Campo etiqueta="Contraseña nueva" value={nueva} onChangeText={setNueva} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        <Campo
          etiqueta="Repite la contraseña"
          value={confirmacion}
          onChangeText={setConfirmacion}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={guardar}
          returnKeyType="done"
        />
        <Aviso>{error}</Aviso>
        {listo ? (
          <Text accessibilityLiveRegion="polite" style={{ fontSize: 16, color: '#047857', fontWeight: '600' }}>
            Contraseña actualizada. Se cerró la sesión en los demás equipos.
          </Text>
        ) : null}
        <Boton alPulsar={guardar} ocupado={enviando} deshabilitado={!actual || !nueva || !confirmacion}>
          {enviando ? 'Guardando…' : 'Cambiar la contraseña'}
        </Boton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
