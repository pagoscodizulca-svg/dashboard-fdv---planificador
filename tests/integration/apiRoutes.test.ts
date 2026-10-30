import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import zlib from 'zlib';

describe('Integration: API Server Routes & Authentication Flow', () => {
  let baseUrl = 'http://localhost:3005';
  let adminToken: string = '';
  let vendorToken: string = '';
  let spawnedServer: ChildProcess | null = null;

  beforeAll(async () => {
    // Dynamically locate the running server (port 3005 fallback to 3000)
    let found = false;
    for (const port of [3005]) {
      try {
        const res = await fetch(`http://localhost:${port}/api/cadenas/sucursales`);
        if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
          baseUrl = `http://localhost:${port}`;
          found = true;
          break;
        }
      } catch {}
    }

    if (!found) {
      spawnedServer = spawn('node', ['dist/server.cjs'], {
        env: { ...process.env, PORT: '3005' },
        stdio: 'ignore'
      });
      baseUrl = 'http://localhost:3005';
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 250));
        try {
          const res = await fetch(`${baseUrl}/api/health`);
          if (res.ok) break;
        } catch {}
      }
    }
  }, 15000);

  afterAll(() => {
    if (spawnedServer) {
      spawnedServer.kill();
      spawnedServer = null;
    }
  });

  describe('GET /api/health', () => {
    it('should return 200 OK with status ok', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ status: 'ok' });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 Bad Request when credentials are missing', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('requeridos');
    });

    it('should return 401 Unauthorized for incorrect password', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ADMIN', password: 'WRONG_PASSWORD_999' })
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('incorrecta');
    });

    it('should return 401 Unauthorized for non-existent user', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'USER_THAT_DOES_NOT_EXIST', password: '123' })
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should successfully log in ADMIN user and return valid JWT token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ADMIN', password: '123' })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(typeof data.token).toBe('string');
      expect(data.token.length).toBeGreaterThan(20);
      expect(data.user).toBeDefined();
      expect(data.user.role).toBe('ADMIN');
      adminToken = data.token;
    });

    it('should successfully log in vendor SAIRU VALLES and return JWT with VENDEDOR role', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'SAIRU VALLES', password: '18383237' })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.username).toBe('SAIRU VALLES');
      expect(data.user.role).toBe('VENDEDOR');
      vendorToken = data.token;
    });
  });

  describe('JWT Protection on Endpoints', () => {
    it('GET /api/auth/me should return 401 when Authorization header is absent', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Token de autenticación requerido');
    });

    it('GET /api/auth/me should return 403 when token is corrupted or invalid', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: 'Bearer this.is.an.invalid.token' }
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Token inválido');
    });

    it('GET /api/auth/me should return 200 and authenticated profile with valid token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.username).toBe('ADMIN');
      expect(data.user.role).toBe('ADMIN');
    });
  });

  describe('POST /api/alkosto/pedidos/transmitir', () => {
    it('should return 401 when called without authentication token', async () => {
      const res = await fetch(`${baseUrl}/api/alkosto/pedidos/transmitir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'test-order' })
      });
      expect(res.status).toBe(401);
    });

    it('should return 400 when order payload is missing or invalid', async () => {
      const res = await fetch(`${baseUrl}/api/alkosto/pedidos/transmitir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${vendorToken}`
        },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Datos de pedido requeridos');
    });

    it('should return 400 when order has zero valid products with quantity > 0', async () => {
      const emptyItemsOrder = {
        id: `test-int-empty-${Date.now()}`,
        numeroPedido: '9999',
        sucursalCodigo: '7498',
        sucursalNombre: 'Alkosto 1 san Felipe',
        vendedora: 'Sairu Valles',
        items: [
          {
            sku: '1496',
            producto: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR',
            cantidadCajas: 0,
            precioUnitarioUSD: 20,
            subtotalUSD: 0
          }
        ]
      };

      const res = await fetch(`${baseUrl}/api/alkosto/pedidos/transmitir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${vendorToken}`
        },
        body: JSON.stringify(emptyItemsOrder)
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Validación previa/i);
    });

    it('should successfully homologate, confirm real DB id, enforce idempotency and clean up test order', async () => {
      const testId = `test-int-${Date.now()}`;
      const testOrder = {
        id: testId,
        idempotencyKey: testId,
        numeroPedido: '9999',
        correlativo: '9999',
        ordenCompraAlkosto: 'OC-TEST-INT-001',
        sucursalTag: 'AK01',
        sucursalCodigo: '7498',
        sucursalNombre: 'Alkosto 1 san Felipe',
        direccionEntrega: 'Calle 98 CC San Felipe',
        vendedora: 'SAIRU VALLES',
        ruta: 'CUENTAS CLAVE 2',
        fechaPedido: new Date().toISOString().split('T')[0],
        fechaEntregaEstimada: new Date().toISOString().split('T')[0],
        items: [
          {
            sku: '1496',
            producto: 'MORTADELA ESP D/POLLO ASTURIAS 10UNDX900GR',
            bultos: 2,
            kilos: 18,
            descuento: 5,
            precioUnitarioUSD: 24.50,
            subtotalUSD: 49.00
          }
        ],
        totalBultos: 2,
        totalKilos: 18,
        totalUSD: 49.00,
        estado: 'PENDIENTE',
        condicionPago: 'Crédito 15 días',
        contactoRecepcion: 'Recepción Zona Ind',
        telefonoRecepcion: '04140000000',
        observaciones: 'Prueba de integración automatizada QA'
      };

      try {
        // Simular doble clic concurrente con la misma clave de idempotencia
        const [res1, res2] = await Promise.all([
          fetch(`${baseUrl}/api/alkosto/pedidos/transmitir`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': testId,
              Authorization: `Bearer ${vendorToken}`
            },
            body: JSON.stringify(testOrder)
          }),
          fetch(`${baseUrl}/api/alkosto/pedidos/transmitir`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': testId,
              Authorization: `Bearer ${vendorToken}`
            },
            body: JSON.stringify(testOrder)
          })
        ]);

        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);
        const data1 = await res1.json();
        const data2 = await res2.json();

        expect(data1.success).toBe(true);
        expect(data1.salaEsperaId).toBe(testId);
        expect(data1.id).toBe(testId);
        expect(data1.data.vendedor).toBe('Sairu Valles');
        expect(data1.data.vendedora).toBe('Sairu Valles');
        expect(data1.data.cadena).toBe('ALKOSTO');
        expect(data1.data.estadoSalaEspera).toBe('POR_VALIDAR');
        expect(data1.data.transmitido_a_pedidos_manuales).toBe(true);
        expect(data1.message).toContain(testId);

        // Idempotencia: ambos clics concurrentes devuelven exactamente el mismo ID y correlativo
        expect(data2.salaEsperaId).toBe(data1.salaEsperaId);
        expect(data2.data.correlativo).toBe(data1.data.correlativo);
      } finally {
        // Limpiar el pedido de prueba de las bases de datos local y Sala de Espera
        await fetch(`${baseUrl}/api/alkosto/pedidos/${encodeURIComponent(testId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${vendorToken}` }
        }).catch(() => {});
      }
    });
  });

  describe('POST /api/alkosto/ocr-orden (Extracción 100% Exacta de Orden de Compra)', () => {
    function buildAlkostoPdfBase64(lines: string[]): string {
      const encodeGlyphs = (line: string) =>
        Array.from(line)
          .map(ch => `<${(ch.charCodeAt(0) - 29).toString(16).padStart(4, '0').toUpperCase()}>`)
          .join('');

      const btBlocks = lines
        .map((ln, idx) => `BT /F1 9.28 Tf 1 0 0 -1 20 ${(idx + 1) * 14} Tm [${encodeGlyphs(ln)}] TJ ET`)
        .join('\n');

      const compressed = zlib.deflateSync(Buffer.from(btBlocks, 'latin1'));
      const header = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length ' + compressed.length + ' /Filter /FlateDecode >>\nstream\n', 'latin1');
      const footer = Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1');
      return Buffer.concat([header, compressed, footer]).toString('base64');
    }

    it('should return 400 when imageBase64 is missing', async () => {
      const res = await fetch(`${baseUrl}/api/alkosto/ocr-orden`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${vendorToken}`
        },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
    });

    it('should extract 100% exact structured JSON (ordenNro, SKUs, unidades CJ/UND/KG y tiendas) from a real OC document', async () => {
      const ocLines = [
        'ALKOSTO DONDE COMPRAR ES GANAR, C.A. - SEDE: AKOP',
        'RIF: J-413243580',
        'Dias de Credito',
        ' 21',
        'Orden Nro.: 0000055165',
        'TASA DE CAMBIO: 881.0664',
        'Emision 19/10/2026',
        'Entrega 22/10/2026',
        'EMP AK01 AK02 AK03 AK04 AK05 AK06 AK07 AK08 AK09 AK10 Cantidad',
        '7590377000077 MORTADELA ESPECIAL DE POLLO 900GR ASTURIAS / 2.40',
        ' 0.00 10.00 0.00 0.00 10.00 10 0.00 10.00 20.00 0.00 0.00 10.00 0.00 0.00 60.00 20.0000 0.00 0.00 0.00 20.0000 1,200.00',
        '7591289400023 NUGGETS DE POLLO DEL CORRAL 460GR / 5.84',
        ' 16.00 0.00 0.00 0.00 24.00 0 0.00 0.00 36.00 0.00 12.00 12.00 0.00 0.00 84.00 3.8800 0.00 0.00 0.00 3.8800 325.92',
        '100881 PECHUGA DE PAVO ASTURIAS X KG / 6.88',
        ' 0.00 78.00 65.00 104.00 78.00 0 0.00 65.00 104.00 39.00 130.00 104.00 0.00 0.00 767.00 5.5000 0.00 0.00 0.00 5.5000 4,218.50',
        'SubTotal ( AK ) 5,744.42'
      ];

      const pdfBase64 = buildAlkostoPdfBase64(ocLines);

      const res = await fetch(`${baseUrl}/api/alkosto/ocr-orden`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${vendorToken}`
        },
        body: JSON.stringify({
          imageBase64: pdfBase64,
          mimeType: 'application/pdf'
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.ordenNro).toBe('0000055165');
      expect(body.data.items).toHaveLength(3);

      // Renglón 1: Bulto / Caja ("CJ") -> SKU 1496
      expect(body.data.items[0]).toMatchObject({
        codigo: '1496',
        skuCodizulca: '1496',
        unid: 'CJ',
        totalCantidad: 60,
        costoUnitario: 20,
        totalRenglon: 1200
      });

      // Renglón 2: Unidades ("UND") -> SKU 047
      expect(body.data.items[1]).toMatchObject({
        codigo: '047',
        skuCodizulca: '047',
        unid: 'UND',
        totalCantidad: 84,
        costoUnitario: 3.88,
        totalRenglon: 325.92
      });

      // Renglón 3: Kilogramos ("KG") -> SKU 1512
      expect(body.data.items[2]).toMatchObject({
        codigo: '1512',
        skuCodizulca: '1512',
        unid: 'KG',
        totalCantidad: 767,
        costoUnitario: 5.5,
        totalRenglon: 4218.5
      });
    });
  });

  describe('Middleware Error Handling: Malformed JSON', () => {
    it('should handle malformed JSON bodies gracefully with 400 Bad Request instead of 500 crash', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"username": "ADMIN", malformed_json_without_quotes}'
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('JSON malformado');
    });
  });

  describe('Data Synchronization & Filtering Endpoints', () => {
    it('GET /api/data/metas-activacion should return all vendor metas for ADMIN', async () => {
      const res = await fetch(`${baseUrl}/api/data/metas-activacion`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(50);
    }, 15000);

    it('GET /api/data/metas-activacion should resolve CONSOLIDATED vendor filter accurately', async () => {
      const res = await fetch(`${baseUrl}/api/data/metas-activacion?vendedor=${encodeURIComponent('CONSOLIDATED:JUAN HERNANDEZ')}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((m: any) => m.vendedorId === 'JUAN HERNANDEZ')).toBe(true);
    }, 15000);

    it('GET /api/data/activacion and /api/data/volumen should return synchronized data', async () => {
      const [actRes, volRes] = await Promise.all([
        fetch(`${baseUrl}/api/data/activacion?vendedor=${encodeURIComponent('CONSOLIDATED:JUAN HERNANDEZ')}`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        }),
        fetch(`${baseUrl}/api/data/volumen?vendedor=${encodeURIComponent('CONSOLIDATED:JUAN HERNANDEZ')}`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      ]);
      expect(actRes.status).toBe(200);
      expect(volRes.status).toBe(200);
      const actData = await actRes.json();
      const volData = await volRes.json();
      expect(actData.length).toBeGreaterThan(100);
      expect(volData.length).toBeGreaterThan(10);
    }, 15000);

    it('GET /api/historial/rubro-360 should return real 360 historical dashboard data for a rubro and vendor', async () => {
      const res = await fetch(
        `${baseUrl}/api/historial/rubro-360?rubro=AZUCAR&vendedor=${encodeURIComponent('CONSOLIDATED:JUAN HERNANDEZ')}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.rubro).toBe('AZUCAR');
      expect(Array.isArray(data.meses)).toBe(true);
      expect(data.meses.length).toBeGreaterThanOrEqual(8);
      expect(Array.isArray(data.skus)).toBe(true);
      expect(data.skus.length).toBeGreaterThan(0);
      expect(Array.isArray(data.clientes)).toBe(true);
      expect(data.clientes.length).toBeGreaterThan(0);
      expect(data.resumen.totalKgsHistorico).toBeGreaterThan(0);
      expect(data.resumen.mejorMes).not.toBeNull();
      // El monto ($) ya no forma parte del dashboard 360
      expect(data.resumen.totalMontoHistorico).toBeUndefined();
      expect(data.meses[0].monto).toBeUndefined();
      expect(data.skus[0].totalMonto).toBeUndefined();
      // Meta por mes: solo existe donde fue registrada (null si no hay dato real)
      expect(Array.isArray(data.metasPorMes)).toBe(true);
      data.meses.forEach((m: any) => {
        expect(m.meta === null || typeof m.meta === 'number').toBe(true);
      });
      expect(data.metasPorMes.length).toBeGreaterThan(0);
      expect(data.metaMesActual).toBeGreaterThan(0);
      // El estado del mes en curso sale de activacion_clientes (has_<rubro>): debe haber clientes activos reales
      expect(data.clientes.some((c: any) => c.activoMesActual)).toBe(true);
      expect(Array.isArray(data.periodosDisponibles)).toBe(true);
      expect(data.periodosDisponibles.length).toBeGreaterThanOrEqual(8);
    }, 20000);

    it('GET /api/historial/rubro-360 respeta el filtro de meses (?meses=) sin alterar los meses disponibles', async () => {
      const base = `${baseUrl}/api/historial/rubro-360?rubro=AZUCAR&vendedor=${encodeURIComponent('CONSOLIDATED:JUAN HERNANDEZ')}`;
      const headers = { Authorization: `Bearer ${adminToken}` };
      const todos = await (await fetch(base, { headers })).json();

      const dos = await (await fetch(`${base}&meses=${encodeURIComponent('2026-3,2026-4')}`, { headers })).json();
      expect(dos.meses.map((m: any) => `${m.ano}-${m.mes}`)).toEqual(['2026-3', '2026-4']);
      expect(dos.periodosDisponibles.length).toBe(todos.periodosDisponibles.length);
      const marzoTodos = todos.meses.find((m: any) => m.mes === 3);
      const marzoFiltro = dos.meses.find((m: any) => m.mes === 3);
      expect(marzoFiltro.clientesActivados).toBe(marzoTodos.clientesActivados);
      expect(marzoFiltro.kgs).toBe(marzoTodos.kgs);
      // Los totales del filtro son la suma exacta de los meses elegidos
      expect(dos.resumen.totalKgsHistorico).toBeCloseTo(
        todos.meses.filter((m: any) => m.mes === 3 || m.mes === 4).reduce((a: number, m: any) => a + m.kgs, 0), 1
      );

      const ninguno = await (await fetch(`${base}&meses=none`, { headers })).json();
      expect(ninguno.meses).toHaveLength(0);
      expect(ninguno.periodosDisponibles.length).toBe(todos.periodosDisponibles.length);
    }, 30000);
  });

  describe('POST /api/ocr (Agente Experto en Auditoría Bancaria Venezolana)', () => {
    it('should audit a Banesco Pago Móvil PDF receipt and return the exact 15-field mandatory JSON schema', async () => {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text('Banesco - Operacion Exitosa', 20, 20);
      doc.setFontSize(11);
      doc.text('Pago Movil', 20, 30);
      doc.text('Bs. 203.242,47', 20, 40);
      doc.text('Fecha: 29/10/2026 06:54:03 PM', 20, 50);
      doc.text('Banco Destino: 0134 - Banesco', 20, 60);
      doc.text('Beneficiario: CODIZULCA C.A.', 20, 70);
      doc.text('RIF: J-40987613-6', 20, 80);
      doc.text('Telefono: 0414-6123456', 20, 90);
      doc.text('Numero de Referencia: 460284758160', 20, 100);

      const pdfArrayBuffer = doc.output('arraybuffer');
      const pdfBase64 = Buffer.from(pdfArrayBuffer).toString('base64');

      const res = await fetch(`${baseUrl}/api/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          imageBase64: pdfBase64,
          mimeType: 'application/pdf'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toMatchObject({
        legible: true,
        metodo_pago: 'Pago Móvil',
        banco: 'Banesco',
        banco_origen: null,
        banco_destino: 'Banesco',
        monto_bs: 203242.47,
        nro_referencia: '460284758160',
        fecha_pago: '29/10/2026',
        fecha_iso: '2026-10-29',
        titular_remitente: null,
        rif_ci_titular: null,
        beneficiario_detectado: 'CODIZULCA C.A.'
      });
      expect(typeof data.confianza).toBe('number');
      expect(typeof data.observacion_ia).toBe('string');
    }, 25000);
  });
});
