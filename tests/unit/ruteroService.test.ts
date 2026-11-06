import { RUBRO_SHORT_LABELS } from '../../src/services/ruteroService';
import { describe, it, expect } from 'vitest';
import {
  getDiaSemanaActualRuta,
  normalizarClaveClienteRuta,
  calcularPrioridadVisita,
  buildClientesRutaEnriquecidos,
  autoDistribuirCarteraSemanal,
  calcularResumenJornadaRuta
} from '../../src/services/ruteroService';
import { AsignacionClienteRuta, RegistroVisitaRuta } from '../../src/types';

describe('Unit: ruteroService (Planificador Inteligente de Ruta - Fase 1)', () => {
  it('should map JS dates to Monday-Saturday route days accurately', () => {
    expect(getDiaSemanaActualRuta(new Date('2026-11-02T12:00:00Z'))).toBe('LUNES');
    expect(getDiaSemanaActualRuta(new Date('2026-11-03T12:00:00Z'))).toBe('MARTES');
    expect(getDiaSemanaActualRuta(new Date('2026-11-04T12:00:00Z'))).toBe('MIERCOLES');
    expect(getDiaSemanaActualRuta(new Date('2026-11-05T12:00:00Z'))).toBe('JUEVES');
    expect(getDiaSemanaActualRuta(new Date('2026-11-06T12:00:00Z'))).toBe('VIERNES');
    expect(getDiaSemanaActualRuta(new Date('2026-11-07T12:00:00Z'))).toBe('SABADO');
    // Domingo prepara la jornada del Lunes
    expect(getDiaSemanaActualRuta(new Date('2026-11-08T12:00:00Z'))).toBe('LUNES');
  });

  it('should prioritize inactive clients first, then 3-4/5 rubros, then 1-2/5, and 5/5 last', () => {
    const pInactivo = calcularPrioridadVisita(0, false);
    const pCierre4 = calcularPrioridadVisita(4, true);
    const pDesarrollo2 = calcularPrioridadVisita(2, true);
    const pCumplido5 = calcularPrioridadVisita(5, true);

    expect(pInactivo.prioridad).toBe('ALTA_INACTIVO');
    expect(pCierre4.prioridad).toBe('ALTA_CIERRE_5');
    expect(pDesarrollo2.prioridad).toBe('MEDIA_DESARROLLO');
    expect(pCumplido5.prioridad).toBe('CUMPLIDO_5');

    expect(pInactivo.prioridadScore).toBeGreaterThan(pCierre4.prioridadScore);
    expect(pCierre4.prioridadScore).toBeGreaterThan(pDesarrollo2.prioridadScore);
    expect(pDesarrollo2.prioridadScore).toBeGreaterThan(pCumplido5.prioridadScore);
  });

  it('should enrich clients with missing rubros, volume KG, and sort pending urgent clients first', () => {
    const filteredActivacion = [
      {
        id: '1001',
        vendedorId: 'OSCAR ORTIZ',
        cliente: 'ABASTO EL SOL',
        status: 'ACTIVO',
        cats: { AZUCAR: 1, LECHE_VENCAMPO: 1, ESTANDAR_ASTURIAS: 1, MORTADELA_ASTURIAS: 1, SALPICAO: 1 }
      },
      {
        id: '1002',
        vendedorId: 'OSCAR ORTIZ',
        cliente: 'SUPERMERCADO LA ESTRELLA',
        status: 'INACTIVO',
        cats: {}
      },
      {
        id: '1003',
        vendedorId: 'OSCAR ORTIZ',
        cliente: 'CHARCUTERIA CENTRAL',
        status: 'ACTIVO',
        cats: { AZUCAR: 1, LECHE_VENCAMPO: 1, ESTANDAR_ASTURIAS: 1, MORTADELA_ASTURIAS: 0, SALPICAO: 0 }
      }
    ];

    const filteredVolumen = [
      {
        id: '1003',
        vendedorId: 'OSCAR ORTIZ',
        cliente: 'CHARCUTERIA CENTRAL',
        ejecutadoKg: 145.5,
        metaKg: 200
      }
    ];

    const key1 = normalizarClaveClienteRuta('1001', 'ABASTO EL SOL', 'OSCAR ORTIZ');
    const key2 = normalizarClaveClienteRuta('1002', 'SUPERMERCADO LA ESTRELLA', 'OSCAR ORTIZ');
    const key3 = normalizarClaveClienteRuta('1003', 'CHARCUTERIA CENTRAL', 'OSCAR ORTIZ');

    const asignacionesMap: Record<string, AsignacionClienteRuta> = {
      [key1]: {
        clienteKey: key1,
        clienteId: '1001',
        clienteNombre: 'ABASTO EL SOL',
        vendedorId: 'OSCAR ORTIZ',
        dias: ['MARTES'],
        updatedAt: '2026-11-03T08:00:00Z'
      },
      [key2]: {
        clienteKey: key2,
        clienteId: '1002',
        clienteNombre: 'SUPERMERCADO LA ESTRELLA',
        vendedorId: 'OSCAR ORTIZ',
        dias: ['MARTES'],
        updatedAt: '2026-11-03T08:00:00Z'
      },
      [key3]: {
        clienteKey: key3,
        clienteId: '1003',
        clienteNombre: 'CHARCUTERIA CENTRAL',
        vendedorId: 'OSCAR ORTIZ',
        dias: ['MARTES'],
        updatedAt: '2026-11-03T08:00:00Z'
      }
    };

    const visitasMap: Record<string, RegistroVisitaRuta> = {};

    const enriched = buildClientesRutaEnriquecidos({
      filteredActivacion,
      filteredVolumen,
      asignacionesMap,
      visitasMap,
      fechaISO: '2026-11-03'
    });

    expect(enriched).toHaveLength(3);
    // 1º: Inactivo (1002), 2º: Cierre 3/5 (1003), 3º: Completo 5/5 (1001)
    expect(enriched[0].clienteId).toBe('1002');
    expect(enriched[0].isActivoMes).toBe(false);
    expect(enriched[0].rubrosFaltantes).toHaveLength(5);

    expect(enriched[1].clienteId).toBe('1003');
    expect(enriched[1].totalRubrosActivos).toBe(3);
    // Faltan exactamente los 2 rubros nuevos sin compra (claves internas de servidor)
    expect((enriched[1].rubrosFaltantes as string[]).map((r) => RUBRO_SHORT_LABELS[r])).toEqual(['Mortadela Asturias', 'Salpicao']);
    expect(enriched[1].ejecutadoKgMes).toBe(145.5);

    expect(enriched[2].clienteId).toBe('1001');
    expect(enriched[2].totalRubrosActivos).toBe(5);
    expect(enriched[2].rubrosFaltantes).toHaveLength(0);
  });

  it('should equitably auto-distribute clients across Monday-Friday and compute daily KPIs', () => {
    const mockCartera = Array.from({ length: 10 }, (_, idx) => ({
      clienteKey: `VEND::${idx + 1}`,
      clienteId: String(idx + 1),
      clienteNombre: `CLIENTE ${idx + 1}`,
      vendedorId: 'VEND'
    }));

    const dist = autoDistribuirCarteraSemanal(mockCartera, {}, true);
    const countsByDay: Record<string, number> = {};
    Object.values(dist).forEach(a => {
      const d = a.dias[0];
      countsByDay[d] = (countsByDay[d] || 0) + 1;
    });

    // 10 clientes entre 5 días hábiles = exactamente 2 clientes por día
    expect(countsByDay.LUNES).toBe(2);
    expect(countsByDay.MARTES).toBe(2);
    expect(countsByDay.MIERCOLES).toBe(2);
    expect(countsByDay.JUEVES).toBe(2);
    expect(countsByDay.VIERNES).toBe(2);

    const visitasMap: Record<string, RegistroVisitaRuta> = {
      '2026-11-03::VEND::2': {
        id: '2026-11-03::VEND::2',
        fecha: '2026-11-03',
        diaSemana: 'MARTES',
        clienteKey: 'VEND::2',
        clienteId: '2',
        clienteNombre: 'CLIENTE 2',
        vendedorId: 'VEND',
        estado: 'EFECTIVA_PEDIDO',
        checkInTimestamp: '2026-11-03T10:00:00Z'
      }
    };

    const enriched = buildClientesRutaEnriquecidos({
      filteredActivacion: mockCartera.map(c => ({
        id: c.clienteId,
        vendedorId: c.vendedorId,
        cliente: c.clienteNombre,
        cats: {}
      })),
      filteredVolumen: [],
      asignacionesMap: dist,
      visitasMap,
      fechaISO: '2026-11-03'
    });

    const resumen = calcularResumenJornadaRuta({
      clientesEnriquecidos: enriched,
      diaSeleccionado: 'MARTES',
      fechaISO: '2026-11-03'
    });

    expect(resumen.totalCarteraVendedor).toBe(10);
    expect(resumen.totalConDiaAsignado).toBe(10);
    expect(resumen.programadosHoy).toBe(2);
    expect(resumen.visitadosHoy).toBe(1);
    expect(resumen.pendientesHoy).toBe(1);
    expect(resumen.efectivosPedidoHoy).toBe(1);
    expect(resumen.porcentajeAvanceRuta).toBe(50);
    expect(resumen.porcentajeEfectividad).toBe(100);
  });
});
