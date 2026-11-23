import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('PARTES 3 y 5: Integración HTTP en vivo — Webhook con SYNC_SECRET_TOKEN, SSE por vendedor y sync-status', () => {
  it('verifica autenticación constant-time en POST /api/sync/sheets-webhook, aislamiento SSE y cero falsas notificaciones en arranque', async () => {
    const port = 3102;
    const baseUrl = `http://127.0.0.1:${port}`;
    const testWebhookToken = 'test-sync-secret-token-2026-secure';

    // Verificar también que server.ts no retiene cachedWorkbook permanente en RAM
    const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    expect(serverSrc).not.toMatch(/let\s+cachedWorkbook\b/);
    expect(serverSrc).toMatch(/loadWorkbookTransient/);

    const child = spawn('node', ['dist/server.cjs'], {
      env: {
        ...process.env,
        PORT: String(port),
        SYNC_SECRET_TOKEN: testWebhookToken
      },
      stdio: 'ignore'
    });

    try {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 250));
        try {
          const h = await fetch(`${baseUrl}/api/health`);
          if (h.ok) break;
        } catch {}
      }

      // 1. POST /api/sync/sheets-webhook sin token -> 401
      const noAuthRes = await fetch(`${baseUrl}/api/sync/sheets-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'edit' })
      });
      expect(noAuthRes.status).toBe(401);

      // 2. POST /api/sync/sheets-webhook con token inválido -> 403
      const badAuthRes = await fetch(`${baseUrl}/api/sync/sheets-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-token-value'
        },
        body: JSON.stringify({ event: 'edit' })
      });
      expect(badAuthRes.status).toBe(403);

      // 3. POST /api/sync/sheets-webhook con Authorization: Bearer válido -> 202 con debounce 2000ms
      const okBearerRes = await fetch(`${baseUrl}/api/sync/sheets-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testWebhookToken}`
        },
        body: JSON.stringify({ event: 'edit', sheet: 'Volumen por SKU' })
      });
      expect(okBearerRes.status).toBe(202);
      const okBearerJson = await okBearerRes.json();
      expect(okBearerJson.success).toBe(true);
      expect(okBearerJson.queued).toBe(true);
      expect(okBearerJson.debounceMs).toBe(2000);

      // 4. POST /api/sync/sheets-webhook con header x-sync-token válido -> 202 (coalesce con timer anterior)
      const okHeaderRes = await fetch(`${baseUrl}/api/sync/sheets-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-token': testWebhookToken
        },
        body: JSON.stringify({ event: 'edit', sheet: 'Grid de Activación por Vendedor' })
      });
      expect(okHeaderRes.status).toBe(202);

      // 5. Autenticar como VENDEDOR (SAIRU VALLES)
      const vendLogin = await (
        await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'SAIRU VALLES', password: '18383237' })
        })
      ).json();
      expect(vendLogin.success).toBe(true);

      // 6. GET /api/vendedor/:sellerId/sync-status bloquea sin JWT (401) y bloquea otro vendedor (403)
      const unauthStatus = await fetch(`${baseUrl}/api/vendedor/SAIRU%20VALLES/sync-status`);
      expect(unauthStatus.status).toBe(401);

      const crossSellerStatus = await fetch(`${baseUrl}/api/vendedor/MARIA%20BRICENO/sync-status`, {
        headers: { Authorization: `Bearer ${vendLogin.token}` }
      });
      expect(crossSellerStatus.status).toBe(403);

      // Disparar primera sincronización inicial con ADMIN para hidratar sellerNumericTracker (version = 1 silenciosa)
      const adminLogin = await (
        await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'ADMIN', password: '123' })
        })
      ).json();
      expect(adminLogin.success).toBe(true);

      const initialSyncRes = await fetch(`${baseUrl}/api/sync/sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminLogin.token}`
        },
        body: JSON.stringify({ forceRebuild: true })
      });
      expect(initialSyncRes.status).toBe(200);

      const ownStatusRes = await fetch(`${baseUrl}/api/vendedor/SAIRU%20VALLES/sync-status`, {
        headers: { Authorization: `Bearer ${vendLogin.token}` }
      });
      expect(ownStatusRes.status).toBe(200);
      const ownStatusJson = await ownStatusRes.json();
      expect(typeof ownStatusJson.version).toBe('number');
      expect(ownStatusJson.version).toBeGreaterThanOrEqual(1);
      expect(typeof ownStatusJson.updatedAt).toBe('number');

      // 7. GET /api/vendedor/:sellerId/stream bloquea otro vendedor (403) y entrega SSE válido para el propio vendedor
      const crossStreamRes = await fetch(
        `${baseUrl}/api/vendedor/MARIA%20BRICENO/stream?token=${encodeURIComponent(vendLogin.token)}`
      );
      expect(crossStreamRes.status).toBe(403);

      const sseAbort = new AbortController();
      const sseRes = await fetch(
        `${baseUrl}/api/vendedor/SAIRU%20VALLES/stream?token=${encodeURIComponent(vendLogin.token)}`,
        { signal: sseAbort.signal }
      );
      expect(sseRes.status).toBe(200);
      expect(sseRes.headers.get('content-type')).toContain('text/event-stream');
      expect(sseRes.headers.get('cache-control')).toContain('no-cache');
      expect(sseRes.headers.get('x-accel-buffering')).toBe('no');

      const reader = sseRes.body!.getReader();
      const decoder = new TextDecoder();
      let sseChunk = '';
      const chunkResult = await Promise.race([
        reader.read(),
        new Promise<{ value?: Uint8Array; done: boolean }>((resolve) =>
          setTimeout(() => resolve({ done: true }), 4000)
        )
      ]);
      if (chunkResult.value) {
        sseChunk = decoder.decode(chunkResult.value, { stream: true });
      }
      sseAbort.abort();

      // Debe recibir `event: connected` con su versión inicial y JAMÁS `event: datos_actualizados` en frío
      expect(sseChunk).toContain('event: connected');
      expect(sseChunk).not.toContain('event: datos_actualizados');
    } finally {
      child.kill();
    }
  }, 30000);
});
