-- Supabase publica el esquema "public" con su API de datos y da permisos a los roles
-- anon y authenticated. Este sistema solo entra por el backend, así que se cierra ese acceso.
-- El dueño de las tablas no está sujeto a RLS, por lo que el backend no se ve afectado.

-- Incluye _prisma_migrations, que también queda en "public"
DO $$
DECLARE
  tabla text;
BEGIN
  FOR tabla IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla);
  END LOOP;
END $$;

-- Estos roles solo existen en Supabase: en un PostgreSQL local no se hace nada
DO $$
DECLARE
  rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', rol);
      -- Lo que creen las migraciones futuras nace también sin acceso para estos roles
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', rol);
    END IF;
  END LOOP;
END $$;

-- Las funciones nacen ejecutables por PUBLIC, y los roles anteriores heredarían ese permiso
REVOKE ALL ON FUNCTION aplicar_movimiento_inventario() FROM PUBLIC;
REVOKE ALL ON FUNCTION rechazar_cambio_movimiento() FROM PUBLIC;
