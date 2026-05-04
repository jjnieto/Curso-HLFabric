'use strict';

const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ORG_CONFIG = {
    cliente: {
        mspId: 'ClienteMSP',
        domain: 'cliente.signchain.com',
        peerEndpoint: 'localhost:7051',
        peerHostAlias: 'peer0.cliente.signchain.com',
    },
    proveedor: {
        mspId: 'ProveedorMSP',
        domain: 'proveedor.signchain.com',
        peerEndpoint: 'localhost:9051',
        peerHostAlias: 'peer0.proveedor.signchain.com',
    },
};

function networkRoot() {
    return process.env.SIGNCHAIN_NETWORK_PATH
        || path.resolve(process.env.HOME || process.env.USERPROFILE, 'signchain', 'network');
}

function readSingleFileFrom(dir) {
    const entries = fs.readdirSync(dir);
    if (entries.length === 0) {
        throw new Error(`Directorio vacío: ${dir}`);
    }
    return fs.readFileSync(path.join(dir, entries[0]), 'utf8');
}

async function connectToFabric(org) {
    const orgConfig = ORG_CONFIG[org];
    if (!orgConfig) throw new Error(`Org desconocida: ${org}. Usa 'cliente' o 'proveedor'.`);

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
        endorseOptions: () => ({ deadline: Date.now() + 15000 }),
        submitOptions: () => ({ deadline: Date.now() + 5000 }),
        commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });

    const network = gateway.getNetwork('signchain-channel');
    const contract = network.getContract('signchain');

    return {
        gateway,
        contract,
        network,
        client,
        identity,
        privateKeyPem,
        certPem,
    };
}

module.exports = { connectToFabric, ORG_CONFIG };
