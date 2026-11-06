-- ==============================================================
-- CODIZULCA - MAESTRA ACTIVA (Clientes / Vendedores / Supervisores)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (idempotente: usa IF NOT EXISTS).
--
-- Reglas de diseño:
--  * PK de cliente = id_cliente (el "Id" del ERP). El RIF es NULLABLE y NO es UNIQUE:
--    hay RIFs compartidos por varias sucursales (p. ej. Alkosto / Familia Center).
--  * Soft delete: NUNCA se hace DELETE. Los registros que dejan de venir en la maestra
--    quedan con activo = false y fecha_baja, para no romper pedidos / ventas históricas.
--  * ultima_carga_id marca qué carga tocó cada fila; la baja se calcula DESPUES de
--    escribir todos los lotes (activo AND ultima_carga_id <> carga_actual), por lo que
--    reintentar una carga interrumpida es seguro (idempotente).
--  * RLS activado SIN políticas: solo el backend (service_role) puede leer/escribir.
--    El frontend consume la cartera a través de la API, nunca directo con la anon key.
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.maestra_cargas (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo          TEXT,
    archivo_nombre   TEXT,
    archivo_sha256   TEXT,
    estado           TEXT NOT NULL DEFAULT 'EN_CURSO'
                     CHECK (estado IN ('EN_CURSO', 'OK', 'ADVERTENCIA', 'ERROR')),
    resumen          JSONB,
    error            TEXT,
    creado_por       TEXT,
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalizado_en    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_maestra_cargas_hash ON public.maestra_cargas (archivo_sha256);
CREATE INDEX IF NOT EXISTS idx_maestra_cargas_creado ON public.maestra_cargas (creado_en DESC);

CREATE TABLE IF NOT EXISTS public.maestra_supervisores (
    nombre              TEXT PRIMARY KEY,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_baja          TIMESTAMPTZ,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_carga_id     UUID REFERENCES public.maestra_cargas (id)
);

CREATE TABLE IF NOT EXISTS public.maestra_vendedores (
    id_vendedor         INTEGER PRIMARY KEY,
    nombre              TEXT NOT NULL,
    supervisor          TEXT REFERENCES public.maestra_supervisores (nombre),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_baja          TIMESTAMPTZ,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_carga_id     UUID REFERENCES public.maestra_cargas (id)
);

CREATE INDEX IF NOT EXISTS idx_maestra_vendedores_supervisor ON public.maestra_vendedores (supervisor);

CREATE TABLE IF NOT EXISTS public.maestra_clientes (
    id_cliente          INTEGER PRIMARY KEY,
    razon_social        TEXT NOT NULL,
    rif                 TEXT,                       -- NULL cuando el archivo trae #N/D; sin UNIQUE
    id_vendedor         INTEGER NOT NULL REFERENCES public.maestra_vendedores (id_vendedor),
    supervisor          TEXT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_baja          TIMESTAMPTZ,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_carga_id     UUID REFERENCES public.maestra_cargas (id)
);

CREATE INDEX IF NOT EXISTS idx_maestra_clientes_vendedor_activo ON public.maestra_clientes (id_vendedor) WHERE activo;
CREATE INDEX IF NOT EXISTS idx_maestra_clientes_activo ON public.maestra_clientes (activo);
CREATE INDEX IF NOT EXISTS idx_maestra_clientes_rif ON public.maestra_clientes (rif) WHERE rif IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maestra_clientes_carga ON public.maestra_clientes (ultima_carga_id);

ALTER TABLE public.maestra_cargas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestra_supervisores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestra_vendedores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestra_clientes      ENABLE ROW LEVEL SECURITY;
-- (sin CREATE POLICY a propósito: el service_role omite RLS; anon/authenticated quedan sin acceso)
