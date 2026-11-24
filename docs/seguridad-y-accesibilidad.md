# Seguridad del inicio de sesión y accesibilidad

Qué se agregó, cómo se configura y cómo se compara con los requisitos que el Gobierno de Colombia exige a sus sitios web.

## Qué hay

| Función | Web | App móvil |
|---|---|---|
| Captcha al iniciar sesión | Cloudflare Turnstile (si hay claves) | No: su ruta admite 5 intentos por minuto en vez de 10 |
| Mantener la sesión abierta | Casilla «Mantener la sesión iniciada»: 30 días. Sin marcarla, la sesión dura hasta cerrar el navegador (máximo 12 horas) | Interruptor, encendido por defecto: 30 días guardada cifrada en el celular |
| Recuperar contraseña | «¿Olvidaste tu contraseña?» → enlace por correo, válido 30 minutos y de un solo uso | El mismo enlace abre la página de la web |
| El administrador cambia la contraseña | Personal → Editar → Nueva contraseña | — |
| Contraste alto | Botón en la barra de accesibilidad | Textos secundarios más oscuros (7:1) |
| Tamaño de letra | A− / A+: 100 %, 115 %, 130 % y 150 % | Respeta el tamaño de letra del celular |
| Idioma | Español e inglés | Español |

Al cambiar la contraseña (por el enlace o por el administrador) se cierran todas las sesiones abiertas de esa cuenta.

La recuperación responde lo mismo exista o no la cuenta, para que nadie pueda averiguar qué correos están registrados.

## Configuración

Todo es opcional: sin estas variables la aplicación funciona igual que antes (sin captcha y sin correos).

### 1. Captcha (Cloudflare Turnstile, gratis)

1. Entra a dash.cloudflare.com → **Turnstile** → **Add widget**.
2. Escribe el dominio de la web (por ejemplo `tu-web.vercel.app`; para pruebas en tu PC agrega `localhost`) y elige el modo **Managed**.
3. Cloudflare entrega dos claves:
   - **Site key** → en Vercel, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
   - **Secret key** → en Render, `TURNSTILE_SECRET_KEY`.
4. Vuelve a desplegar la web, porque las variables `NEXT_PUBLIC_*` se leen al compilar.

Pon primero la clave del sitio en la web y después la secreta en la API. Si la API exige captcha y la web todavía no lo muestra, nadie podrá entrar.

> **App móvil:** la app entra por `/auth/login/movil`, que no pide captcha. Si alguien usa un APK anterior a este cambio, deja de poder iniciar sesión cuando configures `TURNSTILE_SECRET_KEY`. Genera un APK nuevo antes:
>
> ```
> npx eas-cli@latest build --platform android --profile preview
> ```

### 2. Correo de recuperación (Brevo, gratis 300 correos al día)

Render en su plan gratis bloquea el envío por SMTP, por eso se usa la API HTTP de Brevo.

1. Crea una cuenta en brevo.com.
2. En **Senders**, agrega y verifica el correo que enviará los mensajes.
3. En **SMTP & API → API Keys**, crea una clave.
4. En Render configura:
   - `BREVO_API_KEY` con la clave de Brevo;
   - `CORREO_REMITENTE` con el correo verificado;
   - `CORREO_NOMBRE_REMITENTE` con el nombre del restaurante;
   - `APP_WEB_URL` con la dirección de la web, por ejemplo `https://tu-web.vercel.app`. Es la base del enlace del correo. Si falta, se usa la primera de `CORS_ORIGINS`.

Sin `BREVO_API_KEY`, en tu PC el enlace aparece en el log de la API, lo que sirve para probar. En producción no se envía nada.

### 3. Web (Vercel)

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Captcha |
| `NEXT_PUBLIC_CONTACTO_CORREO` | Correo de contacto en el pie de página y en las políticas |
| `NEXT_PUBLIC_SITIO_URL` | Dirección pública, para `sitemap.xml` y `robots.txt` |

En el pie también salen el teléfono y la dirección del tiquete (`NEXT_PUBLIC_TIQUETE_TELEFONO`, `NEXT_PUBLIC_TIQUETE_DIRECCION`).

### 4. App móvil

En `apps/mobile/.env` y en `eas.json` (perfil `preview` → `env`), agrega `EXPO_PUBLIC_WEB_URL` con la dirección de la web. Sin ella no aparece «¿Olvidaste tu contraseña?».

### 5. Base de datos

