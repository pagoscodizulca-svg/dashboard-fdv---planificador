-- ==============================================================
-- CODIZULCA - RUBROS DE ACTIVACION NOVIEMBRE 2026
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Es idempotente (IF NOT EXISTS / CREATE OR REPLACE).
--
-- Rubros activos del mes (ver src/lib/rubros.ts):
--   Azucar | Leche en polvo Vencampo | Jamon estandar y superior Asturias | Mortadela Asturias | Salpicao
-- Aceite, Pollo y la categoria combinada 'MORTADELA_SALPICAO' pasan a ser LEGACY: sus columnas y datos
-- se CONSERVAN (no se borra nada) para no romper historial.
--
-- Este script hace 3 cosas:
--   1. Agrega columnas de los rubros nuevos a public.activacion_clientes.
--   2. Reclasifica public.ventas_historial.rubro con la MISMA regla que src/lib/rubros.ts (clasificarRubro).
--      Necesario para el Dashboard 360 historico de los rubros nuevos (filtra por ventas_historial.rubro).
--   3. Recrea las vistas hist_activacion_cliente_mes / hist_activacion_resumen_mes con columnas de los rubros nuevos
--      (se conservan todas las columnas anteriores en el mismo orden relativo, mas las nuevas AL FINAL de cada grupo).
--
-- NOTA: se recomienda hacer una copia/rama de la base antes de ejecutar el paso 2 (UPDATE masivo).
-- ==============================================================

-- 1. COLUMNAS NUEVAS EN activacion_clientes -----------------------------------------------------
ALTER TABLE public.activacion_clientes
    ADD COLUMN IF NOT EXISTS cajas_leche_vencampo     NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cajas_mortadela_asturias NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cajas_salpicao           NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_leche_vencampo       BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_mortadela_asturias   BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_salpicao             BOOLEAN DEFAULT false;

-- 2. RECLASIFICACION DE ventas_historial.rubro (misma regla que clasificarRubro en src/lib/rubros.ts) ---
--    Prioridad: Jamon estandar/superior > Salpicao > Mortadela Asturias > Leche Vencampo > Aceite > Azucar > Pollo > Otros
UPDATE public.ventas_historial v
SET rubro = CASE
    WHEN v.id_articulo IN ('1461', '1463')
         OR UPPER(v.articulo) LIKE '%ESTANDAR ASTURIAS%'
         OR UPPER(v.articulo) LIKE '%SUPERIOR ASTURIAS%'                      THEN 'ESTANDAR_ASTURIAS'
    WHEN UPPER(v.articulo) LIKE '%SALPICAO%'
         OR v.id_articulo IN ('1563', '1562', '1519', '1599')                 THEN 'SALPICAO'
    WHEN v.id_articulo IN ('1464', '1462', '1512', '1521', '1561', '1522', '1564', '1496', '1511')
         OR (UPPER(v.articulo) LIKE '%ASTURIAS%'
             AND (UPPER(v.articulo) LIKE '%MORTADELA%' OR UPPER(v.articulo) LIKE '%MORT.%' OR UPPER(v.articulo) LIKE '%PECHUGA%'))
                                                                              THEN 'MORTADELA_ASTURIAS'
    WHEN v.id_articulo IN ('1536', '1555', '1556', '1574', '1579')
         OR (UPPER(v.articulo) LIKE '%LECHE%' AND UPPER(v.articulo) LIKE '%VENCAMPO%')
                                                                              THEN 'LECHE_VENCAMPO'
    WHEN UPPER(v.id_articulo) = 'ACEITE' OR UPPER(v.articulo) LIKE '%ACEITE%' THEN 'ACEITE'
    WHEN UPPER(v.id_articulo) IN ('AZUCAR', 'AZÚCAR')
         OR UPPER(v.articulo) LIKE '%AZUCAR%' OR UPPER(v.articulo) LIKE '%AZÚCAR%' THEN 'AZUCAR'
    WHEN v.id_articulo IN ('630', '629', '870', '393')
         OR UPPER(v.id_articulo) IN ('POLLO', 'FILET', 'MUSLO', 'ALAS')
         OR UPPER(v.articulo) LIKE '%POLLO ENTERO%' OR UPPER(v.articulo) LIKE '%POLLO TODAS%'
         OR UPPER(v.articulo) LIKE '%FILET%' OR UPPER(v.articulo) LIKE '%MUSLO%'
         OR UPPER(v.articulo) LIKE '%ALAS DESPRESADAS%' OR UPPER(v.articulo) LIKE '%HIGADO%'
         OR UPPER(v.articulo) LIKE '%MOLLEJA%'                                THEN 'POLLO'
    ELSE 'OTROS'
