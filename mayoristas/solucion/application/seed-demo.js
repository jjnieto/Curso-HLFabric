'use strict';

// seed-demo.js
// Rellena la blockchain con datos realistas para demos.
//
// Genera 4 historias coherentes (~36 transacciones) que cubren:
//   - Catálogo de productos (laptops, monitores, GPUs)
//   - Un pedido completo con productos ya vendidos al cliente final, garantía
//     activada y una reclamación resuelta.
//   - Un pedido en tránsito al minorista (enviado, sin confirmar recepción).
//   - Un pedido recién aceptado por el fabricante (pendiente de envío).
//   - Un pedido recién creado por el mayorista (pendiente de aceptación).
//
// Uso:
//   npm run seed
//   SEED_PREFIX=DEMO npm run seed     # prefijo fijo (útil para demos repetibles)
//
// Cada run usa un prefijo único por defecto (D{fecha}-{rand}) para evitar
// conflictos con ejecuciones anteriores.

const { connectAsOrg } = require('./utils/fabric-connection');

// ── Output helpers ────────────────────────────────────────────
const C = {
    reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
    yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m',
};
const tty = process.stdout.isTTY;
const c = (text, color) => (tty ? `${C[color]}${text}${C.reset}` : text);
const step = (msg) => console.log(`  ${c('▸', 'cyan')} ${msg}`);
const ok   = (msg) => console.log(`  ${c('✓', 'green')} ${msg}`);
const section = (title) => console.log(`\n${c('━━━ ' + title + ' ━━━', 'bold')}`);

// ── Prefix único por run ──────────────────────────────────────
function makePrefix() {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `D${ymd}-${rand}`;
}

const PREFIX = process.env.SEED_PREFIX || makePrefix();
const stats = { tx: 0 };
const created = {
    productos: [],
    pedidosMay: [],
    pedidosMin: [],
    garantias: [],
    reclamaciones: [],
};

let fab, may, min;

// ── Helpers de chaincode ──────────────────────────────────────
async function submit(ctx, channel, chaincode, fn, ...args) {
    const cc = ctx.getContract(channel, chaincode);
    const result = await cc.submitTransaction(fn, ...args);
    stats.tx++;
    return result;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
    console.log(c('DistribuTech — seed de datos de demo', 'cyan'));
    console.log(c(`Prefix de este run: ${PREFIX}`, 'dim'));

    section('Conectando a las 3 organizaciones');
    fab = await connectAsOrg('fabricante'); ok('Conectado a FabricanteMSP');
    may = await connectAsOrg('mayorista');  ok('Conectado a MayoristaMSP');
    min = await connectAsOrg('minorista');  ok('Conectado a MinoristaMSP');

    try {
        await registrarCatalogo();
        await historiaP1();
        await historiaP2();
        await historiaP3();
        await historiaP4();
        printSummary();
    } finally {
        if (fab) fab.close();
        if (may) may.close();
        if (min) min.close();
    }
}

// ── 1. Catálogo de productos (8 transacciones) ────────────────
async function registrarCatalogo() {
    section('1. Catálogo · Fabricante registra 8 productos');
    const catalog = [
        { serie: `${PREFIX}-LP-001`, modelo: 'Aurora Pro 14',     lote: 'LP-2026-Q1' },
        { serie: `${PREFIX}-LP-002`, modelo: 'Aurora Pro 16',     lote: 'LP-2026-Q1' },
        { serie: `${PREFIX}-LP-003`, modelo: 'Aurora Pro 14',     lote: 'LP-2026-Q1' },
        { serie: `${PREFIX}-MN-001`, modelo: 'Aurora Display 27', lote: 'MN-2026-Q1' },
        { serie: `${PREFIX}-MN-002`, modelo: 'Aurora Display 32', lote: 'MN-2026-Q1' },
        { serie: `${PREFIX}-MN-003`, modelo: 'Aurora Display 27', lote: 'MN-2026-Q1' },
        { serie: `${PREFIX}-GP-001`, modelo: 'Aurora RTX 4070',   lote: 'GP-2026-Q1' },
        { serie: `${PREFIX}-GP-002`, modelo: 'Aurora RTX 4080',   lote: 'GP-2026-Q1' },
    ];
    for (const p of catalog) {
        await submit(fab, 'canal-trazabilidad', 'cc-producto',
            'RegistrarProducto', p.serie, p.modelo, p.lote);
        step(`Registrado ${p.serie}  ·  ${p.modelo}`);
        created.productos.push(p);
    }
    ok(`Catálogo creado: ${catalog.length} productos`);
}

