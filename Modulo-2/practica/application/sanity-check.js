'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');
const { ORG_CONFIG, connectToFabric } = require('./utils/fabric-connection');

const args = new Set(process.argv.slice(2));
const VERBOSE = args.has('--verbose') || args.has('-v');
const SKIP_FABRIC = args.has('--skip-fabric');

let errors = 0;
let warnings = 0;

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

function colorize(text, color) {
    if (!process.stdout.isTTY) return text;
    return `${COLORS[color]}${text}${COLORS.reset}`;
}

function ok(msg)    { console.log(`  ${colorize('[OK]   ', 'green')} ${msg}`); }
function fail(msg)  { console.log(`  ${colorize('[FAIL] ', 'red')} ${msg}`); errors++; }
function warn(msg)  { console.log(`  ${colorize('[WARN] ', 'yellow')} ${msg}`); warnings++; }
function info(msg)  { console.log(`  ${colorize('[INFO] ', 'cyan')} ${msg}`); }
function detail(msg){ if (VERBOSE) console.log(`         ${colorize(msg, 'dim')}`); }
function section(title) { console.log(`\n${colorize(title, 'cyan')}`); }

function networkRoot() {
    return process.env.SIGNCHAIN_NETWORK_PATH
        || path.resolve(process.env.HOME || process.env.USERPROFILE, 'signchain', 'network');
}

function checkFile(label, filePath, { mustExist = true } = {}) {
    if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        ok(`${label}`);
        detail(filePath);
        return { exists: true, stat };
    }
    if (mustExist) fail(`${label} — falta: ${filePath}`);
    else warn(`${label} — falta (opcional): ${filePath}`);
    return { exists: false };
}

function checkDirHasFile(label, dirPath) {
    if (!fs.existsSync(dirPath)) {
        fail(`${label} — directorio no existe: ${dirPath}`);
        return false;
    }
    const entries = fs.readdirSync(dirPath).filter((f) => !f.startsWith('.'));
    if (entries.length === 0) {
        fail(`${label} — directorio vacío: ${dirPath}`);
        return false;
    }
    ok(`${label}`);
    detail(`${dirPath} -> ${entries[0]}`);
    return true;
}

function tcpProbe(host, port, { timeout = 3000 } = {}) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;
        const finish = (result, err) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve({ ok: result, err });
        };
        socket.setTimeout(timeout);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false, new Error('timeout')));
        socket.once('error', (err) => finish(false, err));
        socket.connect(port, host);
    });
}

async function checkTcp(label, host, port, { required = true } = {}) {
    const { ok: reachable, err } = await tcpProbe(host, port);
    if (reachable) {
        ok(`${label} (${host}:${port})`);
        return true;
    }
    const msg = `${label} (${host}:${port}) — ${err ? err.message : 'no accesible'}`;
    if (required) fail(msg); else warn(msg);
    return false;
}

async function checkFabricOrg(org) {
    let ctx;
    try {
        ctx = await connectToFabric(org);
    } catch (err) {
        fail(`Conexión Gateway como ${org} — ${err.message}`);
        return;
    }

    try {
        const result = await ctx.contract.evaluateTransaction('GetAllDocuments');
        const text = new TextDecoder().decode(result).trim();
        const docs = text === '' || text === 'null' ? [] : JSON.parse(text);
        ok(`Query GetAllDocuments como ${org} (${docs.length} documento(s) en el ledger)`);
        detail(`mspId=${ctx.identity.mspId}`);
    } catch (err) {
        fail(`Query GetAllDocuments como ${org} — ${err.message}`);
    } finally {
        try { ctx.gateway.close(); } catch (_) { /* noop */ }
        try { ctx.client.close(); } catch (_) { /* noop */ }
    }
}

