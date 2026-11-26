# Guía para sustentar el proyecto

Para cada punto del checklist: **qué decir** (en una o dos frases), **qué abrir** (archivo y línea), **qué mostrar** y **la pregunta que probablemente te hagan**. Las rutas son desde la raíz del repositorio.

> Revisado el 24/11/2026 sobre la rama `usuarios-prueba`. `npm test` en `apps/api`: **16 suites, 157 pruebas, todas pasan** (antes hubo que correr `npx prisma generate`; si en clase falla con `sesionesDesde does not exist`, es eso).

---

## 0. La idea que amarra todo (dila al inicio, 1 minuto)

"Es un **monolito modular** en NestJS. Cada módulo (pedidos, chatbot, pagos, caja, identidad...) tiene tres capas:
`domain/` con reglas puras, `application/` con los casos de uso y `infrastructure/` con lo que habla con el mundo (HTTP, Prisma, WhatsApp, MercadoPago).
Los módulos no se llaman entre sí para avisar cosas: publican eventos en un bus. Así pedidos no sabe que existen el chatbot ni la web."

Dibújalo así si te piden un diagrama:

```
Web (Next.js) ─┐                         ┌─ Meta / Twilio / Telegram
App (Expo) ────┼─ REST + Socket.IO ─► API NestJS ◄─ webhooks ─┤
               │                         │                    └─ MercadoPago
               │     controller → caso de uso → dominio
               │                    │
               │               puerto (interfaz) → Prisma → PostgreSQL (Supabase)
               │                    │
               └──── gateway ◄── bus de eventos (pedido.creado, en_camino...)
```

---

## ARQUITECTURA

### 1. Web app para administrador y meseros
- **Decir:** Next.js. Login, y un panel cuyo menú cambia según el rol.
- **Abrir:** `apps/web/src/app/login/page.tsx` → `apps/web/src/lib/sesion.tsx` (guarda el token) → `apps/web/src/app/(panel)/layout.tsx` (menú por rol).
- **Mostrar:** entrar con un admin y luego con un mesero: el mesero no ve Personal ni Estadísticas.
- **Pregunta:** *¿Cómo protegen las pantallas?* El menú solo oculta; la protección real está en la API con `@Roles` (punto 5). Aunque alguien escriba la URL, la API responde 403.

### 2. App móvil para repartidores (y meseros)
- **Decir:** Expo / React Native, misma API que la web. El token se guarda cifrado en el teléfono.
- **Abrir:** `apps/mobile/src/app/login.tsx`, `apps/mobile/src/lib/sesion.tsx`, `apps/mobile/src/app/(app)/_layout.tsx` (pestañas por rol), `apps/mobile/src/app/(app)/domicilios.tsx`.
- **Mostrar:** repartidor pulsa "Llevar domicilio" → `POST /api/pedidos/:id/tomar` → en la web aparece el repartidor sin recargar.
- **Pregunta:** *¿Por qué no hay app para clientes?* → punto 3.

### 3. App móvil para clientes — **NO HECHO**
- **Decir con honestidad:** "Decidimos que el cliente pida por WhatsApp/Telegram: no tiene que instalar nada. La app móvil es solo para el personal." Si quieren justificación de negocio: en un restaurante pequeño casi nadie instala una app para pedir; todos tienen WhatsApp.

### 4. Chatbot de WhatsApp
- **Decir:** el flujo es webhook (6) → procesar mensaje (13) → NLP (11) → diálogo → emisor (7). Telegram entra por el mismo caso de uso.
- **Abrir:** carpeta `apps/api/src/modules/chatbot/` y mostrar las tres capas.
- **Mostrar:** en Telegram (lo más fácil en vivo) escribir "2 hamburguesas y una limonada", luego "listo", la dirección, "sí". Al confirmar, el pedido aparece en la web.