// ── 2. Historia P1: pedido completo, productos vendidos, reclamación resuelta ─
//     16 transacciones
async function historiaP1() {
    section('2. Historia P1 · pedido completo → 2 productos vendidos → 1 reclamación resuelta');
    const pedMay = `${PREFIX}-PMA-001`;
    const pedMin = `${PREFIX}-PMI-001`;
    const productos = [`${PREFIX}-LP-001`, `${PREFIX}-LP-002`];

    // Mayorista pide al fabricante
    const lineasMay = JSON.stringify(productos.map(p => ({ producto: p, cantidad: 1, precio: 850 })));
    await submit(may, 'canal-mayorista', 'cc-pedido', 'CrearPedido', pedMay, lineasMay);
    step(`Mayorista crea ${pedMay} (2 laptops × 850 €)`);

    await submit(fab, 'canal-mayorista', 'cc-pedido', 'AceptarPedido', pedMay);
    step(`Fabricante acepta ${pedMay}`);

    await submit(fab, 'canal-mayorista', 'cc-pedido', 'RegistrarEnvio', pedMay, 'TRK-FA-001-CORREOS');
    step(`Fabricante envía ${pedMay} (TRK-FA-001-CORREOS)`);

    await submit(may, 'canal-mayorista', 'cc-pedido', 'ConfirmarRecepcion', pedMay);
    step(`Mayorista confirma recepción de ${pedMay}`);

    for (const p of productos) {
        await submit(fab, 'canal-trazabilidad', 'cc-producto', 'TransferirCustodia', p, 'MayoristaMSP');
        step(`Custodia ${p}: Fabricante → Mayorista`);
    }
    created.pedidosMay.push({ id: pedMay, estado: 'RECIBIDO', productos, valor: '1.700 €' });

    // Minorista pide al mayorista (los mismos 2 productos)
    const lineasMin = JSON.stringify(productos.map(p => ({ producto: p, cantidad: 1, precio: 1199 })));
    await submit(min, 'canal-minorista', 'cc-pedido', 'CrearPedido', pedMin, lineasMin);
    step(`Minorista crea ${pedMin} (2 laptops × 1.199 €)`);

    await submit(may, 'canal-minorista', 'cc-pedido', 'AceptarPedido', pedMin);
    step(`Mayorista acepta ${pedMin}`);

    await submit(may, 'canal-minorista', 'cc-pedido', 'RegistrarEnvio', pedMin, 'TRK-MA-001-SEUR');
    step(`Mayorista envía ${pedMin} (TRK-MA-001-SEUR)`);

    await submit(min, 'canal-minorista', 'cc-pedido', 'ConfirmarRecepcion', pedMin);
    step(`Minorista confirma recepción de ${pedMin}`);

    for (const p of productos) {
        await submit(may, 'canal-trazabilidad', 'cc-producto', 'TransferirCustodia', p, 'MinoristaMSP');
        step(`Custodia ${p}: Mayorista → Minorista`);
    }
    created.pedidosMin.push({ id: pedMin, estado: 'RECIBIDO', productos, valor: '2.398 €' });

    // Minorista activa garantía para ambos productos (venta al cliente final)
    const clientes = ['ana.garcia@gmail.com', 'luis.fernandez@hotmail.es'];
    for (let i = 0; i < productos.length; i++) {
        await submit(min, 'canal-trazabilidad', 'cc-garantia',
            'ActivarGarantia', productos[i], clientes[i], '24');
        step(`Garantía activa: ${productos[i]} → ${clientes[i]} (24 meses)`);
        created.garantias.push({ serie: productos[i], cliente: clientes[i], estado: 'ACTIVA' });
    }

    // Reclamación abierta por el minorista
    const reclamData = await submit(min, 'canal-trazabilidad', 'cc-garantia',
        'ReclamarGarantia', productos[0], 'Pantalla con píxeles muertos al encender');
    const reclamID = new TextDecoder().decode(reclamData);
    step(`Reclamación abierta: ${reclamID}`);
    created.reclamaciones.push({ id: reclamID, serie: productos[0], estado: 'ABIERTA' });

    // Fabricante la acepta
    await submit(fab, 'canal-trazabilidad', 'cc-garantia', 'ResolverReclamacion',
        reclamID, 'Sustitución por unidad nueva equivalente. Recogida programada el lunes.', 'true');
    step(`Fabricante acepta la reclamación ${reclamID}`);
    created.reclamaciones[created.reclamaciones.length - 1].estado = 'ACEPTADA';

    ok(`Historia P1 completada — pedido completo + 2 garantías + 1 reclamación resuelta`);
}

