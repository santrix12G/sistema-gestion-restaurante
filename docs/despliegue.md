# Despliegue

| Parte | Servicio | Plan |
|---|---|---|
| API (NestJS) | [Render](https://render.com) | Gratis |
| Web (Next.js) | [Vercel](https://vercel.com) | Gratis (Hobby) |
| Base de datos | Supabase | La misma que ya usas |

Los dos servicios se conectan al repositorio de GitHub y se despliegan solos cada vez que cambia la rama `main`.

**Sobre el plan gratis de Render:** la API se duerme después de 15 minutos sin uso y tarda cerca de un minuto en despertar. La primera petición después de un rato (abrir la web, un mensaje al bot) espera ese minuto; las siguientes son normales. Mientras la pantalla de pedidos esté abierta, la conexión en tiempo real la mantiene despierta.

Las cuentas las creas tú. Puedes entrar a Render y a Vercel con tu cuenta de GitHub.

## Orden

1. API en Render (sin `CORS_ORIGINS` todavía).
2. Web en Vercel, con la dirección de la API.
3. Volver a Render y poner en `CORS_ORIGINS` la dirección de la web.

## 1. API en Render

1. Entra a [dashboard.render.com](https://dashboard.render.com) con tu cuenta de GitHub.
2. **New > Blueprint** y elige el repositorio `sistema-gestion-restaurante`. Si no aparece, dale acceso a Render desde GitHub.
3. Render lee `render.yaml` y propone el servicio `restaurante-api`. Te pedirá los valores marcados como secretos:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La misma de tu `apps/api/.env` (Session pooler de Supabase, puerto 5432) |
| `CORS_ORIGINS` | Déjala vacía por ahora |
| `TELEGRAM_BOT_TOKEN` | El token de @BotFather, o vacío si no usarás Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Una frase secreta sin espacios. Genera una con el comando de abajo |

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

`JWT_SECRET` lo genera Render solo. No es el mismo de tu PC, así que en producción iniciarás sesión aparte.

4. Pulsa **Apply**. La compilación instala, aplica las migraciones pendientes en Supabase y compila. Tarda unos minutos.
5. Cuando diga **Live**, abre `https://restaurante-api.onrender.com/api/salud` (Render te muestra la dirección exacta). Debe responder `{"estado":"ok"}`.

## 2. Web en Vercel

1. Entra a [vercel.com](https://vercel.com) con tu cuenta de GitHub y pulsa **Add New > Project**.
2. Importa `sistema-gestion-restaurante`.
3. En **Root Directory** elige `apps/web`. Vercel reconoce Next.js solo.
4. En **Environment Variables** agrega:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://restaurante-api.onrender.com/api` (la dirección de Render, terminada en `/api`) |

5. Pulsa **Deploy**. Al terminar, Vercel te da una dirección como `https://sistema-gestion-restaurante.vercel.app`.

Si después cambias `NEXT_PUBLIC_API_URL`, vuelve a desplegar en Vercel (**Deployments > Redeploy**): la dirección queda fija al compilar.

## 3. Conectar la web con la API

1. En Render, abre `restaurante-api > Environment`.
2. En `CORS_ORIGINS` pon la dirección de Vercel, sin `/` al final: `https://sistema-gestion-restaurante.vercel.app`. Si son varias, sepáralas con coma.
3. Guarda. Render reinicia la API.

Entra a la dirección de Vercel con `admin@restaurante.test` y la contraseña que definiste en el seed.

## Cuentas para pruebas de usabilidad

Crea 2 meseros, 2 repartidores y 1 administrador de prueba, con contraseñas aleatorias:

```
cd apps/api
npm run db:usuarios-prueba
```

Usa la base de `DATABASE_URL` en `apps/api/.env`. Si es la de Supabase, las cuentas quedan en producción y sirven en la web y en la app. Antes de crear nada, el comando muestra a qué base se conecta.

Las contraseñas se muestran **una sola vez**: anótalas y entrégale a cada participante la suya. Las cuentas usan correos `@pruebas.restaurante.test`, que no existen, así que no reciben el enlace de recuperación.

| Comando | Qué hace |
|---|---|
| `npm run db:usuarios-prueba` | Crea las cuentas que falten. Las que ya existen no cambian |
| `npm run db:usuarios-prueba -- --nuevas-contrasenas` | Pone contraseñas nuevas a todas, cierra sus sesiones y reactiva las suspendidas |
| `npm run db:usuarios-prueba -- --quitar` | Al terminar: borra las cuentas sin registros y suspende las que tomaron pedidos, cobraron o abrieron caja, para conservar esos datos |

Los pedidos, cobros y cajas de las pruebas cuentan en las estadísticas y la caja reales. Si no quieres mezclarlos, haz las pruebas antes de abrir el restaurante o cancela esos pedidos al terminar.

## Telegram en producción

Con `TELEGRAM_WEBHOOK_SECRET`, la API le dice a Telegram al arrancar que le entregue los mensajes en `https://TU-API/api/webhooks/telegram`. Así, un mensaje al bot despierta la API dormida. Verás en los registros de Render: `Bot de Telegram @tu_bot recibe mensajes en …`.

**Importante:** si enciendes la API en tu PC con el mismo token, tu PC le quita el webhook a producción (vuelve al sondeo). Para desarrollar en tu PC, crea otro bot de prueba con @BotFather y usa su token en tu `.env` local. Si ya pasó, reinicia el servicio en Render (**Manual Deploy > Restart**) y vuelve a registrar el webhook.

## WhatsApp en producción

Con la API en Render ya no necesitas ngrok. Usa la dirección de Render en Twilio o Meta, por ejemplo `https://restaurante-api.onrender.com/api/webhooks/twilio`, y agrega las variables de [whatsapp.md](whatsapp.md) en **Environment**.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| La compilación de Render falla en `db:migrate` | `DATABASE_URL` mal copiada, o no es la del Session pooler |
| La web dice "No hay conexión con el servidor" | La API está despertando (espera un minuto), o `NEXT_PUBLIC_API_URL` está mal |
| El navegador muestra un error de CORS | `CORS_ORIGINS` no tiene exactamente la dirección de Vercel |
| Pedidos no se actualiza al instante | Mismo caso de CORS: el tiempo real usa la misma lista |
| El bot de Telegram no responde | Revisa los registros de Render. Si dice `Otra API está recibiendo…`, hay otra copia usando el token |

Los registros están en Render, en **Logs**. Ahí aparece todo lo que la API escribe en la terminal.
