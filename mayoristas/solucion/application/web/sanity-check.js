'use strict';

// Sanity check de la API REST.
// Arranca el servidor como subproceso (a no ser que ya esté corriendo en el
// PORT objetivo), ejecuta el flujo completo via HTTP y lo apaga al terminar.
//
// Uso:
//   node web/sanity-check.js                # arranca servidor temporal
//   PORT=4000 node web/sanity-check.js      # contra otro puerto
//   NO_SPAWN=1 node web/sanity-check.js     # supone server ya corriendo

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE = `http://localhost:${PORT}`;
const NO_SPAWN = process.env.NO_SPAWN === '1';
const STARTUP_TIMEOUT_MS = 30000;

const COLORS = {
    reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
    yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m',
};
const tty = process.stdout.isTTY;
const c = (text, color) => (tty ? `${COLORS[color]}${text}${COLORS.reset}` : text);

let pass = 0, fail = 0, warn = 0;
const okMsg   = (m) => { pass++; console.log(`  ${c('[OK]  ', 'green')} ${m}`); };
const failMsg = (m) => { fail++; console.log(`  ${c('[FAIL]', 'red')} ${m}`); };
const warnMsg = (m) => { warn++; console.log(`  ${c('[WARN]', 'yellow')} ${m}`); };
const info    = (m) => console.log(`  ${c('[INFO]', 'cyan')} ${m}`);
const section = (title) => console.log(`\n${c(title, 'cyan')}`);

// ── HTTP helpers ─────────────────────────────────────────────────
function request(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost', port: PORT, path: urlPath, method,
            headers: data
                ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
                : {},
        };
        const req = http.request(opts, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString();
                let json;
                try { json = text ? JSON.parse(text) : null; } catch { json = text; }
                resolve({ status: res.statusCode, body: json });
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function expectOk(label, method, urlPath, body) {
    const res = await request(method, urlPath, body);
    if (res.status >= 200 && res.status < 300) {
        okMsg(`${label} (HTTP ${res.status})`);
        return res.body;
    }
    failMsg(`${label} — HTTP ${res.status}: ${JSON.stringify(res.body)}`);
    return null;
}

async function waitForServer(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await request('GET', '/api/health');
            if (res.status === 200) return true;
        } catch (_) { /* aún no responde */ }
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
}

// ── Lanzamiento del servidor ─────────────────────────────────────
let child = null;

