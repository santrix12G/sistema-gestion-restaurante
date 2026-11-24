import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { COLOR } from '@/components/ui';
import { useSesion, useUsuario } from '@/lib/sesion';

function BotonSalir() {
  const { salir } = useSesion();
  const usuario = useUsuario();

  function confirmar() {
    const pregunta = `¿Cerrar la sesión de ${usuario?.nombre ?? 'este usuario'}?`;
    // Alert con botones no existe en el navegador (solo se usa para pruebas)
    if (Platform.OS === 'web') {
      if (globalThis.confirm(pregunta)) salir();
      return;
    }
    Alert.alert('Cerrar sesión', pregunta, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: salir },
    ]);
  }

  return (
    <Pressable onPress={confirmar} accessibilityRole="button" hitSlop={12} style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name="log-out-outline" size={20} color={COLOR.suave} />
      <Text style={{ color: COLOR.suave, fontWeight: '600' }}>Salir</Text>
    </Pressable>
  );
}

/** Abre «Mi cuenta», donde se cambia la contraseña */
function BotonCuenta() {
  return (
    <Pressable onPress={() => router.push('/cuenta')} accessibilityRole="button" accessibilityLabel="Mi cuenta" hitSlop={12} style={{ paddingLeft: 16 }}>
      <Ionicons name="person-circle-outline" size={26} color={COLOR.suave} />
    </Pressable>
  );
}

export default function LayoutApp() {
  const rol = useUsuario()?.rol;
  const atiendeMesas = rol === 'MESERO' || rol === 'ADMIN';
  const reparte = rol === 'REPARTIDOR' || rol === 'ADMIN';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLOR.marca,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        headerTitleStyle: { fontWeight: '800' },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <BotonCuenta />
            <BotonSalir />
          </View>
        ),
        sceneStyle: { backgroundColor: COLOR.fondo },
      }}
    >
      {/* Solo redirige a la pestaña del rol */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: 'Pedidos',
          href: atiendeMesas ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="nuevo"
        options={{
          title: 'Nuevo pedido',
          href: atiendeMesas ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color as string} />,
        }}
      />
      {/* Sin pestaña: se abre con el botón de la cuenta en el encabezado */}
      <Tabs.Screen name="cuenta" options={{ title: 'Mi cuenta', href: null }} />
      <Tabs.Screen
        name="domicilios"
        options={{
          title: 'Domicilios',
          href: reparte ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="bicycle-outline" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
