-- Reglas que Prisma no puede expresar en el esquema.
-- El dominio ya las valida; aquí impiden que un error de programación o un cambio manual guarde datos incoherentes.

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_email_minusculas CHECK (email = lower(email));

ALTER TABLE clientes
  ADD CONSTRAINT clientes_telefono_formato CHECK (telefono ~ '^\+[1-9][0-9]{7,14}$');

ALTER TABLE productos
  ADD CONSTRAINT productos_precio_no_negativo CHECK (precio >= 0);

ALTER TABLE mesas
  ADD CONSTRAINT mesas_numero_positivo CHECK (numero > 0),
  ADD CONSTRAINT mesas_capacidad_positiva CHECK (capacidad > 0);

ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_montos_no_negativos CHECK (subtotal >= 0 AND costo_domicilio >= 0),
  ADD CONSTRAINT pedidos_total_correcto CHECK (total = subtotal + costo_domicilio),
  ADD CONSTRAINT pedidos_mesa_segun_tipo CHECK ((tipo = 'MESA') = (mesa_id IS NOT NULL)),
  ADD CONSTRAINT pedidos_cliente_si_no_es_mesa CHECK (tipo = 'MESA' OR cliente_id IS NOT NULL),
  ADD CONSTRAINT pedidos_domicilio_segun_tipo CHECK (tipo = 'DOMICILIO' OR costo_domicilio = 0);

ALTER TABLE detalles_pedido
  ADD CONSTRAINT detalles_cantidad_positiva CHECK (cantidad > 0),
  ADD CONSTRAINT detalles_precio_no_negativo CHECK (precio_unitario >= 0),
  ADD CONSTRAINT detalles_subtotal_correcto CHECK (subtotal = precio_unitario * cantidad);

ALTER TABLE pagos
  ADD CONSTRAINT pagos_monto_positivo CHECK (monto > 0),
  ADD CONSTRAINT pagos_proveedor_si_es_online CHECK (metodo = 'EFECTIVO' OR proveedor IS NOT NULL);

ALTER TABLE ingredientes
  ADD CONSTRAINT ingredientes_minimo_no_negativo CHECK (stock_minimo >= 0);

ALTER TABLE recetas
  ADD CONSTRAINT recetas_cantidad_positiva CHECK (cantidad > 0);

ALTER TABLE movimientos_inventario
  ADD CONSTRAINT movimientos_cantidad_no_cero CHECK (cantidad <> 0);

-- Solo se puede pagar una vez: dos pagos aprobados en un pedido serían un cobro doble
CREATE UNIQUE INDEX pagos_un_aprobado_por_pedido ON pagos (pedido_id) WHERE estado = 'APROBADO';

-- Mantiene el stock igual a la suma de sus movimientos, sin depender de que cada caso de uso lo recuerde
CREATE FUNCTION aplicar_movimiento_inventario() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE ingredientes SET stock = stock + NEW.cantidad WHERE id = NEW.ingrediente_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER movimientos_actualizan_stock
  AFTER INSERT ON movimientos_inventario
  FOR EACH ROW EXECUTE FUNCTION aplicar_movimiento_inventario();

-- Los movimientos son un registro contable: se corrigen con otro movimiento, no editándolos
CREATE FUNCTION rechazar_cambio_movimiento() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Los movimientos de inventario no se modifican ni se borran: registra un AJUSTE';
END;
$$;

CREATE TRIGGER movimientos_inmutables
  BEFORE UPDATE OR DELETE ON movimientos_inventario
  FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_movimiento();