### 5. Controladores REST API
- **Decir:** el controlador solo valida y delega; no tiene lógica de negocio.
- **Abrir:** `apps/api/src/modules/pedidos/infrastructure/pedidos.controller.ts`:
  - línea 89 `GET pedidos`, 104 `POST pedidos` con `@Roles('ADMIN','MESERO')` en 103,
  - 110 `PATCH pedidos/:id/estado`, 117 `POST pedidos/:id/tomar` con `@Roles('REPARTIDOR')`.
- Todos los módulos se registran en `apps/api/src/app.module.ts`.
- **Pregunta:** *¿Cómo se valida el token?* Un guard global revisa el JWT; lo que tiene `@Publico()` (login, webhooks) no lo exige.

### 6. Webhook de WhatsApp (recibir)
- **Abrir:** `apps/api/src/modules/chatbot/infrastructure/webhook-whatsapp.controller.ts`
  - línea 56: `GET` de verificación (Meta manda un `hub.challenge` y se devuelve si el token coincide).
  - línea 64-80: `POST`. Valida la firma (`firmaValida`, línea 83): HMAC SHA-256 del cuerpo con el secreto de la app. Si no coincide → 403.
  - Responde 200 de una vez y procesa después con `setImmediate`, porque Meta reintenta si tardas.
- **Pregunta:** *¿Por qué `timingSafeEqual`?* Para que no se pueda adivinar la firma midiendo cuánto tarda la comparación.

### 7. Cliente de Meta / Twilio (enviar)
- **Abrir:** `apps/api/src/modules/chatbot/infrastructure/emisores.ts`: `EmisorSimulado` (l.7), `EmisorMeta` (l.13), `EmisorTwilio` (l.64), `partirTexto` (l.41, corta mensajes largos a 1600 caracteres).
- **Cuál se usa:** `chatbot.module.ts` línea 38, según `WHATSAPP_PROVIDER` del `.env`.
- **Concepto clave:** **puerto y adaptador**. El caso de uso solo conoce la interfaz `EmisorWhatsApp`; cambiar de Meta a Twilio es cambiar una variable, no código.

### 8. Repositorios con ORM (Prisma)
- **Abrir:** `apps/api/src/modules/pedidos/application/pedido.repository.ts` (la interfaz, el "puerto", `PEDIDO_REPOSITORY` l.72) → `pedidos.module.ts` línea 27: `{ provide: PEDIDO_REPOSITORY, useClass: PrismaPedidoRepository }` → `infrastructure/prisma-pedido.repository.ts`.
- **Decir:** "El caso de uso pide un `PedidoRepository`, NestJS le inyecta el de Prisma. Si mañana cambiamos de ORM, el caso de uso no se toca." (Inversión de dependencias, la D de SOLID.)

### 9. Gateway de WebSockets
- **Abrir:** `apps/api/src/modules/tiempo-real/tiempo-real.gateway.ts`
  - l.26-40: se suscribe a 4 eventos del bus y emite `'pedido'` a la sala del personal.
  - l.42: `handleConnection` verifica el token; sin sesión válida desconecta.
- **Lado web:** `apps/web/src/lib/tiempo-real.ts` l.19-20 (`io(...)` y `socket.on('pedido', ...)`), usado en `pedidos/page.tsx` l.63.
- **Mostrar:** dos ventanas abiertas; crear un pedido en una y verlo aparecer en la otra.

### 10. Pagos con MercadoPago
- **Flujo (dilo en este orden):**
  1. Cliente elige "en línea" → `procesar-mensaje.use-case.ts` l.182 `textoEnlacePago`.
  2. `pagos/application/crear-enlace-pago.use-case.ts` l.37: registra el pago PENDIENTE y pide el enlace.
  3. `pagos/infrastructure/mercadopago.pasarela.ts` l.38 `crearEnlace`.
  4. MercadoPago avisa a `webhook-mercadopago.controller.ts` l.31, que valida la firma (`firma-mercadopago.ts` l.42).
  5. `procesar-notificacion.use-case.ts` l.29 **consulta el estado real** en MercadoPago (no confía en el aviso).
  6. `pagos/domain/pago.ts` l.54 `decidirCambio`: no aprueba si el monto o la moneda no coinciden, un aprobado solo pasa a reembolsado.
  7. Publica `pago.estado_cambiado` (l.43) → el cliente recibe "Recibimos tu pago" y la web muestra "Pagado en línea".
