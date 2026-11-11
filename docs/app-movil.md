# App móvil del personal

Aplicación Android para meseros y repartidores, hecha con React Native y Expo (SDK 58). Los clientes no la usan, porque piden por el chatbot, y los cocineros tampoco. La administración del menú sigue en la web.

Usa la misma API, el mismo inicio de sesión y los mismos avisos en tiempo real que la web. El código está en `apps/mobile`.

## Pantallas

| Rol | Pestaña | Qué hace |
|---|---|---|
| Mesero | Pedidos | Sus pedidos activos de mesa y para recoger, para marcarlos pagados o cancelarlos |
| Mesero | Nuevo pedido | En tres pasos: mesa o para recoger (con el teléfono del cliente), productos con notas y revisión. Los agotados no se pueden elegir |
| Repartidor | Domicilios | Arriba, los que lleva él; abajo, los disponibles para llevar (el celular vibra cuando llega uno). Muestra la dirección, el barrio, la referencia, el teléfono y cuánto cobrar. Tiene botones para llamar y abrir el mapa |
| Administrador | Las tres | Además ve los pedidos de otros meseros y del chatbot, y los domicilios que llevan otros repartidores, y puede cerrarlos |

**Reglas:**
- Al pulsar **Llevar domicilio**, el domicilio queda asignado a ese repartidor y el cliente recibe el aviso. Solo él, o un administrador, puede marcarlo entregado y pagado, o cancelarlo.
- Los pedidos creados desde la app se guardan con el canal `MOVIL`, para distinguirlos en los reportes.
- Cada pedido lleva una clave de idempotencia: si la red falla y se reintenta, el pedido no queda dos veces.
- La sesión se guarda cifrada en el celular con `expo-secure-store` y dura 12 horas, un turno.

## Probarla en tu celular

1. Instala **Expo Go** desde Play Store.
2. En `apps/mobile`, copia `.env.example` como `.env` y pon la dirección de la API:

| Variable | Valor |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://TU-API.onrender.com/api`, o `http://IP-DE-TU-PC:4000/api` para la API de tu PC |
| `EXPO_PUBLIC_CIUDAD` | La ciudad que se agrega a la dirección al abrir el mapa, por ejemplo `Florencia, Caquetá` |

Desde el celular, `localhost` es el propio celular, no tu PC. Para usar la API de tu PC, busca su IP con `ipconfig` (la "Dirección IPv4" del Wi-Fi) y conecta el celular a la misma red. Si Windows lo pregunta, permite a Node.js en redes privadas.

3. Instala las dependencias y enciende el servidor de Expo:

```bash
npm ci
```

```bash
npm start
```

4. Escanea el código QR de la terminal con Expo Go.

Si el celular no conecta con tu PC (redes de la universidad o con aislamiento de clientes), usa el túnel de Expo:

```bash
npx expo start --tunnel
```

Si cambias `.env`, reinicia con `npx expo start --clear`.

**Probar en el navegador:** `npm run web` abre la app en el navegador, útil para revisar rápido. Para hacerlo, la dirección `http://localhost:8081` debe estar en `CORS_ORIGINS` de la API.

## Generar el APK

Con una cuenta gratuita de [expo.dev](https://expo.dev):

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest build:configure
```

En el `eas.json` que se crea, agrega al perfil `preview` la opción `"android": { "buildType": "apk" }` y la variable `EXPO_PUBLIC_API_URL` en `"env"`, con la dirección de Render. La app compilada no lee tu `.env` local de la misma forma. Luego:

```bash
npx eas-cli@latest build --platform android --profile preview
```

Al terminar, Expo da un enlace para descargar el APK e instalarlo en los celulares del personal.

## Revisar el código

En `apps/mobile`:

```bash
npm run typecheck
```

```bash
npx expo-doctor
```

## Estructura

```
apps/mobile/src/
  app/                  Pantallas (Expo Router: cada archivo es una ruta)
    _layout.tsx         Sesión y rutas protegidas: sin sesión solo se ve el login
    login.tsx
    (app)/_layout.tsx   Pestañas según el rol
    (app)/pedidos.tsx   Mesero
    (app)/nuevo.tsx     Mesero
    (app)/domicilios.tsx Repartidor
  components/           Botones, tarjetas y estilos
  lib/                  Cliente de la API, sesión, pedidos en tiempo real, formatos
```
