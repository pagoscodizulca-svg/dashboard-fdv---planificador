-- ==============================================================================
-- CODIZULCA - AISLAMIENTO MULTISEDE ESTRICTO ('CENTRO' | 'OCCIDENTE')
-- Planificador FDV <-> Dashboard Trade Marketing (Supabase Compartido)
-- 100% Idempotente: seguro de ejecutar en entornos existentes sin pérdida de datos.
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- 1. CATÁLOGO NACIONAL COMPARTIDO DE PRODUCTOS (Única tabla sin delimitación por sucursal)
CREATE TABLE IF NOT EXISTS public.productos (
  id          TEXT PRIMARY KEY,
  codigo      TEXT UNIQUE NOT NULL,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  categoria   TEXT DEFAULT 'GENERAL',
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_activo_nombre ON public.productos (activo, nombre);

-- 2. TABLA DE RUTAS COMERCIALES DELIMITADAS POR SUCURSAL
CREATE TABLE IF NOT EXISTS public.rutas (
  id          TEXT PRIMARY KEY,
  codigo      TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  supervisor  TEXT,
  zona        TEXT,
  sucursal    TEXT NOT NULL CHECK (sucursal IN ('CENTRO', 'OCCIDENTE')),
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rutas_sucursal_activo ON public.rutas (sucursal) WHERE activo = true;

-- 3. TABLA DE VENDEDORES FDV / COORDINACIÓN DELIMITADOS POR SUCURSAL
CREATE TABLE IF NOT EXISTS public.vendedores (
  id            TEXT PRIMARY KEY,
  codigo        TEXT,
  username      TEXT UNIQUE NOT NULL,
  nombre        TEXT NOT NULL,
  password_hash TEXT,
  cedula        TEXT,
  email         TEXT,
  ruta          TEXT,
  supervisor    TEXT,
  role          TEXT NOT NULL DEFAULT 'VENDEDOR'
                CHECK (role IN ('VENDEDOR', 'SUPERVISOR', 'COORDINADORA', 'ADMIN')),
  sucursal      TEXT NOT NULL CHECK (sucursal IN ('CENTRO', 'OCCIDENTE')),
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendedores_sucursal_activo ON public.vendedores (sucursal, username) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_vendedores_sucursal_codigo ON public.vendedores (sucursal, codigo) WHERE activo = true;

-- 4. TABLA DE CLIENTES / TIENDAS DELIMITADOS POR SUCURSAL
CREATE TABLE IF NOT EXISTS public.clientes (
  id              TEXT PRIMARY KEY,
  codigo          TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  rif             TEXT,
  direccion       TEXT,
  ruta            TEXT,
  vendedor_id     TEXT,
  vendedor_nombre TEXT,
  supervisor      TEXT,
  sucursal        TEXT NOT NULL CHECK (sucursal IN ('CENTRO', 'OCCIDENTE')),
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sucursal, codigo)
);

CREATE INDEX IF NOT EXISTS idx_clientes_sucursal_activo ON public.clientes (sucursal, nombre) WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_clientes_sucursal_vendedor ON public.clientes (sucursal, vendedor_id) WHERE activo = true;

-- 5. EVOLUCIÓN DE TABLA DEGUSTACIONES Y TABLAS AUXILIARES CON COLUMNA OBLIGATORIA `sucursal`
ALTER TABLE public.degustaciones
  ADD COLUMN IF NOT EXISTS sucursal TEXT DEFAULT 'OCCIDENTE';

UPDATE public.degustaciones
SET sucursal = 'OCCIDENTE'
WHERE sucursal IS NULL OR sucursal NOT IN ('CENTRO', 'OCCIDENTE');

ALTER TABLE public.degustaciones
  ALTER COLUMN sucursal SET NOT NULL,
  ALTER COLUMN sucursal DROP DEFAULT;

ALTER TABLE public.degustaciones
  DROP CONSTRAINT IF EXISTS degustaciones_sucursal_check;

ALTER TABLE public.degustaciones
  ADD CONSTRAINT degustaciones_sucursal_check CHECK (sucursal IN ('CENTRO', 'OCCIDENTE'));

CREATE INDEX IF NOT EXISTS idx_degustaciones_sucursal_fecha_estado
  ON public.degustaciones (sucursal, fecha DESC, estado);

CREATE INDEX IF NOT EXISTS idx_degustaciones_sucursal_vendedor
  ON public.degustaciones (sucursal, vendedor_id);

-- Evolución opcional de usuarios y trazabilidad si existen en el mismo esquema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios') THEN
    ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS sucursal TEXT NOT NULL DEFAULT 'OCCIDENTE';
    ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_sucursal_check;
    ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_sucursal_check CHECK (sucursal IN ('CENTRO', 'OCCIDENTE'));
    ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
    ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_role_check CHECK (role IN ('ADMIN', 'SUPERVISOR', 'COORDINADORA', 'VENDEDOR'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trazabilidad_login') THEN
    ALTER TABLE public.trazabilidad_login ADD COLUMN IF NOT EXISTS sucursal TEXT CHECK (sucursal IN ('CENTRO', 'OCCIDENTE'));
  END IF;
END $$;

-- 6. TRIGGER DE INTEGRIDAD CRUZADA EN POSTGRESQL (Imposible de evadir incluso con service_role)
CREATE OR REPLACE FUNCTION private.enforce_degustacion_multisede_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_sucursal  TEXT;
  v_vendor_sucursal TEXT;
BEGIN
  IF NEW.sucursal IS NULL OR NEW.sucursal NOT IN ('CENTRO', 'OCCIDENTE') THEN
    RAISE EXCEPTION 'MULTISEDE_INVALID_SUCURSAL: La columna sucursal es obligatoria (CENTRO | OCCIDENTE).'
      USING ERRCODE = '23514';
  END IF;

  IF UPPER(COALESCE(NEW.vendedor_id, '')) = 'ALL_MY_ROUTES' OR UPPER(COALESCE(NEW.ruta, '')) = 'ALL_MY_ROUTES' THEN
    RAISE EXCEPTION 'MULTISEDE_INVALID_ROUTE: No se permite registrar ALL_MY_ROUTES como ruta o vendedor_id.'
      USING ERRCODE = '23514';
  END IF;

  -- Validar correspondencia contra catálogo de clientes/tiendas si el código existe en public.clientes
  IF NEW.cliente_codigo IS NOT NULL AND NEW.cliente_codigo <> '' AND NEW.cliente_codigo <> 'PDV' THEN
    SELECT c.sucursal INTO v_store_sucursal
    FROM public.clientes c
    WHERE c.codigo = NEW.cliente_codigo AND c.activo = true
    ORDER BY (c.sucursal = NEW.sucursal) DESC
    LIMIT 1;

    IF v_store_sucursal IS NOT NULL AND v_store_sucursal <> NEW.sucursal THEN
      RAISE EXCEPTION 'CROSS_BRANCH_STORE_FORBIDDEN: La tienda % pertenece a % y no puede agendarse bajo %.',
        NEW.cliente_codigo, v_store_sucursal, NEW.sucursal
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Validar correspondencia contra ficha del vendedor si existe en public.vendedores
  SELECT v.sucursal INTO v_vendor_sucursal
  FROM public.vendedores v
  WHERE v.activo = true
    AND (
      UPPER(v.id) = UPPER(COALESCE(NEW.vendedor_id, ''))
      OR UPPER(v.codigo) = UPPER(COALESCE(NEW.vendedor_id, ''))
      OR UPPER(v.username) = UPPER(COALESCE(NEW.vendedor_nombre, ''))
      OR UPPER(v.nombre) = UPPER(COALESCE(NEW.vendedor_nombre, ''))
    )
  LIMIT 1;

  IF v_vendor_sucursal IS NOT NULL AND v_vendor_sucursal <> NEW.sucursal THEN
    RAISE EXCEPTION 'VENDOR_SUCURSAL_MISMATCH: El vendedor % pertenece a % y no puede registrar solicitudes en %.',
      NEW.vendedor_nombre, v_vendor_sucursal, NEW.sucursal
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.enforce_degustacion_multisede_integrity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_degustacion_multisede_integrity ON public.degustaciones;
CREATE TRIGGER trg_enforce_degustacion_multisede_integrity
  BEFORE INSERT OR UPDATE ON public.degustaciones
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_degustacion_multisede_integrity();

-- 7. POLÍTICAS ROW LEVEL SECURITY (RLS) ESTRICTAS Y OPTIMIZADAS (app_metadata.sucursal)
ALTER TABLE public.productos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rutas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.degustaciones ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.productos TO anon, authenticated;
GRANT SELECT ON public.rutas, public.vendedores, public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.degustaciones TO authenticated;

-- 7A. Productos: Catálogo Nacional 100% compartido entre CENTRO y OCCIDENTE
DROP POLICY IF EXISTS "productos_national_read" ON public.productos;
CREATE POLICY "productos_national_read" ON public.productos
  FOR SELECT TO anon, authenticated
  USING (activo = true);

-- 7B. Rutas: Aislamiento estricto por sucursal
DROP POLICY IF EXISTS "rutas_select_by_sucursal" ON public.rutas;
CREATE POLICY "rutas_select_by_sucursal" ON public.rutas
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'ADMIN'
    OR sucursal = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'sucursal')
  );

-- 7C. Vendedores FDV: Aislamiento estricto por sucursal
DROP POLICY IF EXISTS "vendedores_select_by_sucursal" ON public.vendedores;
CREATE POLICY "vendedores_select_by_sucursal" ON public.vendedores
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'ADMIN'
    OR sucursal = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'sucursal')
  );