END
WHERE v.rubro IS DISTINCT FROM CASE
    WHEN v.id_articulo IN ('1461', '1463')
         OR UPPER(v.articulo) LIKE '%ESTANDAR ASTURIAS%'
         OR UPPER(v.articulo) LIKE '%SUPERIOR ASTURIAS%'                      THEN 'ESTANDAR_ASTURIAS'
    WHEN UPPER(v.articulo) LIKE '%SALPICAO%'
         OR v.id_articulo IN ('1563', '1562', '1519', '1599')                 THEN 'SALPICAO'
    WHEN v.id_articulo IN ('1464', '1462', '1512', '1521', '1561', '1522', '1564', '1496', '1511')
         OR (UPPER(v.articulo) LIKE '%ASTURIAS%'
             AND (UPPER(v.articulo) LIKE '%MORTADELA%' OR UPPER(v.articulo) LIKE '%MORT.%' OR UPPER(v.articulo) LIKE '%PECHUGA%'))
                                                                              THEN 'MORTADELA_ASTURIAS'
    WHEN v.id_articulo IN ('1536', '1555', '1556', '1574', '1579')
         OR (UPPER(v.articulo) LIKE '%LECHE%' AND UPPER(v.articulo) LIKE '%VENCAMPO%')
                                                                              THEN 'LECHE_VENCAMPO'
    WHEN UPPER(v.id_articulo) = 'ACEITE' OR UPPER(v.articulo) LIKE '%ACEITE%' THEN 'ACEITE'
    WHEN UPPER(v.id_articulo) IN ('AZUCAR', 'AZÚCAR')
         OR UPPER(v.articulo) LIKE '%AZUCAR%' OR UPPER(v.articulo) LIKE '%AZÚCAR%' THEN 'AZUCAR'
    WHEN v.id_articulo IN ('630', '629', '870', '393')
         OR UPPER(v.id_articulo) IN ('POLLO', 'FILET', 'MUSLO', 'ALAS')
         OR UPPER(v.articulo) LIKE '%POLLO ENTERO%' OR UPPER(v.articulo) LIKE '%POLLO TODAS%'
         OR UPPER(v.articulo) LIKE '%FILET%' OR UPPER(v.articulo) LIKE '%MUSLO%'
         OR UPPER(v.articulo) LIKE '%ALAS DESPRESADAS%' OR UPPER(v.articulo) LIKE '%HIGADO%'
         OR UPPER(v.articulo) LIKE '%MOLLEJA%'                                THEN 'POLLO'
    ELSE 'OTROS'
END;

-- 3. VISTAS DE ACTIVACION CON LOS RUBROS NUEVOS ---------------------------------------------------
--    Se hace DROP + CREATE porque agregar columnas a una vista existente con CREATE OR REPLACE no se permite
--    cuando cambia el orden/lista de columnas. Los GRANT/REVOKE se repiten al final.
DROP VIEW IF EXISTS public.hist_activacion_resumen_mes;
DROP VIEW IF EXISTS public.hist_activacion_cliente_mes;