// ── 3. Historia P2: pedido en tránsito al minorista (9 transacciones) ──
async function historiaP2() {
    section('3. Historia P2 · monitores en tránsito al minorista');
    const pedMay = `${PREFIX}-PMA-002`;
    const pedMin = `${PREFIX}-PMI-002`;
    const productos = [`${PREFIX}-MN-001`, `${PREFIX}-MN-002`];

    // Mayorista pide al fabricante (completo: crea, acepta, envía, recibe)
    const lineasMay = JSON.stringify(productos.map(p => ({ producto: p, cantidad: 1, precio: 280 })));
    await submit(may, 'canal-mayorista', 'cc-pedido', 'CrearPedido', pedMay, lineasMay);
    step(`Mayorista crea ${pedMay} (2 monitores × 280 €)`);
    await submit(fab, 'canal-mayorista', 'cc-pedido', 'AceptarPedido', pedMay);
    step(`Fabricante acepta ${pedMay}`);
    await submit(fab, 'canal-mayorista', 'cc-pedido', 'RegistrarEnvio', pedMay, 'TRK-FA-002-DHL');
    step(`Fabricante envía ${pedMay} (TRK-FA-002-DHL)`);
    await submit(may, 'canal-mayorista', 'cc-pedido', 'ConfirmarRecepcion', pedMay);
    step(`Mayorista confirma recepción de ${pedMay}`);

    for (const p of productos) {
        await submit(fab, 'canal-trazabilidad', 'cc-producto', 'TransferirCustodia', p, 'MayoristaMSP');
        step(`Custodia ${p}: Fabricante → Mayorista`);
    }
    created.pedidosMay.push({ id: pedMay, estado: 'RECIBIDO', productos, valor: '560 €' });

    // Minorista pide y mayorista envía — pero la recepción no se ha confirmado
    const lineasMin = JSON.stringify(productos.map(p => ({ producto: p, cantidad: 1, precio: 419 })));
    await submit(min, 'canal-minorista', 'cc-pedido', 'CrearPedido', pedMin, lineasMin);
    step(`Minorista crea ${pedMin} (2 monitores × 419 €)`);
    await submit(may, 'canal-minorista', 'cc-pedido', 'AceptarPedido', pedMin);
    step(`Mayorista acepta ${pedMin}`);
    await submit(may, 'canal-minorista', 'cc-pedido', 'RegistrarEnvio', pedMin, 'TRK-MA-002-MRW');
    step(`Mayorista envía ${pedMin} (TRK-MA-002-MRW) — en tránsito`);
    created.pedidosMin.push({ id: pedMin, estado: 'ENVIADO', productos, valor: '838 €' });

    ok(`Historia P2 completada — pedido ${pedMin} en tránsito al minorista`);
}

