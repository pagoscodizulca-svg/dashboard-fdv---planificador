-- ==============================================================================
-- CODIZULCA - CONTRATO ESPEJO, AUDITORÍA Y TRANSACCIÓN ATÓMICA ANTI-HUÉRFANOS
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (100% idempotente, NO borra históricos)
-- ==============================================================================

-- 1. TABLAS DE EJECUCIÓN Y AUDITORÍA DE SINCRONIZACIÓN
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_mes     TEXT NOT NULL CHECK (periodo_mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  sheet_sha256    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'OK' CHECK (status IN ('EN_CURSO', 'OK', 'SKIPPED_UNCHANGED', 'ERROR')),
  triggered_by    TEXT NOT NULL DEFAULT 'system',
  metrics         JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings_count  INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_periodo_started ON public.sync_runs (periodo_mes, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_periodo_hash    ON public.sync_runs (periodo_mes, sheet_sha256);

CREATE TABLE IF NOT EXISTS public.sync_audit_logs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sync_run_id   UUID REFERENCES public.sync_runs (id) ON DELETE CASCADE,
  periodo_mes   TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'WARN' CHECK (severity IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
  sheet_name    TEXT NOT NULL,
  row_number    INTEGER,
  event_code    TEXT NOT NULL,
  vendor_key    TEXT,
  entity_key    TEXT,
  message       TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_audit_periodo_code ON public.sync_audit_logs (periodo_mes, event_code);
CREATE INDEX IF NOT EXISTS idx_sync_audit_run          ON public.sync_audit_logs (sync_run_id);

-- 2. EVOLUCIÓN NO DESTRUCTIVA DE TABLAS OPERATIVAS (PRESERVANDO HISTÓRICOS)

-- 2A. metas_activacion
ALTER TABLE public.metas_activacion
  ADD COLUMN IF NOT EXISTS vendedor_key TEXT,
  ADD COLUMN IF NOT EXISTS cartera      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.metas_activacion
SET vendedor_key = UPPER(TRIM(REGEXP_REPLACE(vendedor_id, '\s+', ' ', 'g')))
WHERE vendedor_key IS NULL;

-- Deduplicación defensiva conservando el registro más reciente por llave natural antes de crear el índice único
DELETE FROM public.metas_activacion a
USING public.metas_activacion b
WHERE a.id < b.id
  AND a.periodo = b.periodo
  AND a.vendedor_key = b.vendedor_key
  AND a.categoria = b.categoria;

CREATE UNIQUE INDEX IF NOT EXISTS uq_metas_periodo_ruta_cat
  ON public.metas_activacion (periodo, vendedor_key, categoria);

-- 2B. ventas_volumen (soporte explícito de venta_bruta_kg, devoluciones_kg negativas, venta_neta_kg y % oficial)
ALTER TABLE public.ventas_volumen
  ADD COLUMN IF NOT EXISTS vendedor_key            TEXT,
  ADD COLUMN IF NOT EXISTS venta_bruta_kg          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS devoluciones_kg         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS venta_neta_kg           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentaje_cumplimiento NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.ventas_volumen
SET vendedor_key    = COALESCE(vendedor_key, UPPER(TRIM(REGEXP_REPLACE(vendedor_id, '\s+', ' ', 'g')))),
    venta_bruta_kg  = CASE WHEN ejecutado_kg > 0 THEN ejecutado_kg ELSE 0 END,
    devoluciones_kg = CASE WHEN ejecutado_kg < 0 THEN ejecutado_kg ELSE 0 END,
    venta_neta_kg   = ejecutado_kg
WHERE vendedor_key IS NULL;

DELETE FROM public.ventas_volumen a
USING public.ventas_volumen b
WHERE a.id < b.id
  AND a.periodo = b.periodo
  AND a.vendedor_key = b.vendedor_key
  AND a.sku = b.sku;

CREATE UNIQUE INDEX IF NOT EXISTS uq_volumen_periodo_ruta_sku
  ON public.ventas_volumen (periodo, vendedor_key, sku);

-- 2C. activacion_clientes (NUMERIC(12,2) para decimales con signo + llave única por periodo)
ALTER TABLE public.activacion_clientes
  ADD COLUMN IF NOT EXISTS cajas_leche_vencampo     NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cajas_mortadela_asturias NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cajas_salpicao           NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_leche_vencampo       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_mortadela_asturias   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_salpicao             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendedor_key             TEXT,
  ADD COLUMN IF NOT EXISTS cliente_codigo_canonico  TEXT,
  ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.activacion_clientes
  ALTER COLUMN cajas_aceite             TYPE NUMERIC(12, 2),
  ALTER COLUMN cajas_azucar             TYPE NUMERIC(12, 2),
  ALTER COLUMN cajas_pollo              TYPE NUMERIC(12, 2),
  ALTER COLUMN cajas_estandar_asturias  TYPE NUMERIC(12, 2),
  ALTER COLUMN cajas_mortadela_salpicao TYPE NUMERIC(12, 2),
  ALTER COLUMN cajas_leche_vencampo     TYPE NUMERIC(12, 2),
  ALTER COLUMN cajas_mortadela_asturias TYPE NUMERIC(12, 2),
  ALTER COLUMN cajas_salpicao           TYPE NUMERIC(12, 2);

UPDATE public.activacion_clientes
SET vendedor_key            = COALESCE(vendedor_key, UPPER(TRIM(REGEXP_REPLACE(COALESCE(vendedor_nombre, vendedor_id), '\s+', ' ', 'g')))),
    cliente_codigo_canonico = COALESCE(cliente_codigo_canonico, COALESCE(NULLIF(LTRIM(REGEXP_REPLACE(cliente_codigo, '^[#\s]+', ''), '0'), ''), '0'))
WHERE vendedor_key IS NULL OR cliente_codigo_canonico IS NULL;

DELETE FROM public.activacion_clientes a
USING public.activacion_clientes b
WHERE a.id < b.id
  AND a.periodo = b.periodo
  AND a.vendedor_key = b.vendedor_key
  AND a.cliente_codigo_canonico = b.cliente_codigo_canonico;

CREATE UNIQUE INDEX IF NOT EXISTS uq_activacion_periodo_ruta_cliente
  ON public.activacion_clientes (periodo, vendedor_key, cliente_codigo_canonico);

-- 2D. degustaciones y usuarios
ALTER TABLE public.degustaciones
  ALTER COLUMN kilos_estimados TYPE NUMERIC(12, 2);

ALTER TABLE public.degustaciones
  ADD COLUMN IF NOT EXISTS vendedor_key TEXT,
  ADD COLUMN IF NOT EXISTS origen_sync  BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_degustaciones_vendedor_key ON public.degustaciones (vendedor_key);

ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_role_check;

ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_role_check CHECK (role IN ('ADMIN', 'SUPERVISOR', 'VENDEDOR'));

-- 3. ENDURECIMIENTO ESTRICTO DE SEGURIDAD RLS Y PRIVILEGIOS (CIERRE DE BRECHAS SEC-01 / SEC-03)
ALTER TABLE public.sync_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_audit_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_activacion    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_volumen      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activacion_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.degustaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_historial    ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas inseguras abiertas a PUBLIC
DROP POLICY IF EXISTS "Permitir acceso completo a service_role"        ON public.usuarios;
DROP POLICY IF EXISTS "Permitir acceso completo a degustaciones"       ON public.degustaciones;
DROP POLICY IF EXISTS "Permitir acceso completo a pedidos_alkosto"     ON public.pedidos_alkosto;
DROP POLICY IF EXISTS "Permitir acceso completo a ventas_volumen"      ON public.ventas_volumen;
DROP POLICY IF EXISTS "Permitir acceso completo a activacion_clientes" ON public.activacion_clientes;
DROP POLICY IF EXISTS "Permitir acceso completo a metas_activacion"    ON public.metas_activacion;
DROP POLICY IF EXISTS "Permitir acceso completo a surveys"             ON public.surveys;
DROP POLICY IF EXISTS "Permitir lectura a service_role en ventas_historial" ON public.ventas_historial;

-- Revocar acceso directo del rol anónimo a todas las tablas sensibles
REVOKE ALL ON public.usuarios            FROM anon, authenticated;
REVOKE ALL ON public.sync_runs           FROM anon, authenticated;
REVOKE ALL ON public.sync_audit_logs     FROM anon, authenticated;
REVOKE ALL ON public.metas_activacion    FROM anon;
REVOKE ALL ON public.ventas_volumen      FROM anon;
REVOKE ALL ON public.activacion_clientes FROM anon;
REVOKE ALL ON public.degustaciones       FROM anon;
REVOKE ALL ON public.ventas_historial    FROM anon, authenticated;

-- Políticas RLS basadas en app_metadata (inmutable por el usuario) para sesiones Supabase Auth autenticadas
DROP POLICY IF EXISTS "metas_select_by_vendor_scope" ON public.metas_activacion;
CREATE POLICY "metas_select_by_vendor_scope" ON public.metas_activacion
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'ADMIN'
    OR vendedor_key = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'vendor_key')
    OR (((SELECT auth.jwt()) -> 'app_metadata' -> 'allowed_route_keys') ? vendedor_key)
  );

DROP POLICY IF EXISTS "volumen_select_by_vendor_scope" ON public.ventas_volumen;
CREATE POLICY "volumen_select_by_vendor_scope" ON public.ventas_volumen
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'ADMIN'
    OR vendedor_key = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'vendor_key')
    OR (((SELECT auth.jwt()) -> 'app_metadata' -> 'allowed_route_keys') ? vendedor_key)
  );