CREATE VIEW public.hist_activacion_cliente_mes WITH (security_invoker = true) AS
WITH ventas AS (
    SELECT ano, mes, id_cliente,
           MAX(cliente) AS cliente,
           SUM(CASE WHEN rubro = 'ACEITE'             THEN GREATEST(cajas, 0) ELSE 0 END) AS cajas_aceite,
           SUM(CASE WHEN rubro = 'AZUCAR'             THEN GREATEST(cajas, 0) ELSE 0 END) AS cajas_azucar,
           SUM(CASE WHEN rubro = 'POLLO'              THEN GREATEST(cajas, 0) ELSE 0 END) AS cajas_pollo,
           SUM(CASE WHEN rubro = 'ESTANDAR_ASTURIAS'  THEN GREATEST(cajas, 0) ELSE 0 END) AS cajas_estandar_asturias,
           SUM(CASE WHEN rubro = 'MORTADELA_SALPICAO' THEN GREATEST(cajas, 0) ELSE 0 END) AS cajas_mortadela_salpicao,
           SUM(CASE WHEN rubro = 'LECHE_VENCAMPO'     THEN GREATEST(cajas, 0) ELSE 0 END) AS cajas_leche_vencampo,
           SUM(CASE WHEN rubro = 'MORTADELA_ASTURIAS' THEN GREATEST(cajas, 0) ELSE 0 END) AS cajas_mortadela_asturias,
           SUM(CASE WHEN rubro = 'SALPICAO'           THEN GREATEST(cajas, 0) ELSE 0 END) AS cajas_salpicao,
           SUM(kgs)   AS kgs,
           SUM(monto) AS monto,
           (ARRAY_AGG(vendedor ORDER BY monto DESC))[1] AS vendedor_venta
    FROM public.ventas_historial
    GROUP BY ano, mes, id_cliente
),
cartera AS (
    SELECT DISTINCT ON (LTRIM(cliente_codigo, '0'))
           LTRIM(cliente_codigo, '0') AS k, cliente_nombre, vendedor_nombre
    FROM public.activacion_clientes
    ORDER BY LTRIM(cliente_codigo, '0'), id DESC
)
SELECT v.ano, v.mes, v.id_cliente,
       COALESCE(c.cliente_nombre, v.cliente)    AS cliente,
       COALESCE(c.vendedor_nombre, v.vendedor_venta) AS vendedor,
       (c.k IS NOT NULL)                        AS en_cartera,
       v.cajas_aceite, v.cajas_azucar, v.cajas_pollo,
       v.cajas_estandar_asturias, v.cajas_mortadela_salpicao,
       v.kgs, v.monto,
       v.cajas_leche_vencampo, v.cajas_mortadela_asturias, v.cajas_salpicao
FROM ventas v
LEFT JOIN cartera c ON c.k = LTRIM(v.id_cliente, '0');

-- Resumen por vendedor / mes. act_total cuenta SOLO los rubros activos del mes (Azucar, Leche, Jamon, Mortadela Asturias, Salpicao).
CREATE VIEW public.hist_activacion_resumen_mes WITH (security_invoker = true) AS
SELECT ano, mes, vendedor,
       COUNT(*) FILTER (WHERE en_cartera AND cajas_aceite > 0)              AS act_aceite,
       COUNT(*) FILTER (WHERE en_cartera AND cajas_azucar > 0)              AS act_azucar,
       COUNT(*) FILTER (WHERE en_cartera AND cajas_pollo > 0)               AS act_pollo,
       COUNT(*) FILTER (WHERE en_cartera AND cajas_estandar_asturias > 0)   AS act_estandar_asturias,
       COUNT(*) FILTER (WHERE en_cartera AND cajas_mortadela_salpicao > 0)  AS act_mortadela_salpicao,
       COUNT(*) FILTER (WHERE en_cartera AND
           (cajas_azucar + cajas_leche_vencampo + cajas_estandar_asturias + cajas_mortadela_asturias + cajas_salpicao) > 0) AS act_total,
       COUNT(*) FILTER (WHERE en_cartera)     AS clientes_con_movimiento,
       COUNT(*) FILTER (WHERE NOT en_cartera) AS clientes_fuera_cartera,
       COUNT(*) FILTER (WHERE en_cartera AND cajas_leche_vencampo > 0)      AS act_leche_vencampo,
       COUNT(*) FILTER (WHERE en_cartera AND cajas_mortadela_asturias > 0)  AS act_mortadela_asturias,
       COUNT(*) FILTER (WHERE en_cartera AND cajas_salpicao > 0)            AS act_salpicao
FROM public.hist_activacion_cliente_mes
GROUP BY ano, mes, vendedor;

REVOKE ALL ON public.hist_activacion_cliente_mes FROM anon, authenticated;
REVOKE ALL ON public.hist_activacion_resumen_mes FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
