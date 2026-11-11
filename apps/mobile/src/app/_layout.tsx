import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Cargando, COLOR } from '@/components/ui';
import { ProveedorSesion, useSesion } from '@/lib/sesion';

function Navegacion() {
  const { sesion, lista } = useSesion();

  // Mientras se lee la sesión guardada no se decide a qué pantalla ir
  if (!lista) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: COLOR.fondo }}>
        <Cargando />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!sesion}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ProveedorSesion>
        <StatusBar style="dark" />
        <Navegacion />
      </ProveedorSesion>
    </SafeAreaProvider>
  );
}