-- 7D. Clientes / Tiendas: Aislamiento estricto por sucursal
DROP POLICY IF EXISTS "clientes_select_by_sucursal" ON public.clientes;
CREATE POLICY "clientes_select_by_sucursal" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'ADMIN'
    OR sucursal = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'sucursal')
  );

-- 7E. Degustaciones: Bandejas aisladas para Coordinadora Centro vs. Coordinadora Occidente y FDV
DROP POLICY IF EXISTS "degustaciones_select_by_vendor_scope" ON public.degustaciones;
DROP POLICY IF EXISTS "degustaciones_select_multisede" ON public.degustaciones;
CREATE POLICY "degustaciones_select_multisede" ON public.degustaciones
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'ADMIN'
    OR (
      sucursal = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'sucursal')
      AND (
        ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('COORDINADORA', 'SUPERVISOR')
        OR vendedor_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'vendor_id')
        OR UPPER(vendedor_nombre) = UPPER(COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'vendor_name', ''))
      )
    )
  );

DROP POLICY IF EXISTS "degustaciones_insert_multisede" ON public.degustaciones;
CREATE POLICY "degustaciones_insert_multisede" ON public.degustaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    sucursal IN ('CENTRO', 'OCCIDENTE')
    AND (
      ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'ADMIN'
      OR sucursal = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'sucursal')
    )
  );

DROP POLICY IF EXISTS "degustaciones_update_multisede" ON public.degustaciones;
CREATE POLICY "degustaciones_update_multisede" ON public.degustaciones
  FOR UPDATE TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'ADMIN'
    OR sucursal = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'sucursal')
  )
  WITH CHECK (
    sucursal IN ('CENTRO', 'OCCIDENTE')
    AND (
      ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'ADMIN'
      OR sucursal = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'sucursal')
    )
  );

NOTIFY pgrst, 'reload schema';
