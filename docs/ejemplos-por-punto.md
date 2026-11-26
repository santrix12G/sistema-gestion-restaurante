# Ejemplos reales por punto del checklist

Cada punto tiene tres partes:

- **Ejemplo real:** una situación del restaurante que el punto resuelve.
- **En el código:** un fragmento copiado del proyecto, con su archivo y línea. Donde se recortó dice `// ...`.
- **Por qué ese archivo:** la justificación de lo que dice `procesos-en-el-codigo.txt`.

Todos los ejemplos usan el mismo caso, así puedes contarlos como una sola historia:

> **Laura** escribe por WhatsApp a las 7:30 p. m.: *"2 hamburguesas con queso, una sin cebolla, y una limonada"*, a domicilio en *Calle 15 # 8-22, barrio Centro*. Total: **$53.000**. Al mismo tiempo, el mesero **Pedro** atiende la **mesa 4**, y el repartidor **Andrés** lleva el domicilio.

(Es el mismo pedido que prueba `apps/api/test/chatbot.e2e.ts:118`. Si te preguntan "¿esto funciona de verdad?", esa prueba lo demuestra.)

---

## ARQUITECTURA

### 1. Web app para administrador y meseros

**Ejemplo real:** Pedro entra a la web desde la tablet del restaurante. Solo ve *Pedidos*, *Nuevo pedido* y *Menú*. La administradora ve además *Caja*, *Mesas*, *Personal* y *Estadísticas*.

**En el código:** `apps/web/src/app/(panel)/layout.tsx:28`

```tsx
{ ruta: '/pedidos', texto: 'Pedidos', icono: ClipboardList, roles: ['ADMIN', 'MESERO', 'REPARTIDOR'] },
{ ruta: '/pedidos/nuevo', texto: 'Nuevo pedido', icono: CirclePlus, roles: ['ADMIN', 'MESERO'] },
{ ruta: '/caja', texto: 'Caja', icono: Wallet, roles: ['ADMIN'] },
// ...
const opciones = g.opciones.filter((o) => o.roles.includes(usuario.rol));   // línea 109
```

y el inicio de sesión, `apps/web/src/lib/sesion.tsx:34`:

```tsx
const sesion = await llamar<Sesion>('/auth/login', { metodo: 'POST', cuerpo: datos });
guardarSesion(sesion, datos.recordar);
```

**Por qué ese archivo:** el `layout.tsx` del grupo `(panel)` envuelve todas las pantallas internas. Por eso ahí se dibuja el menú una sola vez y se filtra por rol.

---

### 2. App móvil para repartidores (y meseros)

**Ejemplo real:** Andrés abre la app en su celular. Solo ve la pestaña *Domicilios*. Pulsa **"Llevar domicilio"** en el pedido de Laura.

**En el código:** las pestañas por rol, `apps/mobile/src/app/(app)/_layout.tsx:42`

```tsx
const rol = useUsuario()?.rol;
const atiendeMesas = rol === 'MESERO' || rol === 'ADMIN';
const reparte = rol === 'REPARTIDOR' || rol === 'ADMIN';
```

el botón llama a la API, `apps/mobile/src/lib/pedidos.ts:92`

```ts
export function tomarDomicilio(pedido: Pedido) {
  return intentar(() => llamar(`/pedidos/${pedido.id}/tomar`, { metodo: 'POST' }));
}
```

y el token se guarda cifrado, `apps/mobile/src/lib/almacen.ts:22`

```ts
await SecureStore.setItemAsync(CLAVE, valor);
```

**Por qué ese archivo:** con Expo Router, `_layout.tsx` define las pestañas; `href: null` oculta las que el rol no usa. `SecureStore` usa el llavero del teléfono (Keychain / Keystore), no texto plano.

---

### 3. App móvil para clientes — NO HECHO

**Ejemplo real:** Laura no instala nada: pide por WhatsApp, que ya tiene.

**En el código (la evidencia de que no existe):** los roles de la base solo son de personal, `apps/api/prisma/schema.prisma:14`

```prisma
enum RolUsuario {
  ADMIN
  MESERO
  REPARTIDOR
}
```

El cliente no es un `Usuario` con contraseña: es un `Cliente` identificado por su teléfono (punto 13, paso 2).

---

### 4. Chatbot de WhatsApp para pedidos automáticos

**Ejemplo real:** la conversación completa de Laura:

(Las respuestas del bot están resumidas; la bienvenida real está en `chatbot/domain/dialogo.ts:82`.)

```
Laura: hola
Bot:   ¡Hola! 👋 Soy el asistente de pedidos del restaurante. ...
Laura: 2 hamburguesas con queso, una sin cebolla, y una limonada
Bot:   (muestra el carrito)
Laura: listo
Bot:   ¿Domicilio o recoger?
Laura: a domicilio
Laura: Calle 15 # 8-22, barrio Centro
Bot:   ... *Total: $53.000* ¿Confirmas?
Laura: sí
Bot:   ✅ ¡Pedido #12 confirmado!
```

**En el código:** esa conversación es literalmente una prueba, `apps/api/test/chatbot.e2e.ts:119`

```ts
expect(await escribir('hola', 'wamid.1')).toMatch(/Bienvenid|Hola/i);
expect(await escribir('2 hamburguesas con queso, una sin cebolla, y una limonada', 'wamid.2')).toMatch(/Hamburguesa con queso/);
expect(await escribir('listo', 'wamid.3')).toMatch(/domicilio/i);
await escribir('a domicilio', 'wamid.4');
expect(await escribir('Calle 15 # 8-22, barrio Centro', 'wamid.5')).toContain('*Total: $53.000*');
expect(await escribir('sí', 'wamid.6')).toMatch(/Pedido \*#\d+\* confirmado/);
```

**Por qué esa carpeta:** `modules/chatbot/` junta las cuatro piezas del flujo: entrada (webhook, punto 6), cerebro (NLP y diálogo, puntos 11 y 13), salida (emisores, punto 7) y avisos al cliente (`notificar-cliente.ts`).

---

### 5. Controladores REST API

