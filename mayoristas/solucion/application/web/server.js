'use strict';

// DistribuTech — servidor API REST único para el prototipo.
// Expone los endpoints de las 3 organizaciones y un set público para el
// cliente final. Internamente abre una conexión Gateway por org al
// arrancar y la reutiliza en cada request.

const express = require('express');
const morgan = require('morgan');
const path = require('path');
const { connectAsOrg, decodeJSON } = require('../utils/fabric-connection');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ORGS = ['fabricante', 'mayorista', 'minorista'];

// ── Pool de conexiones Gateway ───────────────────────────────────
const connections = {};

async function initConnections() {
    for (const org of ORGS) {
        process.stdout.write(`  Conectando a ${org}... `);
        connections[org] = await connectAsOrg(org);
        console.log('OK');
    }
}

function closeConnections() {
    for (const ctx of Object.values(connections)) {
        try { ctx.close(); } catch (_) { /* noop */ }
    }
}

// Envuelve handlers async para que los errores caigan en el error handler.
const wrap = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// ── App ──────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(morgan('dev'));

// Sirve estáticos del frontend.
app.use(express.static(path.join(__dirname, 'public')));

// Sirve la documentación junto al frontend para que los enlaces del footer
// (API.md, openapi.yaml) funcionen desde el navegador.
app.get('/API.md',      (_req, res) => res.sendFile(path.join(__dirname, 'API.md')));
app.get('/openapi.yaml', (_req, res) => res.sendFile(path.join(__dirname, 'openapi.yaml')));

// ── Health ───────────────────────────────────────────────────────
app.get('/api/health', wrap(async (_req, res) => {
    res.json({ status: 'ok', orgs: Object.keys(connections) });
}));

// ════════════════════════════════════════════════════════════════
//   FABRICANTE
// ════════════════════════════════════════════════════════════════
app.post('/api/fabricante/registrar-producto', wrap(async (req, res) => {
    const { serie, modelo, lote } = req.body;
    const cc = connections.fabricante.getContract('canal-trazabilidad', 'cc-producto');
    await cc.submitTransaction('RegistrarProducto', serie, modelo, lote);
    res.json({ ok: true, serie });
}));

app.post('/api/fabricante/transferir-custodia', wrap(async (req, res) => {
    const { serie, destinoMSP } = req.body;
    const cc = connections.fabricante.getContract('canal-trazabilidad', 'cc-producto');
    await cc.submitTransaction('TransferirCustodia', serie, destinoMSP);
    res.json({ ok: true });
}));

app.post('/api/fabricante/aceptar-pedido', wrap(async (req, res) => {
    const { pedidoId } = req.body;
    const cc = connections.fabricante.getContract('canal-mayorista', 'cc-pedido');
    await cc.submitTransaction('AceptarPedido', pedidoId);
    res.json({ ok: true });
}));

app.post('/api/fabricante/registrar-envio', wrap(async (req, res) => {
    const { pedidoId, tracking } = req.body;
    const cc = connections.fabricante.getContract('canal-mayorista', 'cc-pedido');
    await cc.submitTransaction('RegistrarEnvio', pedidoId, tracking);
    res.json({ ok: true });
}));

app.post('/api/fabricante/resolver-reclamacion', wrap(async (req, res) => {
    const { reclamacionId, resolucion, aceptada } = req.body;
    const cc = connections.fabricante.getContract('canal-trazabilidad', 'cc-garantia');
    await cc.submitTransaction('ResolverReclamacion', reclamacionId, resolucion, String(aceptada));
    res.json({ ok: true });
}));

app.get('/api/fabricante/producto/:serie', wrap(async (req, res) => {
    const cc = connections.fabricante.getContract('canal-trazabilidad', 'cc-producto');
    const data = await cc.evaluateTransaction('ConsultarProducto', req.params.serie);
    res.json(decodeJSON(data));
}));