async function main() {
    console.log(colorize('SignChain — sanity check', 'cyan'));
    info(`Network root: ${networkRoot()}`);
    if (process.env.SIGNCHAIN_NETWORK_PATH) {
        info('Usando SIGNCHAIN_NETWORK_PATH del entorno.');
    } else {
        info('SIGNCHAIN_NETWORK_PATH no definido, usando ruta por defecto.');
    }

    section('1. Requisitos locales');
    const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
    if (nodeMajor >= 18) ok(`Node.js ${process.versions.node}`);
    else fail(`Node.js ${process.versions.node} — se requiere >= 18`);

    checkFile('node_modules instalado', path.join(__dirname, 'node_modules'));
    checkFile('package.json', path.join(__dirname, 'package.json'));
    checkFile('@hyperledger/fabric-gateway',
        path.join(__dirname, 'node_modules', '@hyperledger', 'fabric-gateway', 'package.json'));
    checkFile('@grpc/grpc-js',
        path.join(__dirname, 'node_modules', '@grpc', 'grpc-js', 'package.json'));

    section('2. Material criptográfico de las orgs');
    const root = networkRoot();
    if (!fs.existsSync(root)) {
        fail(`Carpeta de red no existe: ${root}`);
    } else {
        for (const [orgKey, cfg] of Object.entries(ORG_CONFIG)) {
            console.log(`  ${colorize(orgKey, 'cyan')} (${cfg.mspId})`);
            const orgsPath = path.join(root, 'organizations', 'peerOrganizations', cfg.domain);
            checkFile(`  carpeta de la org`, orgsPath);
            const adminMsp = path.join(orgsPath, 'users', `Admin@${cfg.domain}`, 'msp');
            checkDirHasFile(`  signcert del admin`, path.join(adminMsp, 'signcerts'));
            checkDirHasFile(`  keystore del admin`, path.join(adminMsp, 'keystore'));
            checkFile(`  TLS root cert del peer`,
                path.join(orgsPath, 'peers', `peer0.${cfg.domain}`, 'tls', 'ca.crt'));
        }
    }

    section('3. Conectividad TCP a los servicios');
    await checkTcp('orderer.signchain.com', 'localhost', 7050, { required: true });
    for (const [orgKey, cfg] of Object.entries(ORG_CONFIG)) {
        const [host, port] = cfg.peerEndpoint.split(':');
        await checkTcp(`peer0.${orgKey}`, host, parseInt(port, 10), { required: true });
    }
    await checkTcp('CouchDB Cliente',   'localhost', 5984, { required: false });
    await checkTcp('CouchDB Proveedor', 'localhost', 7984, { required: false });
    await checkTcp('CA Cliente',        'localhost', 7054, { required: false });
    await checkTcp('CA Proveedor',      'localhost', 8054, { required: false });
    await checkTcp('CA Orderer',        'localhost', 9054, { required: false });

    section('4. Conexión Fabric (gRPC + TLS + endorsement read-only)');
    if (SKIP_FABRIC) {
        info('Omitido (--skip-fabric). Esta sección valida que el chaincode está commiteado.');
    } else if (errors > 0) {
        warn('Saltando la conexión Fabric porque hay errores previos. Resuélvelos antes.');
    } else {
        for (const orgKey of Object.keys(ORG_CONFIG)) {
            await checkFabricOrg(orgKey);
        }
    }

    console.log('\n' + colorize('Resumen', 'cyan'));
    console.log(`  Errores: ${errors === 0 ? colorize('0', 'green') : colorize(errors, 'red')}`);
    console.log(`  Avisos:  ${warnings === 0 ? colorize('0', 'green') : colorize(warnings, 'yellow')}`);

    if (errors > 0) {
        console.log(colorize('\nResultado: FAIL — la app no podrá funcionar correctamente.', 'red'));
        process.exit(1);
    }
    if (warnings > 0) {
        console.log(colorize('\nResultado: OK con avisos — los servicios opcionales no responden, ' +
            'pero la app debería funcionar.', 'yellow'));
        process.exit(0);
    }
    console.log(colorize('\nResultado: OK — todo listo para ejecutar la práctica.', 'green'));
    process.exit(0);
}

main().catch((err) => {
    console.error(colorize('\nError no controlado en el sanity check:', 'red'));
    console.error(err);
    process.exit(2);
});