**Ejemplo real:** Pedro pulsa "Crear pedido" para la mesa 4. Andrés, en cambio, **no puede** crear pedidos: la API le responde 403 aunque intente llamarla a mano.

**En el código:** `apps/api/src/modules/pedidos/infrastructure/pedidos.controller.ts:103`

```ts
// La web envía una clave por cada intento de crear el pedido: un doble clic no lo duplica
@Roles('ADMIN', 'MESERO')
@Post('pedidos')
crear(@Body() datos: CrearPedidoDto, @Usuario() usuario: UsuarioActual, @Headers('idempotency-key') clave?: string) {
  if (clave !== undefined && !/^[\w-]{8,100}$/.test(clave)) throw new BadRequestException('Idempotency-Key no es válida');
  return this.crearPedido.ejecutar({ ...datos, claveIdempotencia: clave }, usuario);
}

@Roles('REPARTIDOR')
@Post('pedidos/:id/tomar')
tomar(@Param('id', ParseUUIDPipe) id: string, @Usuario() usuario: UsuarioActual) {
  return this.actualizarEstado.tomarDomicilio(id, usuario);
}
```

El token se revisa en todas las rutas por un guard global, `modules/identidad/identidad.module.ts:28`: `{ provide: APP_GUARD, useClass: GuardiaSesion }`.

**Por qué ese archivo:** el controlador está en `infrastructure/` porque es HTTP, es decir, un detalle. Fíjate que tiene **tres líneas por endpoint**: valida y delega al caso de uso. No calcula nada.

---

### 6. Webhook de WhatsApp (recibir mensajes)

**Ejemplo real:** Laura envía su mensaje. Meta lo reenvía a `POST /api/webhooks/whatsapp` con una firma. Si alguien intenta mandar un mensaje falso haciéndose pasar por Meta, recibe **403**.

**En el código:** `apps/api/src/modules/chatbot/infrastructure/webhook-whatsapp.controller.ts:64`

```ts
recibir(@Req() req: RawBodyRequest<Request>, @Body() aviso: AvisoMeta) {
  if (!this.firmaValida(req)) throw new ForbiddenException('Firma inválida');
  // ...
  // Meta espera un 200 rápido; si tarda, reenvía el aviso. Se responde ya y se procesa después
  for (const mensaje of mensajes) {
    setImmediate(() => {
      this.procesar.ejecutar(mensaje).catch(/* ... */);
    });
  }
  return { recibido: true };
}

/** X-Hub-Signature-256 es el HMAC SHA-256 del cuerpo exacto que envió Meta, con el secreto de la app. */
private firmaValida(req: RawBodyRequest<Request>) {
  // ...
  const esperada = `sha256=${createHmac('sha256', this.config.appSecret).update(req.rawBody).digest('hex')}`;
  return iguales(firma, esperada);
}
```

**Por qué ese archivo:** es la puerta de entrada desde Meta. Por eso está en `infrastructure/` y lleva `@Publico()` (Meta no tiene token JWT; se autentica con la firma).

---

### 7. Cliente API de Meta / Twilio (enviar mensajes)

**Ejemplo real:** el bot le responde a Laura "✅ ¡Pedido #12 confirmado!". En producción sale por Meta; en el Sandbox de pruebas, por Twilio; en el computador de desarrollo, por un emisor simulado que no envía nada.

**En el código:** `apps/api/src/modules/chatbot/infrastructure/emisores.ts:17`

```ts
async enviarTexto(telefono: string, texto: string) {
  const url = `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`;
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: telefono, type: 'text',
                           text: { preview_url: false, body: texto } }),
    signal: AbortSignal.timeout(10_000),
  });
```

Cuál se usa lo decide el `.env`, `modules/chatbot/chatbot.module.ts:38`:

```ts
{ provide: EMISOR_WHATSAPP, useFactory: () => crearEmisor() },
```

**Por qué ese archivo:** `EmisorMeta`, `EmisorTwilio` y `EmisorSimulado` implementan la misma interfaz `EmisorWhatsApp`. El caso de uso no sabe cuál recibe (patrón **puerto y adaptador**).

---

### 8. Repositorios con ORM (Prisma)

**Ejemplo real:** Andrés y otro repartidor pulsan "Llevar domicilio" en el pedido de Laura **en el mismo segundo**. Solo uno se lo debe llevar.

**En el código:** el puerto (interfaz) en `apps/api/src/modules/pedidos/application/pedido.repository.ts:52`

```ts
export interface PedidoRepository {
  crear(pedido: NuevoPedido): Promise<PedidoVista>;
  // ...
  /** Asigna el domicilio al repartidor solo si nadie lo ha tomado. Devuelve false si otro lo tomó antes. */
  tomarDomicilio(id: string, repartidorId: string): Promise<boolean>;
}
```

la implementación con Prisma, `pedidos/infrastructure/prisma-pedido.repository.ts:133`

```ts
async tomarDomicilio(id: string, repartidorId: string): Promise<boolean> {
  const { count } = await this.prisma.entrega.updateMany({
    where: { pedidoId: id, repartidorId: null, pedido: { estado: 'ACTIVO' } },
    data: { repartidorId, estado: 'EN_CAMINO', asignadaEn: new Date() },
  });
  return count > 0;
}
```

y la conexión entre los dos, `pedidos/pedidos.module.ts:27`

```ts
{ provide: PEDIDO_REPOSITORY, useClass: PrismaPedidoRepository },
```

**Por qué esos archivos:** el `WHERE repartidorId: null` hace que la base de datos decida quién ganó: el segundo `UPDATE` no encuentra filas y devuelve `false`. El caso de uso solo conoce la interfaz; Prisma queda aislado en `infrastructure/`.

---

### 9. Gateway de WebSockets (tiempo real)

**Ejemplo real:** la administradora tiene la pantalla de Pedidos abierta. Cuando Laura confirma, la tarjeta del pedido #12 **aparece sola**, sin recargar.

**En el código:** el servidor, `apps/api/src/modules/tiempo-real/tiempo-real.gateway.ts:26`