DROP POLICY IF EXISTS "activacion_select_by_vendor_scope" ON public.activacion_clientes;
CREATE POLICY "activacion_select_by_vendor_scope" ON public.activacion_clientes
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'ADMIN'
    OR vendedor_key = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'vendor_key')
    OR (((SELECT auth.jwt()) -> 'app_metadata' -> 'allowed_route_keys') ? vendedor_key)
  );

DROP POLICY IF EXISTS "degustaciones_select_by_vendor_scope" ON public.degustaciones;
CREATE POLICY "degustaciones_select_by_vendor_scope" ON public.degustaciones
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('ADMIN', 'SUPERVISOR')
    OR vendedor_key = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'vendor_key')
    OR (((SELECT auth.jwt()) -> 'app_metadata' -> 'allowed_route_keys') ? vendedor_key)
  );

-- 4. FUNCIÓN RPC TRANSACCIONAL ATÓMICA ANTI-HUÉRFANOS
CREATE OR REPLACE FUNCTION public.sync_monthly_sales_snapshot(
  p_periodo_mes      TEXT,
  p_sheet_sha256     TEXT,
  p_triggered_by     TEXT,
  p_metas            JSONB DEFAULT '[]'::jsonb,
  p_volumen          JSONB DEFAULT '[]'::jsonb,
  p_activacion       JSONB DEFAULT '[]'::jsonb,
  p_degustaciones    JSONB DEFAULT '[]'::jsonb,
  p_audit_logs       JSONB DEFAULT '[]'::jsonb,
  p_metrics          JSONB DEFAULT '{}'::jsonb,
  p_allow_empty      BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run_id               UUID;
  v_upserted_metas       INTEGER := 0;
  v_deleted_metas        INTEGER := 0;
  v_upserted_volumen     INTEGER := 0;
  v_deleted_volumen      INTEGER := 0;
  v_upserted_activacion  INTEGER := 0;
  v_deleted_activacion   INTEGER := 0;
  v_upserted_deg         INTEGER := 0;
  v_deleted_deg          INTEGER := 0;
  v_inserted_audits      INTEGER := 0;
BEGIN
  IF p_periodo_mes IS NULL OR p_periodo_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Periodo mensual inválido: %. Se esperaba YYYY-MM.', p_periodo_mes
      USING ERRCODE = '22023';
  END IF;

  IF NOT p_allow_empty AND (
    jsonb_array_length(COALESCE(p_metas, '[]'::jsonb)) = 0 OR
    jsonb_array_length(COALESCE(p_volumen, '[]'::jsonb)) = 0 OR
    jsonb_array_length(COALESCE(p_activacion, '[]'::jsonb)) = 0
  ) THEN
    RAISE EXCEPTION 'Freno de seguridad activado: payload vacío para el periodo % (p_allow_empty=false).', p_periodo_mes
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('sync_monthly_sales_snapshot:' || p_periodo_mes)) THEN
    RETURN jsonb_build_object(
      'status', 'LOCKED_CONCURRENT_RUN',
      'periodo_mes', p_periodo_mes
    );
  END IF;

  INSERT INTO public.sync_runs (periodo_mes, sheet_sha256, status, triggered_by, metrics, warnings_count)
  VALUES (
    p_periodo_mes,
    COALESCE(p_sheet_sha256, ''),
    'OK',
    COALESCE(p_triggered_by, 'system'),
    COALESCE(p_metrics, '{}'::jsonb),
    jsonb_array_length(COALESCE(p_audit_logs, '[]'::jsonb))
  )
  RETURNING id INTO v_run_id;

  -- A) METAS ACTIVACIÓN
  WITH incoming AS (
    SELECT
      p_periodo_mes AS periodo,
      (x->>'vendedor_id')::text AS vendedor_id,
      (x->>'vendedor_key')::text AS vendedor_key,
      (x->>'categoria')::text AS categoria,
      COALESCE((x->>'cartera')::integer, 0) AS cartera,
      COALESCE((x->>'meta')::integer, 0) AS meta,
      COALESCE((x->>'activados')::integer, 0) AS activados
    FROM jsonb_array_elements(COALESCE(p_metas, '[]'::jsonb)) AS x
  ),
  upserted AS (
    INSERT INTO public.metas_activacion (periodo, vendedor_id, vendedor_key, categoria, cartera, meta, activados, updated_at)
    SELECT periodo, vendedor_id, vendedor_key, categoria, cartera, meta, activados, NOW()
    FROM incoming
    ON CONFLICT (periodo, vendedor_key, categoria) DO UPDATE SET
      vendedor_id = EXCLUDED.vendedor_id,
      cartera     = EXCLUDED.cartera,
      meta        = EXCLUDED.meta,
      activados   = EXCLUDED.activados,
      updated_at  = NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_upserted_metas FROM upserted;

  DELETE FROM public.metas_activacion m
  WHERE m.periodo = p_periodo_mes
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_metas, '[]'::jsonb)) AS x
      WHERE (x->>'vendedor_key')::text = m.vendedor_key
        AND (x->>'categoria')::text    = m.categoria
    );
  GET DIAGNOSTICS v_deleted_metas = ROW_COUNT;

  -- B) VOLUMEN POR SKU
  WITH incoming AS (
    SELECT
      p_periodo_mes AS periodo,
      (x->>'vendedor_id')::text AS vendedor_id,
      (x->>'vendedor_key')::text AS vendedor_key,
      (x->>'vendedor_nombre')::text AS vendedor_nombre,
      (x->>'sku')::text AS sku,
      (x->>'articulo')::text AS articulo,
      (x->>'categoria')::text AS categoria,
      COALESCE((x->>'meta_kg')::numeric(12,2), 0) AS meta_kg,
      COALESCE((x->>'venta_bruta_kg')::numeric(12,2), 0) AS venta_bruta_kg,
      COALESCE((x->>'devoluciones_kg')::numeric(12,2), 0) AS devoluciones_kg,
      COALESCE((x->>'venta_neta_kg')::numeric(12,2), 0) AS venta_neta_kg,
      (x->>'porcentaje_cumplimiento')::numeric(12,4) AS porcentaje_cumplimiento,
      COALESCE((x->>'zona')::text, 'General') AS zona
    FROM jsonb_array_elements(COALESCE(p_volumen, '[]'::jsonb)) AS x
  ),
  upserted AS (
    INSERT INTO public.ventas_volumen (
      periodo, vendedor_id, vendedor_key, vendedor_nombre, sku, articulo, categoria,
      meta_kg, ejecutado_kg, venta_bruta_kg, devoluciones_kg, venta_neta_kg,
      porcentaje_cumplimiento, zona, updated_at
    )
    SELECT
      periodo, vendedor_id, vendedor_key, vendedor_nombre, sku, articulo, categoria,
      meta_kg, venta_neta_kg, venta_bruta_kg, devoluciones_kg, venta_neta_kg,
      porcentaje_cumplimiento, zona, NOW()
    FROM incoming
    ON CONFLICT (periodo, vendedor_key, sku) DO UPDATE SET
      vendedor_id             = EXCLUDED.vendedor_id,
      vendedor_nombre         = EXCLUDED.vendedor_nombre,
      articulo                = EXCLUDED.articulo,
      categoria               = EXCLUDED.categoria,
      meta_kg                 = EXCLUDED.meta_kg,
      ejecutado_kg            = EXCLUDED.ejecutado_kg,
      venta_bruta_kg          = EXCLUDED.venta_bruta_kg,
      devoluciones_kg         = EXCLUDED.devoluciones_kg,
      venta_neta_kg           = EXCLUDED.venta_neta_kg,
      porcentaje_cumplimiento = EXCLUDED.porcentaje_cumplimiento,
      zona                    = EXCLUDED.zona,
      updated_at              = NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_upserted_volumen FROM upserted;

  DELETE FROM public.ventas_volumen v
  WHERE v.periodo = p_periodo_mes
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_volumen, '[]'::jsonb)) AS x
      WHERE (x->>'vendedor_key')::text = v.vendedor_key
        AND (x->>'sku')::text          = v.sku
    );
  GET DIAGNOSTICS v_deleted_volumen = ROW_COUNT;

  -- C) ACTIVACIÓN POR CLIENTE
  WITH incoming AS (
    SELECT
      p_periodo_mes AS periodo,
      (x->>'cliente_codigo')::text AS cliente_codigo,
      (x->>'cliente_codigo_canonico')::text AS cliente_codigo_canonico,
      (x->>'cliente_nombre')::text AS cliente_nombre,
      (x->>'vendedor_id')::text AS vendedor_id,
      (x->>'vendedor_key')::text AS vendedor_key,
      (x->>'vendedor_nombre')::text AS vendedor_nombre,
      COALESCE((x->>'status')::text, 'INACTIVO') AS status,
      COALESCE((x->>'cajas_aceite')::numeric(12,2), 0) AS cajas_aceite,
      COALESCE((x->>'cajas_azucar')::numeric(12,2), 0) AS cajas_azucar,
      COALESCE((x->>'cajas_leche_vencampo')::numeric(12,2), 0) AS cajas_leche_vencampo,
      COALESCE((x->>'cajas_pollo')::numeric(12,2), 0) AS cajas_pollo,
      COALESCE((x->>'cajas_estandar_asturias')::numeric(12,2), 0) AS cajas_estandar_asturias,
      COALESCE((x->>'cajas_mortadela_salpicao')::numeric(12,2), 0) AS cajas_mortadela_salpicao,
      COALESCE((x->>'cajas_mortadela_asturias')::numeric(12,2), 0) AS cajas_mortadela_asturias,
      COALESCE((x->>'cajas_salpicao')::numeric(12,2), 0) AS cajas_salpicao,
      COALESCE((x->>'has_aceite')::boolean, false) AS has_aceite,
      COALESCE((x->>'has_azucar')::boolean, false) AS has_azucar,
      COALESCE((x->>'has_leche_vencampo')::boolean, false) AS has_leche_vencampo,
      COALESCE((x->>'has_pollo')::boolean, false) AS has_pollo,
      COALESCE((x->>'has_estandar_asturias')::boolean, false) AS has_estandar_asturias,
      COALESCE((x->>'has_mortadela_salpicao')::boolean, false) AS has_mortadela_salpicao,
      COALESCE((x->>'has_mortadela_asturias')::boolean, false) AS has_mortadela_asturias,
      COALESCE((x->>'has_salpicao')::boolean, false) AS has_salpicao
    FROM jsonb_array_elements(COALESCE(p_activacion, '[]'::jsonb)) AS x
  ),
  upserted AS (
    INSERT INTO public.activacion_clientes (
      periodo, cliente_codigo, cliente_codigo_canonico, cliente_nombre,
      vendedor_id, vendedor_key, vendedor_nombre, status,
      cajas_aceite, cajas_azucar, cajas_leche_vencampo, cajas_pollo,
      cajas_estandar_asturias, cajas_mortadela_salpicao, cajas_mortadela_asturias, cajas_salpicao,
      has_aceite, has_azucar, has_leche_vencampo, has_pollo,
      has_estandar_asturias, has_mortadela_salpicao, has_mortadela_asturias, has_salpicao,
      updated_at
    )
    SELECT
      periodo, cliente_codigo, cliente_codigo_canonico, cliente_nombre,
      vendedor_id, vendedor_key, vendedor_nombre, status,
      cajas_aceite, cajas_azucar, cajas_leche_vencampo, cajas_pollo,
      cajas_estandar_asturias, cajas_mortadela_salpicao, cajas_mortadela_asturias, cajas_salpicao,
      has_aceite, has_azucar, has_leche_vencampo, has_pollo,
      has_estandar_asturias, has_mortadela_salpicao, has_mortadela_asturias, has_salpicao,
      NOW()
    FROM incoming
    ON CONFLICT (periodo, vendedor_key, cliente_codigo_canonico) DO UPDATE SET
      cliente_codigo           = EXCLUDED.cliente_codigo,
      cliente_nombre           = EXCLUDED.cliente_nombre,
      vendedor_id              = EXCLUDED.vendedor_id,
      vendedor_nombre          = EXCLUDED.vendedor_nombre,
      status                   = EXCLUDED.status,
      cajas_aceite             = EXCLUDED.cajas_aceite,
      cajas_azucar             = EXCLUDED.cajas_azucar,
      cajas_leche_vencampo     = EXCLUDED.cajas_leche_vencampo,
      cajas_pollo              = EXCLUDED.cajas_pollo,
      cajas_estandar_asturias  = EXCLUDED.cajas_estandar_asturias,
      cajas_mortadela_salpicao = EXCLUDED.cajas_mortadela_salpicao,
      cajas_mortadela_asturias = EXCLUDED.cajas_mortadela_asturias,
      cajas_salpicao           = EXCLUDED.cajas_salpicao,
      has_aceite               = EXCLUDED.has_aceite,
      has_azucar               = EXCLUDED.has_azucar,
      has_leche_vencampo       = EXCLUDED.has_leche_vencampo,
      has_pollo                = EXCLUDED.has_pollo,
      has_estandar_asturias    = EXCLUDED.has_estandar_asturias,
      has_mortadela_salpicao   = EXCLUDED.has_mortadela_salpicao,
      has_mortadela_asturias   = EXCLUDED.has_mortadela_asturias,
      has_salpicao             = EXCLUDED.has_salpicao,
      updated_at               = NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_upserted_activacion FROM upserted;

  DELETE FROM public.activacion_clientes a
  WHERE a.periodo = p_periodo_mes
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_activacion, '[]'::jsonb)) AS x
      WHERE (x->>'vendedor_key')::text            = a.vendedor_key
        AND (x->>'cliente_codigo_canonico')::text = a.cliente_codigo_canonico
    );
  GET DIAGNOSTICS v_deleted_activacion = ROW_COUNT;

  -- D) DEGUSTACIONES DEL MES EN CURSO
  WITH incoming AS (
    SELECT
      (x->>'id')::text AS id,
      COALESCE((x->>'cliente_codigo')::text, 'PDV') AS cliente_codigo,
      (x->>'cliente_nombre')::text AS cliente_nombre,
      (x->>'vendedor_nombre')::text AS vendedor_nombre,
      (x->>'vendedor_id')::text AS vendedor_id,
      (x->>'vendedor_key')::text AS vendedor_key,
      (x->>'ruta')::text AS ruta,
      (x->>'fecha')::date AS fecha,
      COALESCE((x->>'turno')::text, 'MAÑANA') AS turno,
      (x->>'hora')::text AS hora,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(x->'productos', '[]'::jsonb))) AS productos,
      COALESCE((x->>'kilos_estimados')::numeric(12,2), 0) AS kilos_estimados,
      COALESCE((x->>'personas_estimadas')::integer, 0) AS personas_estimadas,
      COALESCE((x->>'requiere_promotora')::boolean, false) AS requiere_promotora,
      COALESCE((x->>'promotora_asignada')::text, '') AS promotora_asignada,
      COALESCE((x->>'material_pop')::boolean, false) AS material_pop,
      (x->>'contacto_punto')::text AS contacto_punto,
      (x->>'telefono_contacto')::text AS telefono_contacto,
      (x->>'observaciones')::text AS observaciones,
      COALESCE((x->>'estado')::text, 'SOLICITADA') AS estado,
      (x->>'notas_trade_marketing')::text AS notas_trade_marketing
    FROM jsonb_array_elements(COALESCE(p_degustaciones, '[]'::jsonb)) AS x
    WHERE SUBSTRING((x->>'fecha')::text FROM 1 FOR 7) = p_periodo_mes
  ),
  upserted AS (
    INSERT INTO public.degustaciones (
      id, cliente_codigo, cliente_nombre, vendedor_nombre, vendedor_id, vendedor_key, ruta,
      fecha, turno, hora, productos, kilos_estimados, personas_estimadas,
      requiere_promotora, promotora_asignada, material_pop, contacto_punto,
      telefono_contacto, observaciones, estado, notas_trade_marketing, origen_sync, updated_at
    )
    SELECT
      id, cliente_codigo, cliente_nombre, vendedor_nombre, vendedor_id, vendedor_key, ruta,
      fecha, turno, hora, productos, kilos_estimados, personas_estimadas,
      requiere_promotora, promotora_asignada, material_pop, contacto_punto,
      telefono_contacto, observaciones, estado, notas_trade_marketing, true, NOW()
    FROM incoming
    ON CONFLICT (id) DO UPDATE SET
      cliente_codigo        = EXCLUDED.cliente_codigo,
      cliente_nombre        = EXCLUDED.cliente_nombre,
      vendedor_nombre       = EXCLUDED.vendedor_nombre,
      vendedor_id           = EXCLUDED.vendedor_id,
      vendedor_key          = EXCLUDED.vendedor_key,
      ruta                  = EXCLUDED.ruta,
      fecha                 = EXCLUDED.fecha,
      turno                 = EXCLUDED.turno,
      hora                  = EXCLUDED.hora,
      productos             = EXCLUDED.productos,
      kilos_estimados       = EXCLUDED.kilos_estimados,
      personas_estimadas    = EXCLUDED.personas_estimadas,
      requiere_promotora    = EXCLUDED.requiere_promotora,
      promotora_asignada    = EXCLUDED.promotora_asignada,
      material_pop          = EXCLUDED.material_pop,
      contacto_punto        = EXCLUDED.contacto_punto,
      telefono_contacto     = EXCLUDED.telefono_contacto,
      observaciones         = EXCLUDED.observaciones,
      estado                = EXCLUDED.estado,
      notas_trade_marketing = EXCLUDED.notas_trade_marketing,
      origen_sync           = true,
      updated_at            = NOW()
    WHERE SUBSTRING(public.degustaciones.fecha::text FROM 1 FOR 7) = p_periodo_mes
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_upserted_deg FROM upserted;

  DELETE FROM public.degustaciones d
  WHERE SUBSTRING(d.fecha::text FROM 1 FOR 7) = p_periodo_mes
    AND d.origen_sync = true
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_degustaciones, '[]'::jsonb)) AS x
      WHERE (x->>'id')::text = d.id
    );
  GET DIAGNOSTICS v_deleted_deg = ROW_COUNT;

  -- E) LOGS DE AUDITORÍA Y CUARENTENA
  WITH ins_aud AS (
    INSERT INTO public.sync_audit_logs (
      sync_run_id, periodo_mes, severity, sheet_name, row_number,
      event_code, vendor_key, entity_key, message, payload
    )
    SELECT
      v_run_id,
      p_periodo_mes,
      COALESCE((a->>'severity')::text, 'WARN'),
      COALESCE((a->>'sheet_name')::text, 'UNKNOWN'),
      (a->>'row_number')::integer,
      COALESCE((a->>'event_code')::text, 'UNSPECIFIED'),
      (a->>'vendor_key')::text,
      (a->>'entity_key')::text,
      COALESCE((a->>'message')::text, ''),
      COALESCE(a->'payload', '{}'::jsonb)
    FROM jsonb_array_elements(COALESCE(p_audit_logs, '[]'::jsonb)) AS a
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_audits FROM ins_aud;

  UPDATE public.sync_runs
  SET finished_at = NOW()
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'status', 'OK',
    'sync_run_id', v_run_id,
    'periodo_mes', p_periodo_mes,
    'metas', jsonb_build_object('upserted', v_upserted_metas, 'deleted_orphans', v_deleted_metas),
    'volumen', jsonb_build_object('upserted', v_upserted_volumen, 'deleted_orphans', v_deleted_volumen),
    'activacion', jsonb_build_object('upserted', v_upserted_activacion, 'deleted_orphans', v_deleted_activacion),
    'degustaciones', jsonb_build_object('upserted', v_upserted_deg, 'deleted_orphans', v_deleted_deg),
    'audit_logs_inserted', v_inserted_audits
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_monthly_sales_snapshot(
  TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, BOOLEAN
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_monthly_sales_snapshot(
  TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, BOOLEAN
) TO service_role;

NOTIFY pgrst, 'reload schema';
