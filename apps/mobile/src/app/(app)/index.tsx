import { Redirect } from 'expo-router';
import { useUsuario } from '@/lib/sesion';

/** Pantalla inicial de cada rol después de iniciar sesión */
export default function Inicio() {
  const usuario = useUsuario();
  if (!usuario) return null;
  return <Redirect href={usuario.rol === 'REPARTIDOR' ? '/domicilios' : '/pedidos'} />;
}