```ts
onModuleInit() {
  this.bus.suscribir('pedido.creado', (e) => {
    this.servidor.to(SALA_PERSONAL).emit('pedido', { ...e, motivo: 'creado' });
  });
  // ... estado_cambiado, en_camino, pago.estado_cambiado
}

async handleConnection(cliente: Socket) {
  const usuario = await this.verificador.verificar(cliente.handshake.auth?.token);
  if (!usuario) { cliente.emit('sesion_invalida'); cliente.disconnect(true); return; }
  await cliente.join(SALA_PERSONAL);
}
```

el navegador, `apps/web/src/lib/tiempo-real.ts:19`

```ts
const socket = io(new URL(URL_API).origin, { auth: { token }, transports: ['websocket'] });
socket.on('pedido', () => alAvisarRef.current());
// Al reconectar pudo haberse perdido algún aviso
socket.io.on('reconnect', () => alAvisarRef.current());
```

**Por qué ese archivo:** el gateway es un módulo aparte que **solo escucha** el bus. Pedidos nunca importa Socket.IO. Además, sin token válido no entras a la sala: un cliente no puede espiar los pedidos.

---

### 10. Cliente de API externa de pagos (MercadoPago)

**Ejemplo real:** Laura escribe "pago en línea". Recibe un enlace de MercadoPago que vence en 30 minutos. Paga $53.000 con PSE, recibe "Recibimos tu pago" y en la web la tarjeta dice "Pagado en línea", así Andrés sabe que no debe cobrarle.

**En el código:** se pide el enlace, `apps/api/src/modules/pagos/infrastructure/mercadopago.pasarela.ts:38`

```ts
const respuesta = await this.llamar('/checkout/preferences', {
  method: 'POST',
  // Si la petición se repite por un corte de red, MercadoPago no crea una segunda preferencia
  headers: { 'X-Idempotency-Key': pagoId },
  body: JSON.stringify({
    items: [{ id: pagoId, title: `Pedido #${numeroPedido}`, quantity: 1, unit_price: monto, currency_id: 'COP' }],
    // Vuelve en cada pago: así se sabe a qué pago del sistema corresponde
    external_reference: pagoId,
    // ...