- **Pregunta:** *¿Y si alguien falsifica el webhook?* Firma inválida → rechazado; y aunque pasara, se vuelve a consultar el pago en MercadoPago y se compara el monto.
- Detalle en `docs/pagos.md`.

### 11. Motor NLP (LLM con herramientas + reglas de respaldo)
- **Decir:** "Un LLM (Groq gratis, Claude u OpenAI, se elige con `NLP_PROVIDER`) atiende la conversación y responde preguntas libres. Pero no toca el dinero: para cambiar el pedido llama a herramientas del código, que validan contra el menú real."
- **Abrir:**
  - `apps/api/src/modules/chatbot/domain/agente.ts`: `HERRAMIENTAS` (l.56) y `SesionAgente` (l.166). Muestra `confirmar` (l.316): no deja confirmar si el cliente no vio el resumen (l.320).
  - `infrastructure/agente-claude.ts` `responder` (l.34): el bucle de herramientas. `infrastructure/agente-openai.ts` y `agente-chat-completions.ts` (Groq) hacen lo mismo con OpenAI y con Groq.
  - `application/procesar-mensaje.use-case.ts` l.108-121: primero el LLM; si devuelve `null`, responden las reglas (`MotorReglas` + `dialogo.ts`).
- **Pregunta:** *¿Y si el modelo inventa un precio?* No puede: el precio sale del menú en `agregar_productos`, y el resumen con el total lo escribe el código (`mostrar_resumen`).
- **Pregunta:** *¿Y si el LLM se cae?* Ese mensaje lo responden las reglas desde el mismo paso. Se ve en la columna `intencion` del mensaje (`llm` o la intención de las reglas).

### 12. Caso de uso: crear pedido
- **Abrir:** `apps/api/src/modules/pedidos/application/crear-pedido.use-case.ts` l.33-63:
  1. Idempotencia (l.34): si ya existe un pedido con esa clave, lo devuelve (doble clic no duplica).
  2. Mesa activa o cliente por teléfono (l.41-49).
  3. `armarPedido`: precios reales del catálogo (no confía en el precio que manda el navegador).
  4. Totales con `calcularTotales` en `pedidos/domain/pedido.ts` l.27.
  5. Guarda con el repositorio y publica `pedido.creado` (l.62).
- Versión del chatbot: `crear-pedido-cliente.use-case.ts` (publica en l.57).

### 13. Caso de uso: procesar mensaje del chatbot
- **Abrir:** `apps/api/src/modules/chatbot/application/procesar-mensaje.use-case.ts` `procesar()` l.74. Lee los 7 pasos sobre el código:
  1. l.75: descarta repetidos por `waMessageId`.
  2. l.77-82: busca o crea cliente y conversación.
  3. l.87: guarda el mensaje entrante.
  4. l.108: el LLM (`agente.responder`) atiende el mensaje con sus herramientas (punto 11).
  5. l.117-121: si el LLM no respondió, las reglas: `nlp.interpretar` y `responder(...)` de `domain/dialogo.ts`.
  6. l.126: si confirmó, `confirmarPedido` (l.149) crea el pedido y, si es en línea, el enlace.
  7. l.130-134: guarda el paso y envía.
- **Detalle fino que luce:** `ejecutar` (l.69) usa una cola por teléfono, así dos mensajes seguidos del mismo cliente no se procesan a la vez.

### 14. Caso de uso: actualizar estado del pedido
- **Abrir:** `apps/api/src/modules/pedidos/application/actualizar-estado-pedido.use-case.ts` `ejecutar` l.24 y `tomarDomicilio` l.36.
- **Reglas en el dominio:** `pedidos/domain/pedido.ts` `validarCierre` l.56: el admin cierra todo; el mesero solo lo que registró; el domicilio solo el repartidor que lo lleva. `validarTomaDomicilio` l.73: dos repartidores no pueden tomar el mismo.
- **Mostrar:** un mesero intenta cerrar el pedido de otro mesero → mensaje "Este pedido lo registró otro mesero".