app.get('/api/fabricante/pedido/:id', wrap(async (req, res) => {
    const cc = connections.fabricante.getContract('canal-mayorista', 'cc-pedido');
    const data = await cc.evaluateTransaction('ConsultarPedido', req.params.id);
    res.json(decodeJSON(data));
}));

// ════════════════════════════════════════════════════════════════
//   MAYORISTA
// ════════════════════════════════════════════════════════════════
app.post('/api/mayorista/crear-pedido-fabricante', wrap(async (req, res) => {
    const { pedidoId, lineas } = req.body;
    const cc = connections.mayorista.getContract('canal-mayorista', 'cc-pedido');
    await cc.submitTransaction('CrearPedido', pedidoId, JSON.stringify(lineas));
    res.json({ ok: true, pedidoId });
}));

app.post('/api/mayorista/confirmar-recepcion-fabricante', wrap(async (req, res) => {
    const { pedidoId } = req.body;
    const cc = connections.mayorista.getContract('canal-mayorista', 'cc-pedido');
    await cc.submitTransaction('ConfirmarRecepcion', pedidoId);
    res.json({ ok: true });
}));

app.post('/api/mayorista/transferir-custodia', wrap(async (req, res) => {
    const { serie, destinoMSP } = req.body;
    const cc = connections.mayorista.getContract('canal-trazabilidad', 'cc-producto');
    await cc.submitTransaction('TransferirCustodia', serie, destinoMSP);
    res.json({ ok: true });
}));

app.post('/api/mayorista/aceptar-pedido-minorista', wrap(async (req, res) => {
    const { pedidoId } = req.body;
    const cc = connections.mayorista.getContract('canal-minorista', 'cc-pedido');
    await cc.submitTransaction('AceptarPedido', pedidoId);
    res.json({ ok: true });
}));

app.post('/api/mayorista/registrar-envio-minorista', wrap(async (req, res) => {
    const { pedidoId, tracking } = req.body;
    const cc = connections.mayorista.getContract('canal-minorista', 'cc-pedido');
    await cc.submitTransaction('RegistrarEnvio', pedidoId, tracking);
    res.json({ ok: true });
}));

app.get('/api/mayorista/producto/:serie', wrap(async (req, res) => {
    const cc = connections.mayorista.getContract('canal-trazabilidad', 'cc-producto');
    const data = await cc.evaluateTransaction('ConsultarProducto', req.params.serie);
    res.json(decodeJSON(data));
}));

app.get('/api/mayorista/pedido-fabricante/:id', wrap(async (req, res) => {
    const cc = connections.mayorista.getContract('canal-mayorista', 'cc-pedido');
    const data = await cc.evaluateTransaction('ConsultarPedido', req.params.id);
    res.json(decodeJSON(data));
}));

app.get('/api/mayorista/pedido-minorista/:id', wrap(async (req, res) => {
    const cc = connections.mayorista.getContract('canal-minorista', 'cc-pedido');
    const data = await cc.evaluateTransaction('ConsultarPedido', req.params.id);
    res.json(decodeJSON(data));
}));

// ════════════════════════════════════════════════════════════════
//   MINORISTA
// ════════════════════════════════════════════════════════════════
app.post('/api/minorista/crear-pedido-mayorista', wrap(async (req, res) => {
    const { pedidoId, lineas } = req.body;
    const cc = connections.minorista.getContract('canal-minorista', 'cc-pedido');
    await cc.submitTransaction('CrearPedido', pedidoId, JSON.stringify(lineas));
    res.json({ ok: true, pedidoId });
}));

app.post('/api/minorista/confirmar-recepcion-mayorista', wrap(async (req, res) => {
    const { pedidoId } = req.body;
    const cc = connections.minorista.getContract('canal-minorista', 'cc-pedido');
    await cc.submitTransaction('ConfirmarRecepcion', pedidoId);
    res.json({ ok: true });
}));

app.post('/api/minorista/activar-garantia', wrap(async (req, res) => {
    const { serie, clienteFinal, meses } = req.body;
    const cc = connections.minorista.getContract('canal-trazabilidad', 'cc-garantia');
    await cc.submitTransaction('ActivarGarantia', serie, clienteFinal, String(meses));
    res.json({ ok: true });
}));

