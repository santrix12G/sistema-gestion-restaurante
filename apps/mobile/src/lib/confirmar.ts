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

export type MetodoCobro = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

/**
 * Pregunta con qué pagó el cliente. Resuelve null si la persona se devuelve.
 * Android muestra máximo tres botones: para devolverse se toca fuera del aviso.
 */
export function elegirMetodo(titulo: string, mensaje: string): Promise<MetodoCobro | null> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(`${titulo}

${mensaje}

(Se registra en efectivo)`) ? 'EFECTIVO' : null);
  return new Promise((resolver) => {
    const opcion = (text: string, metodo: MetodoCobro) => ({ text, onPress: () => resolver(metodo) });
    const botones = [opcion('Efectivo', 'EFECTIVO'), opcion('Tarjeta', 'TARJETA'), opcion('Transferencia', 'TRANSFERENCIA')];
    Alert.alert(titulo, mensaje, Platform.OS === 'ios' ? [...botones, { text: 'Volver', style: 'cancel' as const, onPress: () => resolver(null) }] : botones, {
      cancelable: true,
      onDismiss: () => resolver(null),
    });
  });
}