### 15. Gestionar inventario — **NO HECHO**
- **Decir:** "El modelo de datos está (Ingrediente, Receta, MovimientoInventario en `schema.prisma`, el seed carga recetas), pero no el módulo. La guía lo marcaba como opcional y priorizamos pagos y caja."
- **Si preguntan cómo lo harían:** un módulo `inventario` que se suscribe a `pedido.estado_cambiado` (PAGADO) y descuenta ingredientes según la receta. Es justo la ventaja del bus: no habría que tocar pedidos.

### 16. Capa de dominio
- **Decir:** "El dominio no importa ni Prisma ni NestJS HTTP; por eso se prueba sin base de datos."
- **Ejemplos:** `pedidos/domain/pedido.ts`, `pagos/domain/pago.ts`, `caja/domain/caja.ts` (`calcularArqueo` l.26), `chatbot/domain/dialogo.ts`. Cada uno con su `.spec.ts`.
- Los errores de negocio son `DomainError` (`shared/domain-error.ts`) y `shared/errores-http.filter.ts` los traduce a 400/403/409.

### 17. Bus de eventos en memoria
- **Abrir:** `apps/api/src/shared/eventos.ts`
  - l.23-31: los 4 eventos, con tipos (TypeScript avisa si publicas datos incorrectos).
  - l.45 `suscribir`, l.50 `publicar`: cada suscriptor corre con `setImmediate` y en try/catch, así un error en el chatbot no rompe la creación del pedido.
- **Limitación honesta (está en el comentario l.38):** si el proceso se reinicia justo después de publicar, el evento se pierde. Eso lo resolvería el outbox + RabbitMQ (punto 20).

### 18. Evento `pedido.creado`
- Se publica en `crear-pedido.use-case.ts` l.62 y `crear-pedido-cliente.use-case.ts` l.57. Lo escucha `tiempo-real.gateway.ts` l.27.

### 19. Evento `pedido.en_camino`
- Se publica en `actualizar-estado-pedido.use-case.ts` l.42. Lo escuchan el gateway (l.33) y `chatbot/application/notificar-cliente.ts` l.44, que escribe "Tu pedido #N va en camino con [repartidor]".
- **Mostrar:** hacer un pedido a domicilio por Telegram, tomarlo desde la app y enseñar el mensaje que llega.

### 20. Colas y workers con RabbitMQ — **NO HECHO**
- **Decir:** "Con un solo servidor, un bus en memoria basta y no añade infraestructura. Dejamos la tabla `EventoOutbox` en el esquema para migrar: se guarda el evento en la misma transacción que el pedido y un worker lo publica en RabbitMQ. Como todos publican por `BusEventos`, solo cambiaría esa clase."

### 21. Base de datos PostgreSQL en Supabase
- **Abrir:** `apps/api/prisma/schema.prisma` y `apps/api/prisma/migrations/` (son **8** migraciones, no 7: la última es `recuperar_contrasena`).
- `shared/prisma.service.ts` se conecta al arrancar con `DATABASE_URL`.
- Comandos: `npm run db:migrate`, `npm run db:seed`.
- **Pregunta:** *¿Integridad?* La migración `reglas_integridad` añade restricciones en la propia base (no solo en el código).

---

## METODOLOGÍA