// ── 4. Historia P3: pedido recién aceptado por el fabricante (2 transacciones) ──
async function historiaP3() {
    section('4. Historia P3 · pedido aceptado por el fabricante, pendiente de envío');
    const pedMay = `${PREFIX}-PMA-003`;
    const productos = [`${PREFIX}-GP-001`, `${PREFIX}-GP-002`, `${PREFIX}-LP-003`];

    const lineas = JSON.stringify([
        { producto: `${PREFIX}-GP-001`, cantidad: 1, precio: 620 },
        { producto: `${PREFIX}-GP-002`, cantidad: 1, precio: 880 },
        { producto: `${PREFIX}-LP-003`, cantidad: 1, precio: 850 },
    ]);
    await submit(may, 'canal-mayorista', 'cc-pedido', 'CrearPedido', pedMay, lineas);
    step(`Mayorista crea ${pedMay} (2 GPUs + 1 laptop, 2.350 €)`);
    await submit(fab, 'canal-mayorista', 'cc-pedido', 'AceptarPedido', pedMay);
    step(`Fabricante acepta ${pedMay} — pendiente de envío`);
    created.pedidosMay.push({ id: pedMay, estado: 'ACEPTADO', productos, valor: '2.350 €' });

    ok(`Historia P3 completada — pedido ${pedMay} esperando envío`);
}

// ── 5. Historia P4: pedido recién creado, sin aceptar (1 transacción) ──
async function historiaP4() {
    section('5. Historia P4 · pedido recién creado, pendiente de aceptación');
    const pedMay = `${PREFIX}-PMA-004`;
    const productos = [`${PREFIX}-MN-003`];
    const lineas = JSON.stringify([{ producto: productos[0], cantidad: 1, precio: 280 }]);

    await submit(may, 'canal-mayorista', 'cc-pedido', 'CrearPedido', pedMay, lineas);
    step(`Mayorista crea ${pedMay} (1 monitor × 280 €) — esperando aceptación`);
    created.pedidosMay.push({ id: pedMay, estado: 'CREADO', productos, valor: '280 €' });

    ok(`Historia P4 completada — pedido ${pedMay} pendiente de aceptación`);
}

// ── Resumen ───────────────────────────────────────────────────
function printSummary() {
    const line = '━'.repeat(60);
    console.log();
    console.log(c(line, 'bold'));
    console.log(c(`  RESUMEN — prefix ${PREFIX} · ${stats.tx} transacciones`, 'bold'));
    console.log(c(line, 'bold'));

    console.log();
    console.log(c('  En la blockchain ahora hay:', 'cyan'));
    console.log(`    • ${created.productos.length} productos en catálogo (laptops, monitores, GPUs)`);
    console.log(`    • ${created.pedidosMay.length} pedidos mayorista → fabricante`);
    console.log(`    • ${created.pedidosMin.length} pedidos minorista → mayorista`);
    console.log(`    • ${created.garantias.length} garantías activas`);
    console.log(`    • ${created.reclamaciones.length} reclamaciones ` +
        `(${created.reclamaciones.filter(r => r.estado === 'ACEPTADA').length} resueltas)`);

    console.log();
    console.log(c('  ► Casos para enseñar en la demo:', 'cyan'));
    console.log();
    console.log(`    ${c('Cliente final escanea su producto y ve trazabilidad + garantía:', 'green')}`);
    for (const g of created.garantias) {
        const note = created.reclamaciones.find(r => r.serie === g.serie)
            ? ' (con reclamación resuelta)' : '';
        console.log(`      → ${c(g.serie, 'yellow')}  ${c('(' + g.cliente + ')' + note, 'dim')}`);
    }

    console.log();
    console.log(`    ${c('Pedidos en distintos estados — operaciones por hacer:', 'green')}`);
    const all = [
        ...created.pedidosMay.map(p => ({ ...p, canal: 'mayorista' })),
        ...created.pedidosMin.map(p => ({ ...p, canal: 'minorista' })),
    ];
    for (const p of all) {
        let proxima = '—';
        if (p.estado === 'CREADO')   proxima = 'aceptar';
        if (p.estado === 'ACEPTADO') proxima = 'enviar';
        if (p.estado === 'ENVIADO')  proxima = 'confirmar recepción';
        console.log(`      → ${c(p.id, 'yellow')}  canal-${p.canal}  ·  ${p.estado}  ·  ` +
            `${c('siguiente: ' + proxima, 'dim')}`);
    }

    console.log();
    console.log(c('  La red está lista para la demo.', 'green'));
    console.log();
}

main().catch((err) => {
    console.error('\n' + c('Error fatal:', 'red') + ' ' + err.message);
    if (process.env.DEBUG) console.error(err);
    if (fab) fab.close();
    if (may) may.close();
    if (min) min.close();
    process.exit(1);
});
