# Sistema de gestión de restaurante

Toma de pedidos automatizada por chatbot de WhatsApp, con aplicación web para el personal, aplicación móvil para clientes y repartidores, inventario y dashboard de ventas. Se construye como un monolito modular.

Proyecto de Gestión Tecnológica, Universidad de la Amazonia.
Autores: Jean Carlos Jimenez Ortega y Santiago Cuellar Gonzales.

## Avance

| Etapa | Estado |
|---|---|
| 1. Base de datos en Supabase | Lista. Ver [docs/base-de-datos.md](docs/base-de-datos.md) |
| 2. Aplicación web (Next.js + React) | Versión básica: pedidos en mesa y para recoger, cocina y menú. Ver [docs/arquitectura.md](docs/arquitectura.md) |
| 3. Chatbot de WhatsApp | Pendiente |
| 4. Aplicación móvil (React Native) | Pendiente |
| 5. Despliegue | Pendiente |

## Ejecutarlo

Requiere Node.js 20 o superior. Trabaja en una copia fuera de OneDrive, por ejemplo `C:\dev\restaurante`, porque OneDrive bloquea `node_modules`.

**1. API** (en `apps/api`). Copia `.env.example` como `.env` y completa `DATABASE_URL`, `JWT_SECRET` y las contraseñas del seed. Luego:

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

## Qué puede hacer cada rol

| Rol | Pantallas |
|---|---|
| Administrador | Todo, incluido crear y editar productos |
| Mesero | Tomar pedidos, entregarlos y cancelarlos antes de que entren a cocina |
| Cocina | Preparar pedidos y marcar productos agotados |
| Repartidor | Ver pedidos. Sus funciones llegan con los domicilios |

## Pruebas

En `apps/api`:

```bash
npm test
```

```bash
npm run test:e2e
```

La primera prueba las reglas de los pedidos. La segunda prueba la API completa contra un PostgreSQL temporal, sin tocar Supabase.
