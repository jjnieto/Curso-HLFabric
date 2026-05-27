'use strict';

// Sanity check end-to-end de las apps cliente.
// Ejecuta el ciclo completo de vida de un producto pasando por las 3 orgs.
//
//   Fabricante: registra producto
//   Mayorista:  crea pedido al fabricante
//   Fabricante: acepta pedido, registra envío
//   Mayorista:  confirma recepción
//   Fabricante: transfiere custodia → MayoristaMSP
//   Minorista:  crea pedido al mayorista
//   Mayorista:  acepta pedido, registra envío
//   Minorista:  confirma recepción
//   Mayorista:  transfiere custodia → MinoristaMSP
//   Minorista:  activa garantía
//   Cualquiera: verifica autenticidad (3 transferencias en el historial)

const fs = require('fs');
const path = require('path');
const net = require('net');
const { ORG_CONFIG, connectAsOrg, networkRoot, decode, decodeJSON } = require('./utils/fabric-connection');

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

function tcpProbe(host, port, timeout = 3000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;
        const finish = (ok, err) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve({ ok, err });
        };
        socket.setTimeout(timeout);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false, new Error('timeout')));
        socket.once('error', (err) => finish(false, err));
        socket.connect(port, host);
    });
}

async function main() {
    console.log(c('DistribuTech — sanity check de las apps cliente', 'cyan'));
    info(`Network root: ${networkRoot()}`);

    // ── 1. Requisitos locales ──────────────────────────────────
    section('1. Requisitos locales');
    const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
    nodeMajor >= 18 ? okMsg(`Node.js ${process.versions.node}`)
                    : failMsg(`Node.js ${process.versions.node} — se requiere >= 18`);

    const check = (label, p) => fs.existsSync(p) ? okMsg(label) : failMsg(`${label} — falta: ${p}`);
    check('node_modules instalado',     path.join(__dirname, 'node_modules'));
    check('@hyperledger/fabric-gateway', path.join(__dirname, 'node_modules', '@hyperledger', 'fabric-gateway', 'package.json'));
    check('@grpc/grpc-js',              path.join(__dirname, 'node_modules', '@grpc', 'grpc-js', 'package.json'));

    // ── 2. Crypto de las 3 orgs ────────────────────────────────
    section('2. Material criptográfico de las 3 orgs');
    const root = networkRoot();
    for (const [orgKey, cfg] of Object.entries(ORG_CONFIG)) {
        const orgsPath = path.join(root, 'organizations', 'peerOrganizations', cfg.domain);
        if (!fs.existsSync(orgsPath)) {
            failMsg(`${orgKey} — carpeta de la org no existe: ${orgsPath}`);
            continue;
        }
        const adminMsp = path.join(orgsPath, 'users', `Admin@${cfg.domain}`, 'msp');
        const sc = path.join(adminMsp, 'signcerts');
        const ks = path.join(adminMsp, 'keystore');
        const ca = path.join(orgsPath, 'peers', `peer0.${cfg.domain}`, 'tls', 'ca.crt');
        const haveSigncert = fs.existsSync(sc) && fs.readdirSync(sc).length > 0;
        const haveKey      = fs.existsSync(ks) && fs.readdirSync(ks).length > 0;
        const haveCA       = fs.existsSync(ca);
        haveSigncert ? okMsg(`${orgKey} signcert del admin`) : failMsg(`${orgKey} signcert del admin (${sc})`);
        haveKey      ? okMsg(`${orgKey} keystore del admin`) : failMsg(`${orgKey} keystore del admin (${ks})`);
        haveCA       ? okMsg(`${orgKey} TLS root del peer`)   : failMsg(`${orgKey} TLS root del peer (${ca})`);
    }

    // ── 3. Conectividad TCP ────────────────────────────────────
    section('3. Conectividad TCP');
    await checkTcp('orderer.distributech.com', 'localhost', 7050);
    for (const [orgKey, cfg] of Object.entries(ORG_CONFIG)) {
        const [host, portStr] = cfg.peerEndpoint.split(':');
        await checkTcp(`peer0.${orgKey}`, host, parseInt(portStr, 10));
    }

    if (fail > 0) {
        warnMsg('Hay errores antes del flujo end-to-end. Resuélvelos primero.');
        finish();
        return;
    }

    // ── 4. Flujo end-to-end ────────────────────────────────────
    section('4. Flujo end-to-end (vida de un producto)');
    const stamp = Date.now();
    const serie    = `SANITY-PROD-${stamp}`;
    const pedidoMy = `SANITY-PED-MAY-${stamp}`;
    const pedidoMi = `SANITY-PED-MIN-${stamp}`;
    const cliente  = `cliente-sanity-${stamp}`;

    let fab, may, min;
    try {
        info('Conectando a las 3 orgs...');
        fab = await connectAsOrg('fabricante');
        may = await connectAsOrg('mayorista');
        min = await connectAsOrg('minorista');
        okMsg('Conexiones Gateway establecidas para fabricante, mayorista y minorista');

        // 4.1 Fabricante: registrar producto
        const ccProductoFab = fab.getContract('canal-trazabilidad', 'cc-producto');
        await ccProductoFab.submitTransaction('RegistrarProducto', serie, 'GPU-Sanity', 'LOTE-S001');
        okMsg(`Fabricante: registrar producto ${serie}`);

        // 4.2 Mayorista: crear pedido al fabricante
        const lineasMy = JSON.stringify([{ producto: serie, cantidad: 1, precio: 100.0 }]);
        const ccPedidoMay = may.getContract('canal-mayorista', 'cc-pedido');
        await ccPedidoMay.submitTransaction('CrearPedido', pedidoMy, lineasMy);
        okMsg(`Mayorista: crear pedido ${pedidoMy} al fabricante`);

        // 4.3 Fabricante: aceptar pedido + registrar envío
        const ccPedidoFab = fab.getContract('canal-mayorista', 'cc-pedido');
        await ccPedidoFab.submitTransaction('AceptarPedido', pedidoMy);
        okMsg(`Fabricante: aceptar pedido ${pedidoMy}`);

        await ccPedidoFab.submitTransaction('RegistrarEnvio', pedidoMy, 'TRK-MAY-001');
        okMsg(`Fabricante: registrar envío del pedido ${pedidoMy}`);

        // 4.4 Mayorista: confirmar recepción
        await ccPedidoMay.submitTransaction('ConfirmarRecepcion', pedidoMy);
        okMsg(`Mayorista: confirmar recepción del pedido ${pedidoMy}`);

        // 4.5 Fabricante: transferir custodia
        await ccProductoFab.submitTransaction('TransferirCustodia', serie, 'MayoristaMSP');
        okMsg(`Fabricante: transferir custodia de ${serie} → MayoristaMSP`);

        // 4.6 Minorista: crear pedido al mayorista
        const lineasMi = JSON.stringify([{ producto: serie, cantidad: 1, precio: 150.0 }]);
        const ccPedidoMin = min.getContract('canal-minorista', 'cc-pedido');
        await ccPedidoMin.submitTransaction('CrearPedido', pedidoMi, lineasMi);
        okMsg(`Minorista: crear pedido ${pedidoMi} al mayorista`);

        // 4.7 Mayorista: aceptar pedido + registrar envío
        const ccPedidoMayMin = may.getContract('canal-minorista', 'cc-pedido');
        await ccPedidoMayMin.submitTransaction('AceptarPedido', pedidoMi);
        okMsg(`Mayorista: aceptar pedido ${pedidoMi}`);

        await ccPedidoMayMin.submitTransaction('RegistrarEnvio', pedidoMi, 'TRK-MIN-001');
        okMsg(`Mayorista: registrar envío del pedido ${pedidoMi}`);

        // 4.8 Minorista: confirmar recepción
        await ccPedidoMin.submitTransaction('ConfirmarRecepcion', pedidoMi);
        okMsg(`Minorista: confirmar recepción del pedido ${pedidoMi}`);

        // 4.9 Mayorista: transferir custodia
        const ccProductoMay = may.getContract('canal-trazabilidad', 'cc-producto');
        await ccProductoMay.submitTransaction('TransferirCustodia', serie, 'MinoristaMSP');
        okMsg(`Mayorista: transferir custodia de ${serie} → MinoristaMSP`);

        // 4.10 Minorista: activar garantía
        const ccGarantiaMin = min.getContract('canal-trazabilidad', 'cc-garantia');
        await ccGarantiaMin.submitTransaction('ActivarGarantia', serie, cliente, '24');
        okMsg(`Minorista: activar garantía para ${serie} (${cliente}, 24 meses)`);

        // 4.11 Minorista: verificar autenticidad (debe haber 2 transferencias)
        const ccProductoMin = min.getContract('canal-trazabilidad', 'cc-producto');
        const historyBytes = await ccProductoMin.evaluateTransaction('VerificarAutenticidad', serie);
        const history = decodeJSON(historyBytes) || [];
        if (history.length === 2) {
            okMsg(`Minorista: verificar autenticidad — ${history.length} transferencias en el historial`);
            history.forEach((t, i) => info(`  ${i + 1}. ${t.origen} → ${t.destino}`));
        } else {
            failMsg(`Verificar autenticidad — esperaba 2 transferencias, encontradas ${history.length}`);
        }

        // 4.12 Consultar garantía desde otra org (debe ser visible)
        const garBytes = await fab.getContract('canal-trazabilidad', 'cc-garantia')
            .evaluateTransaction('ConsultarGarantia', serie);
        const garantia = decodeJSON(garBytes);
        if (garantia && garantia.estado === 'ACTIVA' && garantia.clienteFinal === cliente) {
            okMsg('Fabricante puede ver la garantía activada por el minorista en el mismo canal');
        } else {
            failMsg(`Consulta de garantía desde Fabricante devolvió: ${JSON.stringify(garantia)}`);
        }

        // 4.13 ACL: Mayorista NO puede registrar productos
        try {
            await may.getContract('canal-trazabilidad', 'cc-producto')
                .submitTransaction('RegistrarProducto', `ACL-${stamp}`, 'X', 'X');
            failMsg('ACL: MayoristaMSP NO debería poder registrar productos pero lo ha conseguido');
        } catch (err) {
            if (err.message.includes('FabricanteMSP') || err.message.includes('endorsement')) {
                okMsg('ACL: MayoristaMSP rechazado al intentar RegistrarProducto');
            } else {
                warnMsg(`ACL: error inesperado al rechazar MayoristaMSP: ${err.message}`);
            }
        }
    } catch (err) {
        failMsg(`Flujo end-to-end: ${err.message}`);
        if (process.env.DEBUG) console.error(err);
    } finally {
        if (fab) fab.close();
        if (may) may.close();
        if (min) min.close();
    }

    finish();
}

async function checkTcp(label, host, port) {
    const { ok, err } = await tcpProbe(host, port);
    ok ? okMsg(`${label} (${host}:${port})`)
       : failMsg(`${label} (${host}:${port}) — ${err ? err.message : 'no accesible'}`);
}

function finish() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  PASS: ${c(pass, 'green')}`);
    if (warn > 0) console.log(`  WARN: ${c(warn, 'yellow')}`);
    if (fail > 0) console.log(`  FAIL: ${c(fail, 'red')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (fail === 0) {
        console.log(c('\n  Apps cliente operativas. 0 errores.\n', 'green'));
        process.exit(0);
    } else {
        console.log(c(`\n  ${fail} errores detectados. Revisa los [FAIL] de arriba.\n`, 'red'));
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('\nError no controlado:');
    console.error(err);
    process.exit(2);
});
