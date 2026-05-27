'use strict';

const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ORG_CONFIG = {
    fabricante: {
        mspId: 'FabricanteMSP',
        domain: 'fabricante.distributech.com',
        peerEndpoint: 'localhost:7051',
        peerHostAlias: 'peer0.fabricante.distributech.com',
    },
    mayorista: {
        mspId: 'MayoristaMSP',
        domain: 'mayorista.distributech.com',
        peerEndpoint: 'localhost:9051',
        peerHostAlias: 'peer0.mayorista.distributech.com',
    },
    minorista: {
        mspId: 'MinoristaMSP',
        domain: 'minorista.distributech.com',
        peerEndpoint: 'localhost:11051',
        peerHostAlias: 'peer0.minorista.distributech.com',
    },
};

// Mapa canal → chaincodes desplegados en ese canal
const CHANNELS = {
    'canal-trazabilidad': ['cc-producto', 'cc-garantia'],
    'canal-mayorista': ['cc-pedido'],
    'canal-minorista': ['cc-pedido'],
};

function networkRoot() {
    if (process.env.DISTRIBUTECH_NETWORK_PATH) {
        return process.env.DISTRIBUTECH_NETWORK_PATH;
    }
    // Por defecto: ../network respecto a application/
    return path.resolve(__dirname, '..', '..', 'network');
}

function readSingleFileFrom(dir) {
    const entries = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
    if (entries.length === 0) {
        throw new Error(`Directorio vacío: ${dir}`);
    }
    return fs.readFileSync(path.join(dir, entries[0]), 'utf8');
}

// Abre una conexión al peer de la organización indicada.
// Devuelve un objeto con métodos para obtener contratos en cada canal.
async function connectAsOrg(org) {
    const orgConfig = ORG_CONFIG[org];
    if (!orgConfig) {
        throw new Error(`Org desconocida: '${org}'. Usa 'fabricante', 'mayorista' o 'minorista'.`);
    }

    const orgsPath = path.join(networkRoot(),
        'organizations', 'peerOrganizations', orgConfig.domain);

    const adminMspPath = path.join(orgsPath, 'users', `Admin@${orgConfig.domain}`, 'msp');
    const certPem = readSingleFileFrom(path.join(adminMspPath, 'signcerts'));
    const privateKeyPem = readSingleFileFrom(path.join(adminMspPath, 'keystore'));

    const tlsRootCert = fs.readFileSync(path.join(orgsPath, 'peers',
        `peer0.${orgConfig.domain}`, 'tls', 'ca.crt'));

    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    const client = new grpc.Client(orgConfig.peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': orgConfig.peerHostAlias,
    });

    const identity = {
        mspId: orgConfig.mspId,
        credentials: Buffer.from(certPem),
    };

    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signer = signers.newPrivateKeySigner(privateKey);

    const gateway = connect({
        client,
        identity,
        signer,
        evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
        endorseOptions: () => ({ deadline: Date.now() + 30000 }),
        submitOptions: () => ({ deadline: Date.now() + 10000 }),
        commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });

    function getContract(channelName, chaincodeName) {
        if (!CHANNELS[channelName]) {
            throw new Error(`Canal desconocido: '${channelName}'`);
        }
        if (!CHANNELS[channelName].includes(chaincodeName)) {
            throw new Error(`Chaincode '${chaincodeName}' no está en el canal '${channelName}'`);
        }
        return gateway.getNetwork(channelName).getContract(chaincodeName);
    }

    function close() {
        try { gateway.close(); } catch (_) { /* noop */ }
        try { client.close(); } catch (_) { /* noop */ }
    }

    return {
        org,
        identity,
        gateway,
        client,
        getContract,
        close,
    };
}

// Helpers para decodificar respuestas del chaincode.
function decode(bytes) {
    return new TextDecoder().decode(bytes);
}

function decodeJSON(bytes) {
    const text = decode(bytes).trim();
    if (!text || text === 'null') return null;
    return JSON.parse(text);
}

module.exports = {
    ORG_CONFIG,
    CHANNELS,
    connectAsOrg,
    networkRoot,
    decode,
    decodeJSON,
};
