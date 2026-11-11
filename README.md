# Sistema de gestión de restaurante

Toma de pedidos automatizada por chatbot de WhatsApp y Telegram, con aplicación web para el personal, aplicación móvil para meseros y repartidores, inventario y dashboard de ventas. Se construye como un monolito modular.

Proyecto de Gestión Tecnológica, Universidad de la Amazonia.
Autores: Jean Carlos Jimenez Ortega y Santiago Cuellar Gonzales.

## Avance

| Etapa | Estado |
|---|---|
| 1. Base de datos en Supabase | Lista. Ver [docs/base-de-datos.md](docs/base-de-datos.md) |
| 2. Aplicación web (Next.js + React) | Pedidos en mesa, para recoger y a domicilio, cocina en tiempo real, menú y simulador del chatbot. Ver [docs/arquitectura.md](docs/arquitectura.md) |
| 3. Chatbot de WhatsApp y Telegram | Funciona en Telegram con solo un token. Se conecta a WhatsApp por Twilio (o directo con Meta) y se prueba en la web sin ninguno de los dos. Ver [docs/whatsapp.md](docs/whatsapp.md) |
| 4. Aplicación móvil (React Native) | App Android con Expo para meseros (tomar y entregar pedidos) y repartidores (domicilios). Ver [docs/app-movil.md](docs/app-movil.md) |
| 5. Despliegue | API en Render y web en Vercel, desde `main`. Ver [docs/despliegue.md](docs/despliegue.md) |

## Ejecutarlo

Requiere Node.js 20 o superior. Trabaja en una copia fuera de OneDrive, por ejemplo `C:\dev\restaurante`, porque OneDrive bloquea `node_modules`.

**1. API** (en `apps/api`). Copia `.env.example` como `.env` y completa `DATABASE_URL`, `JWT_SECRET` y las contraseñas del seed. Las variables del chatbot pueden quedar como están: arranca en modo simulado. Luego:

```bash
npm ci
```

```bash
npm run db:migrate
```

```bash
npm run dev
```

La API queda en http://localhost:4000/api.

**2. Web** (en `apps/web`, en otra terminal). Copia `.env.example` como `.env.local`. Luego:

```bash
npm ci
```

```bash
npm run dev
```

Abre http://localhost:3000. Los usuarios son `admin@restaurante.test`, `mesero@restaurante.test`, `cocina@restaurante.test` y `repartidor@restaurante.test`, con las contraseñas que definiste para el seed.

**3. App móvil** (en `apps/mobile`, opcional). Copia `.env.example` como `.env`, corre `npm ci` y `npm start`, y escanea el QR con Expo Go. Los detalles están en [docs/app-movil.md](docs/app-movil.md).

## Qué puede hacer cada rol

| Rol | Pantallas |
|---|---|
| Administrador | Todo, incluido crear y editar productos y probar el chatbot en el simulador |
| Mesero | Tomar pedidos, entregarlos y cancelarlos antes de que entren a cocina, en la web o en la app |
| Cocina | Preparar pedidos y marcar productos agotados (solo en la web) |
| Repartidor | Tomar los domicilios listos, que quedan a su nombre, y marcarlos entregados, en la web o en la app |

## Pruebas

En `apps/api`:

```bash
npm test
```

```bash
npm run test:e2e
```

La primera prueba las reglas de los pedidos y del chatbot. La segunda prueba la API completa contra un PostgreSQL temporal, sin tocar Supabase: incluye conversaciones de WhatsApp firmadas como las de Twilio y Meta, conversaciones de Telegram y los avisos en tiempo real.
