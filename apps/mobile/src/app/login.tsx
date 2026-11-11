import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aviso, Boton, Campo, COLOR, estilos } from '@/components/ui';
import { mensajeDeError, URL_API } from '@/lib/api';
import { useSesion } from '@/lib/sesion';

export default function Login() {
  const { iniciar } = useSesion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setError(null);
    setEnviando(true);
    try {
      // Al iniciar sesión, la navegación protegida lleva sola a la pantalla del rol
      await iniciar(email, password);
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
          <Aviso>{error}</Aviso>
          <Boton alPulsar={entrar} ocupado={enviando} deshabilitado={!email || !password}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Boton>
          {enviando ? (
            <Text style={{ color: COLOR.suave, fontSize: 13, textAlign: 'center' }}>
              Si la API estaba dormida, el primer ingreso puede tardar cerca de un minuto.
            </Text>
          ) : null}

          <Text style={{ color: COLOR.suave, fontSize: 12, textAlign: 'center', marginTop: 16 }}>Servidor: {URL_API}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