La migración `20261123120000_recuperar_contrasena` crea la tabla `tokens_recuperacion` y la columna `usuarios.sesiones_desde`. Render la aplica sola al desplegar (`prisma migrate deploy`).

## Requisitos del Estado colombiano

La norma es la **Resolución 1519 de 2020 del MinTIC**, que reglamenta la Ley 1712 de 2014 de transparencia. Tiene cuatro anexos:

1. Accesibilidad: WCAG 2.1 nivel AA, en 32 criterios.
2. Publicación de información: barra GOV.CO, menú de transparencia, PQRSD.
3. Seguridad digital.
4. Datos abiertos.

**Solo obliga a las entidades públicas y a quienes manejan recursos o funciones públicas.** Un restaurante privado no está obligado. Aquí se usa como guía de buenas prácticas, y por eso la aplicación **no** usa la barra ni la marca GOV.CO: solo pueden usarlas las entidades del Estado.

### Anexo 1: accesibilidad (WCAG 2.1 AA)

| Criterio | Cómo se cumple |
|---|---|
| CC1 Texto alternativo | Los íconos decorativos llevan `aria-hidden` y los botones con ícono tienen `aria-label` |
| CC4 Ampliación al 200 % sin perder contenido | Todo está en `rem`, la letra sube hasta 150 % y el zoom del navegador funciona |
| CC5–CC6 Contraste mínimo 4,5:1 | Grises de texto oscurecidos y modo de contraste alto (texto negro sobre blanco y enlaces subrayados) |
| CC10 Saltar bloques repetidos | Enlace «Saltar al contenido» al presionar Tab |
| CC12 Más de una forma de llegar | Menú lateral y página «Mapa del sitio» |
| CC17 Foco visible | Contorno grueso en el elemento con foco, más grueso con contraste alto |
| CC19 Límites de tiempo | La sesión dura 12 horas, o 30 días si se pide mantenerla |
| CC23 Títulos de página | Cada página tiene su propio título en la pestaña |
| CC24 Etiquetas en formularios | Todos los campos tienen etiqueta visible |
| CC27 Idioma de la página | `<html lang>` cambia con el idioma elegido |
| CC30 Mensajes de estado | Avisos y errores con `role="status"` / `role="alert"` |
| Declaración de accesibilidad | Página `/accesibilidad` |

### Anexo 2: información mínima

| Exigido a entidades | En esta aplicación |
|---|---|
| Barra superior GOV.CO, pie con escudo | No aplica. Está prohibido para particulares |
| Política de privacidad y tratamiento de datos | `/privacidad` (Ley 1581 de 2012). **Es una plantilla: el negocio debe revisarla y completarla** |
| Términos y condiciones | `/terminos`, también plantilla |
| Datos de contacto en el pie | Correo, teléfono y dirección configurables |
| Mapa del sitio | `/mapa-del-sitio` y `sitemap.xml` |
| Menú «Transparencia y acceso a la información pública» | No aplica: es de entidades públicas |
| Canal PQRSD | No aplica. Los clientes escriben por WhatsApp, Telegram o el correo de contacto |

### Anexo 3: seguridad digital

| Control | Cómo se cumple |
|---|---|
| Captcha o límite de intentos al iniciar sesión | Turnstile en la web, más 10 intentos por minuto (web) y 5 (app) |
| Contraseñas seguras | Al menos 8 caracteres con letras y números, guardadas con bcrypt |
| Recuperación segura | Token aleatorio de 256 bits, se guarda solo su hash SHA-256, vence a los 30 minutos y sirve una sola vez |
| Cierre de sesión e invalidación | Cambiar la contraseña o suspender la cuenta cierra las sesiones abiertas |
| Registro de eventos | La API registra los inicios de sesión exitosos y fallidos, con el correo enmascarado |
| HTTPS y cabeceras de seguridad | Render y Vercel usan HTTPS. La API envía cabeceras con helmet |
| Ocultar páginas administrativas | El panel exige sesión y `robots.txt` lo excluye de los buscadores |
| Mensajes de error genéricos | «Correo o contraseña incorrectos», sin decir cuál falló |
| Validación de entradas | `ValidationPipe` de NestJS rechaza campos desconocidos |

### Anexo 4: datos abiertos

No aplica: un negocio privado no publica datos abiertos.

## Pendientes recomendados

- Revisar los textos de privacidad y términos con quien conozca el negocio.
- Agregar cabeceras de seguridad en la web (Content-Security-Policy). Hoy solo las envía la API.
- Traducir la app móvil, si se necesita.
