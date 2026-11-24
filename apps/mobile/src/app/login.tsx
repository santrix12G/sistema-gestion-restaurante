import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aviso, Boton, Campo, COLOR, estilos } from '@/components/ui';
import { mensajeDeError, URL_API } from '@/lib/api';

/** La recuperación de contraseña se hace en la web: allí está el captcha y llega el enlace del correo */
const URL_WEB = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/+$/, '');
import { useSesion } from '@/lib/sesion';

export default function Login() {
  const { iniciar } = useSesion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setError(null);
    setEnviando(true);
    try {
      // Al iniciar sesión, la navegación protegida lleva sola a la pantalla del rol
      await iniciar(email, password, recordar);
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: COLOR.marca }}>Restaurante</Text>
            <Text style={{ fontSize: 16, color: COLOR.suave }}>App del personal: meseros y repartidores</Text>
          </View>

          <Campo
            etiqueta="Correo"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            placeholder="mesero@restaurante.test"
          />
          <Campo
            etiqueta="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={entrar}
            returnKeyType="go"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 16, color: COLOR.texto }} onPress={() => setRecordar(!recordar)}>
              Mantener la sesión iniciada
            </Text>
            <Switch
              value={recordar}
              onValueChange={setRecordar}
              trackColor={{ true: COLOR.marca }}
              accessibilityLabel="Mantener la sesión iniciada"
            />
          </View>
          <Aviso>{error}</Aviso>
          <Boton alPulsar={entrar} ocupado={enviando} deshabilitado={!email || !password}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Boton>
          {enviando ? (
            <Text style={{ color: COLOR.suave, fontSize: 13, textAlign: 'center' }}>
              Si la API estaba dormida, el primer ingreso puede tardar cerca de un minuto.
            </Text>
          ) : null}

          {URL_WEB ? (
            <Pressable onPress={() => void Linking.openURL(`${URL_WEB}/recuperar`)} accessibilityRole="link" hitSlop={8}>
              <Text style={{ color: COLOR.marca, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          ) : null}

          <Text style={{ color: COLOR.suave, fontSize: 12, textAlign: 'center', marginTop: 16 }}>Servidor: {URL_API}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