app.post('/api/minorista/reclamar-garantia', wrap(async (req, res) => {
    const { serie, motivo } = req.body;
    const cc = connections.minorista.getContract('canal-trazabilidad', 'cc-garantia');
    const data = await cc.submitTransaction('ReclamarGarantia', serie, motivo);
    res.json({ ok: true, reclamacionId: new TextDecoder().decode(data) });
}));

app.get('/api/minorista/producto/:serie', wrap(async (req, res) => {
    const cc = connections.minorista.getContract('canal-trazabilidad', 'cc-producto');
    const data = await cc.evaluateTransaction('ConsultarProducto', req.params.serie);
    res.json(decodeJSON(data));
}));

app.get('/api/minorista/garantia/:serie', wrap(async (req, res) => {
    const cc = connections.minorista.getContract('canal-trazabilidad', 'cc-garantia');
    const data = await cc.evaluateTransaction('ConsultarGarantia', req.params.serie);
    res.json(decodeJSON(data));
}));

app.get('/api/minorista/pedido/:id', wrap(async (req, res) => {
    const cc = connections.minorista.getContract('canal-minorista', 'cc-pedido');
    const data = await cc.evaluateTransaction('ConsultarPedido', req.params.id);
    res.json(decodeJSON(data));
}));

// ════════════════════════════════════════════════════════════════
//   DASHBOARD — listados agregados para la vista kanban
// ════════════════════════════════════════════════════════════════
// Usa la identidad del Mayorista (única org presente en los 3 canales)
// para obtener todo el estado de la red en una llamada.

app.get('/api/dashboard', wrap(async (_req, res) => {
    const ctxMay = connections.mayorista;
    const [productos, pedMay, pedMin, garantias, reclamaciones] = await Promise.all([
        ctxMay.getContract('canal-trazabilidad', 'cc-producto').evaluateTransaction('ListarProductos'),
        ctxMay.getContract('canal-mayorista',    'cc-pedido')  .evaluateTransaction('ListarPedidos'),
        ctxMay.getContract('canal-minorista',    'cc-pedido')  .evaluateTransaction('ListarPedidos'),
        ctxMay.getContract('canal-trazabilidad', 'cc-garantia').evaluateTransaction('ListarGarantias'),
        ctxMay.getContract('canal-trazabilidad', 'cc-garantia').evaluateTransaction('ListarReclamaciones'),
    ]);
    res.json({
        productos:        decodeJSON(productos) || [],
        pedidosMayorista: decodeJSON(pedMay) || [],
        pedidosMinorista: decodeJSON(pedMin) || [],
        garantias:        decodeJSON(garantias) || [],
        reclamaciones:    decodeJSON(reclamaciones) || [],
    });
}));

// Detalle de un pedido (auto-detecta el canal si no se especifica)
app.get('/api/pedido/:id', wrap(async (req, res) => {
    const ctxMay = connections.mayorista;
    const id = req.params.id;
    // Probamos primero en canal-mayorista, luego en canal-minorista
    try {
        const data = await ctxMay.getContract('canal-mayorista', 'cc-pedido')
            .evaluateTransaction('ConsultarPedido', id);
        const pedido = decodeJSON(data);
        if (pedido) return res.json({ ...pedido, canal: 'canal-mayorista' });
    } catch (_) { /* intenta otro canal */ }
    try {
        const data = await ctxMay.getContract('canal-minorista', 'cc-pedido')
            .evaluateTransaction('ConsultarPedido', id);
        const pedido = decodeJSON(data);
        if (pedido) return res.json({ ...pedido, canal: 'canal-minorista' });
    } catch (_) { /* nada */ }
    res.status(404).json({ error: `Pedido ${id} no encontrado` });
}));

