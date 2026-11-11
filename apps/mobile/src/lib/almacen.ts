// Guarda la sesión cifrada en el celular. En el navegador (solo para pruebas) usa localStorage.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CLAVE = 'restaurante.sesion';
const enWeb = Platform.OS === 'web';

export async function leer(): Promise<string | null> {
  try {
    return enWeb ? globalThis.localStorage.getItem(CLAVE) : await SecureStore.getItemAsync(CLAVE);
  } catch {
    return null;
  }
}

export async function escribir(valor: string | null): Promise<void> {
  try {
    if (enWeb) {
      if (valor) globalThis.localStorage.setItem(CLAVE, valor);
      else globalThis.localStorage.removeItem(CLAVE);
    } else if (valor) {
      await SecureStore.setItemAsync(CLAVE, valor);
    } else {
      await SecureStore.deleteItemAsync(CLAVE);
    }
  } catch {
    // Sin almacenamiento: la sesión dura mientras la app esté abierta
  }
}
