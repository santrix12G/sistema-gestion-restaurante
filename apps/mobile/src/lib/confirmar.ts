import { Alert, Platform } from 'react-native';

/** Pide confirmación antes de una acción que no se puede deshacer. */
export function confirmar(titulo: string, mensaje: string, accion: string): Promise<boolean> {
  // Alert con botones no existe en el navegador (solo se usa para pruebas)
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(`${titulo}\n\n${mensaje}`));
  return new Promise((resolver) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Volver', style: 'cancel', onPress: () => resolver(false) },
      { text: accion, style: 'destructive', onPress: () => resolver(true) },
    ], { cancelable: true, onDismiss: () => resolver(false) });
  });
}

/** Muestra un error de una acción */
export function avisar(titulo: string, mensaje: string) {
  if (Platform.OS === 'web') globalThis.alert(`${titulo}\n\n${mensaje}`);
  else Alert.alert(titulo, mensaje);
}