// Detalle completo de un producto: estado + trazabilidad + garantía si existe
app.get('/api/producto/:serie/detalle', wrap(async (req, res) => {
    const ctx = connections.mayorista;
    const serie = req.params.serie;
    const [productoR, trazaR, garantiaR] = await Promise.allSettled([
        ctx.getContract('canal-trazabilidad', 'cc-producto').evaluateTransaction('ConsultarProducto', serie),
        ctx.getContract('canal-trazabilidad', 'cc-producto').evaluateTransaction('VerificarAutenticidad', serie),
        ctx.getContract('canal-trazabilidad', 'cc-garantia').evaluateTransaction('ConsultarGarantia', serie),
    ]);
    if (productoR.status !== 'fulfilled') {
        return res.status(404).json({ error: `Producto ${serie} no encontrado` });
    }
    res.json({
        producto: decodeJSON(productoR.value),
        transferencias: trazaR.status === 'fulfilled' ? (decodeJSON(trazaR.value) || []) : [],
        garantia: garantiaR.status === 'fulfilled' ? decodeJSON(garantiaR.value) : null,
    });
}));

// ════════════════════════════════════════════════════════════════
//   PÚBLICO (cliente final, sin autenticación)
// ════════════════════════════════════════════════════════════════
// Usa internamente la identidad del minorista para consultar el ledger.
// Solo expone información que el cliente final puede ver (no precios ni
// datos comerciales). Pensado para el QR del producto.

app.get('/api/public/producto/:serie', wrap(async (req, res) => {
    const cc = connections.minorista.getContract('canal-trazabilidad', 'cc-producto');
    const data = await cc.evaluateTransaction('ConsultarProducto', req.params.serie);
    const producto = decodeJSON(data);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({
        numeroSerie: producto.numeroSerie,
        modelo: producto.modelo,
        lote: producto.lote,
        fechaFabricacion: producto.fechaFabricacion,
        estado: producto.estado,
    });
}));

app.get('/api/public/garantia/:serie', wrap(async (req, res) => {
    const cc = connections.minorista.getContract('canal-trazabilidad', 'cc-garantia');
    try {
        const data = await cc.evaluateTransaction('ConsultarGarantia', req.params.serie);
        res.json(decodeJSON(data));
    } catch (err) {
        if (/no existe/i.test(err.message)) return res.status(404).json({ error: 'Sin garantía' });
        throw err;
    }
}));

app.get('/api/public/trazabilidad/:serie', wrap(async (req, res) => {
    const cc = connections.minorista.getContract('canal-trazabilidad', 'cc-producto');
    const data = await cc.evaluateTransaction('VerificarAutenticidad', req.params.serie);
    res.json({
        numeroSerie: req.params.serie,
        autenticidad: 'verificada',
        transferencias: decodeJSON(data) || [],
    });
}));

// ── Error handler ────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
    console.error(`[ERROR] ${req.method} ${req.path}: ${err.message}`);
    if (err.details && Array.isArray(err.details)) {
        for (const d of err.details) {
            console.error(`  - ${d.mspId || d.address}: ${d.message}`);
        }
    }
    const status = /no existe|no encontrad/i.test(err.message) ? 404 : 500;
    res.status(status).json({ error: err.message });
});

// ── Arranque ─────────────────────────────────────────────────────
async function main() {
    console.log('DistribuTech API — abriendo conexiones Gateway:');
    await initConnections();
    const server = app.listen(PORT, () => {
        console.log(`\n  Escuchando en http://localhost:${PORT}`);
        console.log(`  Endpoints:    /api/health, /api/fabricante/*, /api/mayorista/*, /api/minorista/*, /api/public/*`);
        console.log(`  Ctrl+C para parar.\n`);
    });

    const shutdown = (sig) => {
        console.log(`\nRecibido ${sig}, apagando...`);
        server.close(() => {
            closeConnections();
            process.exit(0);
        });
        setTimeout(() => { closeConnections(); process.exit(1); }, 5000).unref();
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
    console.error('Error fatal al arrancar:', err);
    process.exit(1);
});
