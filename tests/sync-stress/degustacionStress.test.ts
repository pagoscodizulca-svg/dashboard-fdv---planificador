import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { runDegustacionSyncStressSuite, FullStressSuiteReport } from './syncStressRunner';

describe('Stress & Concurrency QA: Degustaciones FDV -> Trade Marketing Sync (Warmup 1 -> Medium 15 -> Peak 40)', () => {
  let receptorServer: http.Server | null = null;
  let receptorBaseUrl = '';
  let fdvServer: ChildProcess | null = null;
  let fdvBaseUrl = '';

  // Estado en memoria del receptor Trade Marketing simulado (emula contrato HTTP de Render + deduplicación por id)
  const receptorStore = new Map<string, any>();
  let receptorTotalPostHits = 0;

  beforeAll(async () => {
    // 1. Levantar servidor receptor Trade Marketing en puerto efímero local
    receptorServer = http.createServer((req, res) => {
      const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'GET' && urlObj.pathname === '/api/health') {
        res.statusCode = 200;
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      if (req.method === 'GET' && urlObj.pathname === '/api/degustaciones') {
        res.statusCode = 200;
        res.end(JSON.stringify(Array.from(receptorStore.values())));
        return;
      }

      if (req.method === 'POST' && urlObj.pathname === '/api/degustaciones') {
        let raw = '';
        req.on('data', (chunk) => {
          raw += chunk;
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(raw || '{}');
            if (!parsed || !parsed.id) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Missing id' }));
              return;
            }
            receptorTotalPostHits++;
            receptorStore.set(String(parsed.id), parsed);
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: parsed.id, data: parsed }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
          }
        });
        return;
      }

      if (req.method === 'DELETE' && urlObj.pathname.startsWith('/api/degustaciones/')) {
        const targetId = decodeURIComponent(urlObj.pathname.replace('/api/degustaciones/', ''));
        const clean = targetId.replace(/^DEG-/, '');
        receptorStore.delete(targetId);
        receptorStore.delete(clean);
        receptorStore.delete(`DEG-${clean}`);
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, id: targetId }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    await new Promise<void>((resolve) => {
      receptorServer!.listen(0, '127.0.0.1', () => {
        const addr = receptorServer!.address() as any;
        receptorBaseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 2. Levantar servidor FDV Planificador compilado apuntando al receptor local (puerto 3019)
    const fdvPort = 3019;
    fdvBaseUrl = `http://127.0.0.1:${fdvPort}`;
    fdvServer = spawn('node', ['dist/server.cjs'], {
      env: {
        ...process.env,
        PORT: String(fdvPort),
        TRADE_MARKETING_API_URL: `${receptorBaseUrl}/api/degustaciones`,
        GERENCIA_TRADE_API_URL: `${receptorBaseUrl}/api/degustaciones`,
        GERENCIA_UTERIO_SURVEYS_URL: '',
        GERENCIA_UTERIO_ANON_KEY: '',
        GOOGLE_SCRIPT_WEBHOOK_URL: ''
      },
      stdio: 'ignore'
    });

    let healthy = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        const res = await fetch(`${fdvBaseUrl}/api/health`);
        if (res.ok) {
          healthy = true;
          break;
        }
      } catch {}
    }
    if (!healthy) {
      throw new Error('FDV server did not become healthy in time for stress test');
    }
  }, 20000);

  afterAll(async () => {
    if (fdvServer) {
      fdvServer.kill();
      fdvServer = null;
    }
    if (receptorServer) {
      await new Promise<void>((resolve) => receptorServer!.close(() => resolve()));
      receptorServer = null;
    }
  });

  it(
    'executes stepped bursts (Warmup: 1 -> Medium: 15 -> Peak: 40) across all 26 vendors with 100% 1:1 integrity, strict idempotency, and verified zero-residue teardown',
    async () => {
      const report: FullStressSuiteReport = await runDegustacionSyncStressSuite({
        fdvBaseUrl,
        receptorBaseUrl,
        warmupCount: 1,
        mediumCount: 15,
        peakCount: 40,
        idempotencyParallelCount: 5
      });

      console.log('\n=== [QA SYNC STRESS REPORT] ===');
      console.log(JSON.stringify(report, null, 2));

      // 1. Cobertura de todos los vendedores activos
      expect(report.activeVendorProfilesTested).toBeGreaterThanOrEqual(25);

      // 2. Cero tasa de error en todas las ráfagas (Warmup 1, Medium 15, Peak 40, Idempotency 5)
      for (const b of report.bursts) {
        expect(b.failed).toBe(0);
        expect(b.errorRatePct).toBe(0);
        expect(b.succeeded).toBe(b.total);
      }

      // 3. Integridad 1:1 (57 registros únicos: 1 + 15 + 40 + 1 idempotente)
      expect(report.integrity.expectedCount).toBe(57);
      expect(report.integrity.foundInFdvCount).toBe(57);
      expect(report.integrity.foundInReceptorCount).toBe(57);
      expect(report.integrity.exactFieldMatches).toBe(57);
      expect(report.integrity.duplicatesInFdv).toBe(0);
      expect(report.integrity.duplicatesInReceptor).toBe(0);
      expect(report.integrity.integrityPct).toBe(100);
      expect(report.integrity.mismatches).toEqual([]);

      // 4. Idempotencia estricta bajo 5 envíos paralelos con la misma X-Idempotency-Key
      expect(report.idempotency.passed).toBe(true);
      expect(report.idempotency.persistedCountInFdv).toBe(1);
      expect(report.idempotency.persistedCountInReceptor).toBe(1);
      // En el receptor solo debió ejecutarse 1 POST para los 5 clics paralelos (total 57 hits para 61 requests)
      expect(receptorTotalPostHits).toBe(57);

      // 5. Teardown obligatorio y verificado: 0 residuos sintéticos en FDV, receptor y data_degustaciones.json
      expect(report.teardown.clean).toBe(true);
      expect(report.teardown.deleteErrors).toBe(0);
      expect(report.teardown.remainingInFdv).toBe(0);
      expect(report.teardown.remainingInReceptor).toBe(0);
      expect(report.teardown.remainingInLocalJson).toBe(0);
    },
    120000
  );
});