async function startServer() {
    return new Promise((resolve, reject) => {
        const serverPath = path.join(__dirname, 'server.js');
        child = spawn(process.execPath, [serverPath], {
            env: { ...process.env, PORT: String(PORT) },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let buf = '';
        child.stdout.on('data', (d) => {
            buf += d.toString();
            if (buf.includes('Escuchando en')) resolve();
        });
        child.stderr.on('data', (d) => { buf += d.toString(); });
        child.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Servidor salió con código ${code}\n${buf}`));
        });
        setTimeout(() => reject(new Error(`Timeout esperando al servidor:\n${buf}`)),
            STARTUP_TIMEOUT_MS);
    });
}

function stopServer() {
    if (child) {
        child.kill('SIGINT');
        child = null;
    }
}

// ── Flujo end-to-end ─────────────────────────────────────────────
async function runFlow() {
    const stamp = Date.now();
    const serie   = `API-PROD-${stamp}`;
    const pedMay  = `API-PED-MAY-${stamp}`;
    const pedMin  = `API-PED-MIN-${stamp}`;
    const cliente = `cliente-api-${stamp}`;

    section('1. Health');
    await expectOk('GET /api/health', 'GET', '/api/health');

    section('2. Flujo completo (Fabricante → Mayorista → Minorista → Cliente)');

    await expectOk('Fabricante registra producto',
        'POST', '/api/fabricante/registrar-producto',
        { serie, modelo: 'GPU-API', lote: 'LOTE-API-001' });

    await expectOk('Mayorista crea pedido al fabricante',
        'POST', '/api/mayorista/crear-pedido-fabricante',
        { pedidoId: pedMay, lineas: [{ producto: serie, cantidad: 1, precio: 100 }] });

    await expectOk('Fabricante acepta pedido',
        'POST', '/api/fabricante/aceptar-pedido', { pedidoId: pedMay });

    await expectOk('Fabricante registra envío',
        'POST', '/api/fabricante/registrar-envio',
        { pedidoId: pedMay, tracking: 'TRK-MAY-001' });

    await expectOk('Mayorista confirma recepción',
        'POST', '/api/mayorista/confirmar-recepcion-fabricante', { pedidoId: pedMay });

    await expectOk('Fabricante transfiere custodia → MayoristaMSP',
        'POST', '/api/fabricante/transferir-custodia',
        { serie, destinoMSP: 'MayoristaMSP' });

    await expectOk('Minorista crea pedido al mayorista',
        'POST', '/api/minorista/crear-pedido-mayorista',
        { pedidoId: pedMin, lineas: [{ producto: serie, cantidad: 1, precio: 150 }] });

    await expectOk('Mayorista acepta pedido del minorista',
        'POST', '/api/mayorista/aceptar-pedido-minorista', { pedidoId: pedMin });

    await expectOk('Mayorista registra envío al minorista',
        'POST', '/api/mayorista/registrar-envio-minorista',
        { pedidoId: pedMin, tracking: 'TRK-MIN-001' });

    await expectOk('Minorista confirma recepción',
        'POST', '/api/minorista/confirmar-recepcion-mayorista', { pedidoId: pedMin });

    await expectOk('Mayorista transfiere custodia → MinoristaMSP',
        'POST', '/api/mayorista/transferir-custodia',
        { serie, destinoMSP: 'MinoristaMSP' });

    await expectOk('Minorista activa garantía',
        'POST', '/api/minorista/activar-garantia',
        { serie, clienteFinal: cliente, meses: 24 });

    section('3. Endpoints públicos (cliente final)');

    const producto = await expectOk('GET /api/public/producto/:serie',
        'GET', `/api/public/producto/${serie}`);
    if (producto && producto.modelo === 'GPU-API') {
        okMsg('  → contiene los datos del producto');
    } else {
        failMsg(`  → datos inesperados: ${JSON.stringify(producto)}`);
    }

    const garantia = await expectOk('GET /api/public/garantia/:serie',
        'GET', `/api/public/garantia/${serie}`);
    if (garantia && garantia.clienteFinal === cliente && garantia.estado === 'ACTIVA') {
        okMsg('  → garantía activa para el cliente correcto');
    } else {
        failMsg(`  → datos inesperados: ${JSON.stringify(garantia)}`);
    }

    const traz = await expectOk('GET /api/public/trazabilidad/:serie',
        'GET', `/api/public/trazabilidad/${serie}`);
    if (traz && Array.isArray(traz.transferencias) && traz.transferencias.length === 2) {
        okMsg(`  → 2 transferencias en el historial (cadena Fabricante→Mayorista→Minorista)`);
    } else {
        failMsg(`  → transferencias inesperadas: ${JSON.stringify(traz)}`);
    }

    section('4. Errores 404');
    const r404 = await request('GET', '/api/public/producto/INEXISTENTE-999');
    if (r404.status === 404) okMsg('Producto inexistente devuelve 404');
    else failMsg(`Esperaba 404, recibí ${r404.status}: ${JSON.stringify(r404.body)}`);
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
    console.log(c('DistribuTech — sanity check de la API REST', 'cyan'));
    info(`Base URL: ${BASE}`);

    if (NO_SPAWN) {
        info('NO_SPAWN=1 → uso el servidor que ya esté corriendo');
        if (!await waitForServer(2000)) {
            failMsg('El servidor no responde en el puerto configurado.');
            finish();
            return;
        }
    } else {
        info('Arrancando servidor temporal...');
        try {
            await startServer();
            okMsg('Servidor arrancado');
        } catch (err) {
            failMsg(`No he podido arrancar el servidor: ${err.message}`);
            finish();
            return;
        }
    }

    try {
        await runFlow();
    } catch (err) {
        failMsg(`Error inesperado en el flujo: ${err.message}`);
        if (process.env.DEBUG) console.error(err);
    } finally {
        if (!NO_SPAWN) stopServer();
    }

    finish();
}

function finish() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  PASS: ${c(pass, 'green')}`);
    if (warn > 0) console.log(`  WARN: ${c(warn, 'yellow')}`);
    if (fail > 0) console.log(`  FAIL: ${c(fail, 'red')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (fail === 0) {
        console.log(c('\n  API operativa. 0 errores.\n', 'green'));
        process.exit(0);
    } else {
        console.log(c(`\n  ${fail} errores detectados.\n`, 'red'));
        process.exit(1);
    }
}

process.on('exit', () => stopServer());
process.on('SIGINT', () => { stopServer(); process.exit(130); });

main().catch((err) => {
    console.error('\nError no controlado:');
    console.error(err);
    stopServer();
    process.exit(2);
});