| # | Estado | Qué decir / mostrar |
|---|---|---|
| 22 | NO HECHO | Falta la entrevista real. Si la hacen antes de entregar, guarden acta con fecha y fotos. Si no, dilo: "los requerimientos se levantaron con un cuestionario base que falta validar en campo". |
| 23 | Hecho | `Levantamiento_Requerimientos.docx`: 20 preguntas, 18 RF, 10 RNF. Ten listo 2 o 3 RF y señala dónde están en el código (ej.: "RF de pedido por WhatsApp" → punto 13). |
| 24 | Hecho | `docs/modelo-er.drawio`, generado por `scripts/generar-er-drawio.mjs` leyendo `schema.prisma`. Ábrelo en draw.io. |
| 25 | **Hecho en tu copia local, sin subir** | Regeneraste el diagrama y ya tiene `cajas` y `movimientos_caja` (antes no). Está en la rama `usuarios-prueba` sin commit. Súbelo a `main` y puedes marcarlo [X]: quedarías 26/31. |
| 26 | Hecho | `cd apps/api && npm test` → 16 suites, 157 pruebas. Abre `pedidos/domain/pedido.spec.ts` y lee un caso en voz alta. |
| 27 | Hecho | `npm run test:e2e`: `test/setup-global.js` levanta un PostgreSQL temporal, migra y prueba la API completa (`api.e2e.ts`, `chatbot.e2e.ts`, `pagos.e2e.ts`, `sesion.e2e.ts`). No toca Supabase. Usa `embedded-postgres` (no necesita Docker), pero la primera vez descarga binarios: córrelo antes de la clase. |
| 28 | NO HECHO | Se puede armar rápido a partir de los e2e: una fila por escenario (ID, precondición, pasos, resultado esperado, resultado obtenido). |
| 29 | Hecho | https://sistema-gestion-restaurante.vercel.app — se publica solo al fusionar en `main`. |
| 30 | Hecho | https://restaurante-api-q0o4.onrender.com — `render.yaml`. *¿Por qué no Vercel?* Vercel es serverless; Socket.IO, los webhooks y el polling de Telegram necesitan un proceso siempre encendido. **Ojo:** el plan gratis de Render se duerme; abre la API 1 minuto antes de la demo. |

## SUGERENCIAS DE CLASE

### 31. Mejorar el diseño
- `apps/web/src/app/(panel)/layout.tsx` (menú lateral, botón en celular), `apps/web/src/components/tarjeta-pedido.tsx`, `components/marca.tsx`, `app/globals.css`.
- **Mostrar:** encoger la ventana a tamaño celular y abrir el menú.

---

## Guion de demo sugerido (8-10 minutos)

1. Abrir la API de Render en el navegador (para despertarla).
2. Web: login como admin → panel → Pedidos (deja esta ventana visible).
3. Telegram: pedir "2 hamburguesas y una limonada", domicilio, confirmar. → La tarjeta aparece sola en la web (puntos 4, 11, 13, 12, 18, 9).
4. App móvil: repartidor → "Llevar domicilio". → En la web sale el repartidor y en Telegram llega "va en camino" (14, 19, 9).
5. Repartidor marca "Pagado". → El cobro entra en la caja (14, caja).
6. Mostrar `npm test` corriendo (26).
7. Abrir el código siguiendo el mismo recorrido: webhook → procesar-mensaje → dialogo → crear-pedido → eventos → gateway.

**Plan B:** si Render, Telegram o internet fallan, corre todo local con `WHATSAPP_PROVIDER=simulado` y muestra los e2e de `chatbot.e2e.ts`, que hacen la misma conversación.

## Preguntas generales que suelen caer

- **¿Qué patrón de arquitectura?** Monolito modular con arquitectura hexagonal (puertos y adaptadores) dentro de cada módulo.
- **¿Por qué monolito y no microservicios?** Equipo de 2, un solo restaurante: los microservicios añaden red, despliegues y consistencia distribuida sin beneficio. Los módulos ya están separados, así que se podrían extraer después.
- **¿Qué pasa si llegan dos mensajes iguales de WhatsApp?** Se descartan por `waMessageId` único (y el error P2002 de Prisma si llegan a la vez).
- **¿Cómo evitan pedidos duplicados?** `claveIdempotencia`.
- **¿Seguridad?** JWT + roles en la API, firmas en todos los webhooks, contraseñas con hash, captcha y recuperación de contraseña (`docs/seguridad-y-accesibilidad.md`).
- **¿Qué falta?** Puntos 3, 15, 20, 22, 28 (y 25 hasta subirlo). Dilo tú antes de que lo pregunten.