```

cuando MercadoPago avisa, **se vuelve a consultar** y el dominio decide, `pagos/application/procesar-notificacion.use-case.ts:29`

```ts
async ejecutar(idEnPasarela: string): Promise<ResultadoNotificacion> {
  const informado = await this.pasarela.consultarPago(idEnPasarela);
  // ...
  const decision = decidirCambio(pago, informado);
  if (!decision.cambiar) return this.ignorar(idEnPasarela, decision.motivo);
  if (await this.pagos.cambiarEstado(pago.id, pago.estado, decision.nuevo)) {
    this.bus.publicar('pago.estado_cambiado', { /* ... */ });
```

la regla de negocio, `pagos/domain/pago.ts:64`

```ts
if (nuevo === 'APROBADO') {
  if (informado.moneda !== 'COP') return { cambiar: false, motivo: `Moneda inesperada: ${informado.moneda}` };
  if (Math.round(informado.monto) !== actual.monto) {
    return { cambiar: false, motivo: `El monto pagado (${informado.monto}) no coincide con el del pedido (${actual.monto})` };
  }
}
```

**Por qué esos archivos:** la pasarela es un adaptador (`infrastructure/`); "¿se aprueba este pago?" es una regla del negocio (`domain/`). Si alguien pagara $1.000 en vez de $53.000, el pedido no queda como pagado.

---

### 11. Motor NLP (LLM con herramientas + reglas de respaldo)

**Ejemplo real:** Laura escribe *"¿qué me recomiendas para dos personas? algo sin cebolla"*. El LLM (Claude u OpenAI) le responde con el menú real, y cuando ella dice *"dale, eso"* llama a `agregar_productos`. Laura intenta *"ponme la hamburguesa a $1.000"*: el precio no cambia, porque lo pone el código.

**En el código:** la herramienta que impide confirmar sin que el cliente vea el total, `apps/api/src/modules/chatbot/domain/agente.ts:316`

```ts
private confirmar(): SalidaHerramienta {
  const faltante = this.faltante();
  if (faltante) return falla(faltante);
  // El cliente debe aceptar un resumen que ya vio, sin cambios posteriores: así sabe el total exacto
  if (!this.resumenVisto || this.modificado) {
    return falla('El cliente aún no ha visto el resumen final de este pedido. Llama a mostrar_resumen y espera su respuesta.');
  }
  this.paso = 'CONFIRMACION';
  this.crearPedido = true;
```

el bucle con Claude, `chatbot/infrastructure/agente-claude.ts:73` (con OpenAI, `agente-openai.ts`, es igual):

```ts
const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = usos.map((uso) => {
  const salida = sesion.ejecutar(uso.name, uso.input);
  return { type: 'tool_result', tool_use_id: uso.id, content: salida.texto, is_error: salida.error };
});
```

y el respaldo si el LLM falla, `chatbot/application/procesar-mensaje.use-case.ts:117`

```ts
if (!resultado) {
  const interpretacion = await this.nlp.interpretar(texto, { paso: estado.paso, menu });
  intencion = interpretacion.intencion;
  resultado = responder(estado, interpretacion, texto, menu, this.costoDomicilio, pagoEnLinea);
}
```

Las reglas de respaldo, `apps/api/src/modules/chatbot/domain/nlu-reglas.ts:5`

```ts
const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, /* ... */ docena: 12, par: 2, media: 6,
};
// ...
/**
 * Extrae los productos de un mensaje. Entiende cantidades en número o palabra,
 * y notas como "sin cebolla". "2 hamburguesas, una sin cebolla" queda como 1 normal y 1 sin cebolla.
 */
export function extraerItems(texto: string, buscador: BuscadorProductos): ItemInterpretado[] {
```

**Por qué esos archivos:** las herramientas y las reglas son lógica pura (sin red), por eso van en `domain/` y se prueban en `agente.spec.ts` y `chatbot.spec.ts`. Claude y OpenAI son servicios externos, por eso van en `infrastructure/`, y sus bucles se prueban con respuestas simuladas en `agentes-llm.spec.ts`.

---

### 12. Caso de uso: crear pedido (web y móvil)

**Ejemplo real:** Pedro registra en la mesa 4 "2 bandejas paisas". Por accidente da **doble clic** en "Crear pedido". Además, alguien manipuló el navegador para enviar un precio de $1.

**En el código:** `apps/api/src/modules/pedidos/application/crear-pedido.use-case.ts:33`

```ts
async ejecutar(solicitud: SolicitudPedidoLocal, usuario: UsuarioActual): Promise<PedidoVista> {
  if (solicitud.claveIdempotencia) {
    const existente = await this.pedidos.buscarPorClave(solicitud.claveIdempotencia);
    if (existente) return existente;                       // ← el doble clic devuelve el mismo pedido
  }
  // ...
  if (solicitud.tipo === 'MESA') {
    const mesa = await this.prisma.mesa.findUnique({ where: { id: solicitud.mesaId } });
    if (!mesa?.activa) throw new DomainError('validacion', 'La mesa no existe o no está activa');
  // ...
  const totales = await armarPedido(this.catalogo, solicitud.items);   // ← precios reales del catálogo
  const pedido = await this.pedidos.crear({ /* ... */ ...totales });
  this.bus.publicar('pedido.creado', aEvento(pedido));
  return pedido;
}
```

el cálculo, `pedidos/domain/pedido.ts:27`

```ts
export function calcularTotales(lineas: LineaSolicitada[], costoDomicilio = 0) {
  if (lineas.length === 0) throw new DomainError('validacion', 'El pedido debe tener al menos un producto');
  // ... cantidad entre 1 y 50
  const subtotal = calculadas.reduce((suma, l) => suma + l.subtotal, 0);
  return { lineas: calculadas, subtotal, costoDomicilio, total: subtotal + costoDomicilio };
}
```

**Por qué ese archivo:** el caso de uso **orquesta** (mesa, catálogo, dominio, repositorio, evento). El cálculo vive en el dominio para poder probarlo sin base de datos.

---

### 13. Caso de uso: procesar mensaje del chatbot

**Ejemplo real:** Meta a veces envía **dos veces** el mismo mensaje de Laura. El "sí" no puede crear dos pedidos.

**En el código:** `apps/api/src/modules/chatbot/application/procesar-mensaje.use-case.ts:74` (los 7 pasos)

```ts
private async procesar({ canal = 'WHATSAPP', telefono, texto, idExterno, nombre }: MensajeEntrante) {
  // (1) descarta repetidos
  if (idExterno && (await this.prisma.mensaje.findUnique({ where: { waMessageId: idExterno } }))) return [];
  // (2) cliente y conversación
  const cliente = await this.clientes.obtenerOCrear(telefono, nombre);
  const conversacion = await this.prisma.conversacion.upsert({ /* ... */ });
  // (3) guarda el mensaje
  entrante = await this.prisma.mensaje.create({ /* ... */ });
  // (4) el LLM atiende con sus herramientas (punto 11)
  let resultado = await this.agente.responder({ texto, historial: /* ... */, estado, menu, /* ... */ });
  // (5) si el LLM no respondió, las reglas: NLP + diálogo
  if (!resultado) {
    const interpretacion = await this.nlp.interpretar(texto, { paso: estado.paso, menu });
    resultado = responder(estado, interpretacion, texto, menu, this.costoDomicilio, pagoEnLinea);
  }
  // (6) si confirmó, crea el pedido
  if (crearPedido) ({ paso, contexto, respuestas } = await this.confirmarPedido(canal, cliente.id, contexto, entrante.id));
  // (7) guarda el paso y responde
  await this.prisma.conversacion.update({ /* ... */ data: { paso, contexto } });
  await this.enviar(conversacion.id, destino, respuestas);
}
```

y en `confirmarPedido` (l.149):

```ts
// El mensaje que confirmó es único: si se procesara dos veces, no se duplica el pedido
claveIdempotencia: `chat-${mensajeId}`,
```

**Por qué ese archivo:** es la capa de **aplicación**: coordina base de datos, NLP, dominio y envío, pero las decisiones ("¿qué le pregunto ahora?") las toma `domain/dialogo.ts:132` (`responder`).

---

### 14. Caso de uso: actualizar estado del pedido

**Ejemplo real:** Pedro (mesero) intenta marcar como pagado el domicilio de Laura. El sistema se lo impide: lo cierra Andrés, que es quien lo lleva y cobra.

**En el código:** la regla, `apps/api/src/modules/pedidos/domain/pedido.ts:56`

```ts
export function validarCierre(pedido: PedidoParaPermisos, nuevo: EstadoCierre, rol: Rol, usuarioId: string): void {
  if (pedido.estado !== 'ACTIVO') throw new DomainError('conflicto', `Este pedido ya está ${NOMBRES[pedido.estado]}`);
  if (rol === 'ADMIN') return;
  if (pedido.tipo === 'DOMICILIO') {
    if (rol !== 'REPARTIDOR') throw new DomainError('prohibido', 'Los domicilios los cierra el repartidor que los lleva');
    if (!pedido.repartidorId) throw new DomainError('conflicto', 'Primero toma el domicilio para llevarlo');
    if (pedido.repartidorId !== usuarioId) throw new DomainError('prohibido', 'Este domicilio lo lleva otro repartidor');
    return;
  }
  if (rol !== 'MESERO') throw new DomainError('prohibido', 'Tu rol no puede cerrar pedidos en mesa ni para recoger');
  // ...
  if (pedido.creadoPorId !== usuarioId) throw new DomainError('prohibido', 'Este pedido lo registró otro mesero');
}
```

el caso de uso que la aplica, `pedidos/application/actualizar-estado-pedido.use-case.ts:24`

```ts
const pedido = await this.obtener(id);
validarCierre(paraPermisos(pedido), nuevo, usuario.rol, usuario.id);
// Si dos personas actúan a la vez sobre el mismo pedido, solo gana la primera
if (!(await this.pedidos.cerrar(id, nuevo, usuario.id, metodo))) throw new DomainError('conflicto', 'Otra persona cambió este pedido. Actualiza la pantalla');
this.bus.publicar('pedido.estado_cambiado', { ...aEvento(actualizado), estadoAnterior: pedido.estado });
```

**Por qué esos archivos:** "quién puede cerrar qué" es política del restaurante, así que va en el dominio. Así lo prueba `pedido.spec.ts:37` sin levantar nada.

---

### 15. Caso de uso: gestionar inventario — NO HECHO

**Ejemplo real (lo que haría):** al pagar el pedido de Laura, se descontarían 2 panes, 2 carnes y 1 limón según la receta.

**En el código (lo que sí existe):** la tabla de recetas, `apps/api/prisma/schema.prisma:481`

```prisma
model Receta {
  productoId    String @map("producto_id") @db.Uuid
  ingredienteId String @map("ingrediente_id") @db.Uuid
  cantidad      Int
  // ...
  @@id([productoId, ingredienteId])
  @@map("recetas")
}
```

**Cómo se terminaría:** un módulo `inventario` que haga `bus.suscribir('pedido.estado_cambiado', ...)` y, si el estado es `PAGADO`, descuente según `Receta` y escriba en `MovimientoInventario`. No habría que tocar el módulo de pedidos.

---

### 16. Capa de dominio (entidades y reglas puras)

**Ejemplo real:** al cerrar la noche, la caja abrió con $100.000 de base, se vendieron $480.000 en efectivo, entraron $20.000 y salieron $50.000 para hielo. La cajera cuenta $548.000. Faltan $2.000.

**En el código:** `apps/api/src/modules/caja/domain/caja.ts:26`

```ts
export function calcularArqueo(caja: CajaParaArqueo, efectivoContado?: number | null) {
  // ...
  const entradas = sumarMovimientos('ENTRADA');
  const salidas = sumarMovimientos('SALIDA');
  const enEfectivo = porMetodo.find((m) => m.metodo === 'EFECTIVO')!.total;
  const efectivoEsperado = caja.base + enEfectivo + entradas - salidas;   // 100.000 + 480.000 + 20.000 − 50.000 = 550.000
  // ...
  diferencia: contado === null ? null : contado - efectivoEsperado,       // 548.000 − 550.000 = −2.000
```

**Por qué esa carpeta:** no hay ni un `import` de Prisma ni de HTTP. Es una función: recibe datos y devuelve un resultado. Por eso se prueba en milisegundos (`caja.spec.ts`).

---

### 17. Bus de eventos (en memoria)

**Ejemplo real:** cuando se crea el pedido de Laura pasan tres cosas: la web se actualiza, la app del repartidor también y... nada más. El módulo de pedidos **no sabe** quién está escuchando.

**En el código:** `apps/api/src/shared/eventos.ts:45`

```ts
suscribir<K extends keyof EventosDominio>(nombre: K, manejador: Manejador<EventosDominio[K]>) {
  this.manejadores.set(nombre, [...(this.manejadores.get(nombre) ?? []), manejador as Manejador<never>]);
}

/** No espera a los suscriptores: un error en uno de ellos no afecta a quien publicó. */
publicar<K extends keyof EventosDominio>(nombre: K, evento: EventosDominio[K]) {
  for (const manejador of this.manejadores.get(nombre) ?? []) {
    setImmediate(async () => {
      try { await (manejador as Manejador<EventosDominio[K]>)(evento); }
      catch (e) { this.logger.error(`Falló un suscriptor de ${nombre}`, /* ... */); }
    });
  }
}
```

**Por qué ese archivo:** está en `shared/` porque lo usan todos los módulos. Ejemplo de por qué importa: si WhatsApp está caído y falla el aviso a Laura, el pedido **igual** queda creado, porque el error del suscriptor queda en el `catch`.

---

### 18. Evento de pedido confirmado (`pedido.creado`)

**Ejemplo real:** Laura dice "sí" → aparece la tarjeta #12 en la web.

**En el código:** se publica en `pedidos/application/crear-pedido-cliente.use-case.ts:57`

```ts
this.bus.publicar('pedido.creado', aEvento(pedido));
```

y lo escucha `tiempo-real/tiempo-real.gateway.ts:27`

```ts
this.bus.suscribir('pedido.creado', (e) => {
  this.servidor.to(SALA_PERSONAL).emit('pedido', { ...e, motivo: 'creado' });
});
```

Su forma está tipada en `shared/eventos.ts:24`: `'pedido.creado': PedidoEvento;`.

---

### 19. Evento de pedido listo para entrega (`pedido.en_camino`)

**Ejemplo real:** Andrés pulsa "Llevar domicilio" → a Laura le llega *"🛵 Tu pedido #12 va en camino con Andrés."*

**En el código:** se publica en `pedidos/application/actualizar-estado-pedido.use-case.ts:42`

```ts
this.bus.publicar('pedido.en_camino', { ...aEvento(actualizado), repartidor: usuario.nombre });
```

y lo escucha el chatbot, `chatbot/application/notificar-cliente.ts:44`

```ts
this.bus.suscribir('pedido.en_camino', (e) => this.notificar(e, `🛵 Tu pedido *#${e.numero}* va en camino con ${e.repartidor}.`));
```

Lo comprueba la prueba e2e, `test/chatbot.e2e.ts:148`: `await ultimo(/va en camino con Repartidor/);`

---

### 20. Colas y workers con RabbitMQ — NO HECHO

**Ejemplo real del riesgo:** si el servidor de Render se reinicia justo después de crear el pedido de Laura, el evento en memoria se pierde y la web no se entera hasta la siguiente consulta periódica.

**En el código (lo preparado):** `apps/api/prisma/schema.prisma:518`

```prisma
model EventoOutbox {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  /// Por ejemplo PEDIDO_CONFIRMADO o PEDIDO_LISTO_PARA_ENTREGA
  tipo        String
  payload     Json
  creadoEn    DateTime  @default(now()) @map("creado_en") @db.Timestamptz(3)
  publicadoEn DateTime? @map("publicado_en") @db.Timestamptz(3)
  @@map("eventos_outbox")
}
```

Ningún archivo de `src/` usa `EventoOutbox` (se puede comprobar buscándolo). La limitación está reconocida en el comentario de `shared/eventos.ts:38`.

---

### 21. Base de datos relacional (PostgreSQL en Supabase)

**Ejemplo real:** alguien escribe a mano en la base un teléfono "3001234567" sin el `+57`. La base lo rechaza aunque el código tenga un error.

**En el código:** la conexión, `apps/api/src/shared/prisma.service.ts:5`

```ts
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

y las reglas en la propia base, `apps/api/prisma/migrations/20261030170100_reglas_integridad/migration.sql`

```sql
-- Reglas que Prisma no puede expresar en el esquema.
-- El dominio ya las valida; aquí impiden que un error de programación o un cambio manual guarde datos incoherentes.
ALTER TABLE clientes
  ADD CONSTRAINT clientes_telefono_formato CHECK (telefono ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE productos
  ADD CONSTRAINT productos_precio_no_negativo CHECK (precio >= 0);
```

**Por qué esos archivos:** el esquema (`schema.prisma`) define las tablas; las migraciones (8 carpetas, en orden de fecha) son el historial de cambios que se aplica igual en Supabase, en Render y en las pruebas.

---

## METODOLOGÍA

### 22. Entrevistas y observación — NO HECHO
No hay código que mostrar. **Ejemplo de lo que aportaría:** si en la entrevista el dueño dice "los domicilios los cobra el repartidor", eso justifica la regla `validarCierre` (punto 14). Ahora mismo esa regla sale del cuestionario base, no de una visita.

### 23. Requerimientos funcionales y no funcionales
**Ejemplo de trazabilidad** (lo que más gusta en una sustentación): toma un requerimiento del Word y señala su código.

| Requerimiento (ejemplo) | Dónde se cumple |
|---|---|
| RF: el cliente pide por WhatsApp | `procesar-mensaje.use-case.ts:74` |
| RF: cada rol ve solo sus pedidos | `pedidos/domain/pedido.ts:90` (`alcanceDe`) |
| RNF: el bot responde aunque falle la IA | `procesar-mensaje.use-case.ts:117` |
| RNF: seguridad en los webhooks | `webhook-whatsapp.controller.ts:83` |

(Revisa que los nombres coincidan con los del Word antes de presentarla.)

### 24 y 25. Modelo ER en draw.io (y actualizado)
**Ejemplo real:** agregaron la caja en noviembre; el diagrama del 3 de noviembre no la tenía. En lugar de redibujarlo a mano, se regenera.

**En el código:** `scripts/generar-er-drawio.mjs:1`

```js
// Genera docs/modelo-er.drawio a partir de schema.prisma, para que el diagrama no se desactualice.
// ...
const esquema = readFileSync(join(raiz, 'apps/api/prisma/schema.prisma'), 'utf8');
```

y el cambio que dejaste sin subir:

```js
['Pedido', 'Mesa', 'Pago'],
['Caja', 'MovimientoCaja'],          // ← nuevo: ahora salen cajas y movimientos_caja
```

**Punto 25:** en tu copia local el diagrama ya incluye `cajas` y `movimientos_caja`. Haz commit y fusiónalo en `main` para marcarlo.

### 26. Pruebas unitarias
**Ejemplo real:** "¿cómo sé que un mesero no puede cobrar el pedido de otro?"

**En el código:** `apps/api/src/modules/pedidos/domain/pedido.spec.ts:37`

```ts
it('el mesero cierra solo los pedidos que registró', () => {
  expect(cierra(mesa, 'MESERO', 'mesero-1')).toBeUndefined();
  expect(cierra(mesa, 'MESERO', 'mesero-1', 'CANCELADO')).toBeUndefined();
  expect(cierra(mesa, 'MESERO', 'mesero-2')?.message).toMatch(/otro mesero/);
});
```

Resultado de `npm test` (24/11/2026): **16 suites, 157 pruebas, todas pasan**.

### 27. Pruebas de integración (e2e)
**Ejemplo real:** el pedido de Laura completo, desde el "hola" hasta "entregado", con los permisos de cada rol de por medio.

**En el código:** `apps/api/test/chatbot.e2e.ts:143`

```ts
// El domicilio lo cierra el repartidor que lo lleva, no un mesero
expect((await cambiar('mesero', 'PAGADO')).status).toBe(403);
expect((await cambiar('repartidor', 'PAGADO')).body.mensaje).toMatch(/Primero toma/);
expect((await tomar('mesero')).status).toBe(403);
expect((await tomar('repartidor')).status).toBe(201);
await ultimo(/va en camino con Repartidor/);
expect((await tomar('repartidor')).status).toBe(409);      // ← no se puede tomar dos veces
```

La diferencia con el punto 26: aquí corre la API real con una base PostgreSQL real (temporal, `embedded-postgres`), con HTTP y firmas.

### 28. Casos de prueba en Excel — NO HECHO
**Ejemplo de la primera fila**, sacada del e2e anterior:

| ID | Caso | Precondición | Pasos | Resultado esperado |
|---|---|---|---|---|
| CP-01 | Pedido a domicilio por WhatsApp | Hay hamburguesa y limonada disponibles | 1. "hola" 2. "2 hamburguesas con queso, una sin cebolla, y una limonada" 3. "listo" 4. "a domicilio" 5. dirección 6. "sí" | Pedido creado por $53.000, aparece en la web |
| CP-02 | Mesero no cobra un domicilio | Pedido CP-01 activo | Mesero pulsa "Pagado" | Error 403 |

### 29. Web desplegada en Vercel
**Ejemplo real:** fusionas un cambio en `main` y a los 2 minutos está en https://sistema-gestion-restaurante.vercel.app sin hacer nada. Pasos en `docs/despliegue.md`.

### 30. API desplegada en Render
**Ejemplo real:** Meta necesita una URL pública **siempre encendida** para entregar el mensaje de Laura. Vercel ejecuta funciones que se apagan; Render mantiene el proceso vivo.

**En el código:** `render.yaml:9`

```yaml
rootDir: apps/api
# Las migraciones se aplican antes de compilar; en el plan gratis no hay paso previo al despliegue
buildCommand: npm ci && npm run db:migrate && npm run build
startCommand: npm start
healthCheckPath: /api/salud
autoDeploy: true
```

---

## SUGERENCIAS DE CLASE

### 31. Mejorar el diseño
**Ejemplo real:** Andrés abre la web en el celular: el menú lateral se esconde y aparece un botón ☰.

**En el código:** `apps/web/src/app/(panel)/layout.tsx:78`

```tsx
<header className="sticky top-0 z-20 flex items-center justify-between ... lg:hidden">
  {/* ... */}
  <button aria-label={t('Abrir el menú')}> <Menu className="size-6" aria-hidden /> </button>
// ...
className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col ... lg:translate-x-0 ${ /* abierto ? ... */ }`}
```

`lg:hidden` y `lg:translate-x-0` son clases de Tailwind: en pantallas grandes el menú está fijo; en pequeñas se abre con el botón.

---

## EQUIVALENTES DE LO QUE NO ESTÁ HECHO

Para cada punto pendiente: lo que **sí** hay en el proyecto que cubre esa necesidad, y lo que le falta para cumplirla completa. Dilo así: *"no está como lo pide el checklist, pero la necesidad está cubierta por..."*.

| # | Pedía | Equivalente en el proyecto | Qué cubre | Qué le falta |
|---|---|---|---|---|
| 3 | App móvil para clientes | Chatbot de WhatsApp y Telegram | Que el cliente pida y pague solo, desde el celular | Ver el menú con fotos y el historial de pedidos |
| 15 | Gestionar inventario | Disponible / Agotado por producto | Que no se venda lo que se acabó | Descontar ingredientes por receta y alertar del stock mínimo |
| 20 | Colas y workers con RabbitMQ | Bus en memoria + `ColaPorClave` + consulta periódica | Trabajo asíncrono, orden por cliente, tolerancia a avisos perdidos | Que los eventos sobrevivan a un reinicio y repartir el trabajo entre varios servidores |
| 22 | Entrevistas en un restaurante real | Cuestionario del Word + script de cuentas para pruebas de usabilidad | Las preguntas y la herramienta para probar con personas reales | La visita y su evidencia (acta, fecha, fotos) |
| 28 | Casos de prueba en Excel | 68 escenarios automáticos en los e2e | Los mismos casos, y además se ejecutan solos | El formato de tabla que pide el docente |

---

### 3. App para clientes → el chatbot (WhatsApp y Telegram)

**Ejemplo real:** Laura hace todo lo que haría en una app: ve el menú (escribe *menú*), arma el pedido, da la dirección, paga en línea y recibe avisos ("va en camino", "entregado"). Sin instalar nada.

**En el código:** el cliente se identifica por su teléfono, no con usuario y contraseña, `apps/api/prisma/schema.prisma:165`

```prisma
model Cliente {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nombre         String?
  /// Formato internacional, por ejemplo +573001234567. Identifica al cliente en WhatsApp
  telefono       String   @unique
  /// Chat de Telegram del cliente. Se vincula cuando comparte su número con el bot
  telegramChatId String?  @unique @map("telegram_chat_id")
```

y en Telegram, antes de tomar pedidos, pide el número para saber quién es, `chatbot/application/recibir-telegram.use-case.ts:47`

```ts
const cliente = await this.clientes.buscarPorTelegram(mensaje.chatId);
if (!cliente) {
  await this.telegram.enviarTexto(mensaje.chatId, PEDIR_NUMERO, { pedirContacto: true });
  return;
}
```

| Lo que haría la app del cliente | Dónde lo hace el chatbot |
|---|---|
| Ver el menú | `dialogo.ts:40` (`textoMenu`) |
| Armar el carrito | `dialogo.ts:132` (`responder`, intenciones `agregar` / `quitar`) |
| Pagar en línea | Punto 10 (enlace de MercadoPago) |
| Seguir el pedido | `notificar-cliente.ts:43-45` (avisos de estado, en camino y pago) |

**Argumento:** la app de clientes sería un **canal más**. Como el pedido se crea con `CrearPedidoClienteUseCase`, que no sabe de WhatsApp, una app futura llamaría al mismo caso de uso.

---

### 15. Inventario → disponible / agotado por producto

**Ejemplo real:** a las 9 p. m. se acaba la limonada. La administradora la marca como **Agotado** en *Menú*. Desde ese momento ni Pedro (web) ni Laura (chatbot) pueden pedirla.

**En el código:** el interruptor en la web, `apps/web/src/app/(panel)/menu/page.tsx:23`

```tsx
await llamar(`/catalogo/productos/${p.id}/disponibilidad`, { metodo: 'PATCH', cuerpo: { disponible: !p.disponible } });
// ...
{p.disponible ? t('Disponible') : t('Agotado')}          // línea 80
```

y el bloqueo al vender, que vale para la web y para el chat, `pedidos/application/lineas-pedido.ts:15`

```ts
if (!producto.disponible) throw new DomainError('conflicto', `${producto.nombre} no está disponible en este momento`);
```

Si se agota mientras Laura arma el pedido, el chatbot le responde *"No pude crear el pedido: Limonada natural no está disponible en este momento. Ajusta tu pedido y escribe listo de nuevo"* (`procesar-mensaje.use-case.ts`, `confirmarPedido`).

**Lo que ya está preparado:** las recetas cargadas en `apps/api/prisma/seed.mjs:36`

```js
{ nombre: 'Hamburguesa con queso', precio: 21000, sinonimos: ['cheeseburger'], receta: { 'Pan de hamburguesa': 1, 'Carne de res': 150, Queso: 40 } },
```

y el stock con mínimo, `schema.prisma:467`

```prisma
model Ingrediente {
  nombre      String       @unique
  unidad      UnidadMedida
  /// Puede quedar negativo: refleja una diferencia con el conteo físico, sin frenar las ventas
  stock       Int          @default(0)
  stockMinimo Int          @default(0) @map("stock_minimo")
```

**Argumento:** hoy el inventario es **manual** (alguien marca "agotado"); el checklist pide que sea **automático** (descontar por receta). Los datos ya están; falta el módulo que escuche `pedido.estado_cambiado`.

---

### 20. RabbitMQ → bus en memoria + cola por cliente + consulta periódica

RabbitMQ sirve para tres cosas. El proyecto cubre cada una con algo más simple, que vale mientras haya **un solo servidor**:

| Para qué sirve RabbitMQ | Equivalente | Archivo |
|---|---|---|
| Desacoplar módulos (publicar / suscribir) | `BusEventos` | `apps/api/src/shared/eventos.ts:41` |
| Procesar en orden y sin bloquear | `ColaPorClave` | `apps/api/src/modules/chatbot/application/cola-por-clave.ts` |
| No perder avisos | Consulta periódica de la web y la app | `apps/web/src/lib/hooks.ts:28`, `apps/mobile/src/lib/pedidos.ts:43` |

**Ejemplo real:** Laura escribe muy rápido tres mensajes seguidos: *"2 hamburguesas"*, *"y una limonada"*, *"listo"*. Si se procesaran a la vez, el tercero podría leer el carrito antes de que el segundo agregara la limonada.

**En el código:** una cola por teléfono, `apps/api/src/modules/chatbot/application/cola-por-clave.ts:1`

```ts
/**
 * Ejecuta en orden las tareas de una misma clave. Si un cliente envía tres mensajes seguidos,
 * se procesan uno tras otro y ninguno pisa el estado de la conversación que dejó el anterior.
 * Funciona dentro de un solo proceso; con varios procesos haría falta una cola externa.
 */
export class ColaPorClave {
  private readonly ultimas = new Map<string, Promise<unknown>>();

  ejecutar<T>(clave: string, tarea: () => Promise<T>): Promise<T> {
    const anterior = this.ultimas.get(clave) ?? Promise.resolve();
    const actual = anterior.catch(() => undefined).then(tarea);
    this.ultimas.set(clave, actual);
    // ...
```

usada con la clave `canal:teléfono` en `procesar-mensaje.use-case.ts:71`

```ts
return this.cola.ejecutar(`${canal}:${mensaje.telefono}`, () => this.procesar({ ...mensaje, canal }));
```

El "worker" que no bloquea a quien publica está en `shared/eventos.ts:50`: cada suscriptor corre aparte con `setImmediate`.

**Si se pierde un aviso** (por ejemplo, Render se reinicia), la web vuelve a consultar sola, `apps/web/src/lib/hooks.ts:28`

```ts
const intervalo = setInterval(() => {
  // No consulta mientras la pestaña está oculta
  if (document.visibilityState === 'visible') void recargar();
}, cadaMs);
```

**Argumento:** el propio código dice cuándo deja de servir: *"con varios procesos haría falta una cola externa"*. Ese es el momento de RabbitMQ, y la tabla `EventoOutbox` ya está lista para el patrón outbox.

---

### 22. Entrevistas → cuestionario + pruebas de usabilidad preparadas

**Ejemplo real:** el plan es sentar a 2 meseros, 2 repartidores y 1 administrador de un restaurante real frente al sistema, observar dónde se equivocan y anotar sus respuestas al cuestionario.

**Lo que existe:**
1. El cuestionario: `Levantamiento_Requerimientos.docx`, 20 preguntas (fuera del repositorio).
2. Las cuentas para esa prueba, `apps/api/prisma/usuarios-prueba.mjs:1` (**sin commit todavía**):

```js
// Cuentas para pruebas de usabilidad: 2 meseros, 2 repartidores y 1 administrador.
// Usan la base de DATABASE_URL (apps/api/.env). Cada contraseña es aleatoria y se muestra una sola vez.
//
//   npm run db:usuarios-prueba                          crea las que falten
//   npm run db:usuarios-prueba -- --nuevas-contrasenas  además pone contraseñas nuevas a las que ya existen
//   npm run db:usuarios-prueba -- --quitar              al terminar las pruebas: borra las que no registraron
//                                                       nada y suspende las demás (sus pedidos se conservan)
```

**Argumento honesto:** esto es la **herramienta** para la observación, no la observación. Si alcanzan a hacer la visita, este script la vuelve una sesión de 30 minutos. Guarden acta, fecha, fotos y lo que cambiarían, y el punto queda cubierto.

---

### 28. Excel de casos de prueba → los escenarios e2e

**Ejemplo real:** el docente pregunta "¿qué casos probaron?". La respuesta está escrita y además se ejecuta.

**En el código:** cada `it(...)` es un caso de prueba con nombre en español:

| Archivo | Casos |
|---|---|
| `apps/api/test/api.e2e.ts` | 31 |
| `apps/api/test/chatbot.e2e.ts` | 14 |
| `apps/api/test/pagos.e2e.ts` | 11 |
| `apps/api/test/sesion.e2e.ts` | 12 |
| **Total** | **68** |

Algunos, tal como están en `chatbot.e2e.ts`:

```ts
it('responde la verificación de Meta solo con el token correcto', ...)                     // línea 100
it('rechaza avisos sin firma o con una firma falsa', ...)                                   // línea 109
it('toma un pedido a domicilio de principio a fin y avisa al cliente de cada estado', ...)  // línea 118
it('no procesa dos veces el mismo mensaje cuando Meta lo reenvía', ...)                     // línea 166
it('no acepta el contacto de otra persona', ...)                                            // línea 247
```

**Cómo convertirlo en el Excel:** una fila por `it`. El nombre es el caso, los `expect` son el resultado esperado y `npm run test:e2e` da el resultado obtenido (pasa / falla).

**Argumento:** un Excel se llena a mano una vez; estos casos se vuelven a comprobar en cada cambio.
