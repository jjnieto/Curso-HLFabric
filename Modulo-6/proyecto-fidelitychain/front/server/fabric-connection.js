'use strict';

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

// Datos de las dos organizaciones de la red.
const ORGS = {
    hotel: {
        msp: 'HotelMSP',
        domain: 'hotel.fidelitychain.com',
        peerHost: 'peer0.hotel.fidelitychain.com',
        peerUrl: 'grpcs://localhost:7051',
    },
    cafeteria: {
        msp: 'CafeteriaMSP',
        domain: 'cafeteria.fidelitychain.com',
        peerHost: 'peer0.cafeteria.fidelitychain.com',
        peerUrl: 'grpcs://localhost:9051',
    },
};

// front/server -> (../../) proyecto-fidelitychain -> network
const networkPath = path.resolve(__dirname, '..', '..', 'network');

// Lee el certificado TLS (tls/ca.crt) del peer de una org.
function readPeerTlsCert(orgInfo) {
    return fs.readFileSync(path.join(networkPath, 'crypto-config', 'peerOrganizations',
        orgInfo.domain, 'peers', orgInfo.peerHost, 'tls', 'ca.crt'), 'utf8');
}

/**
 * Conecta al Gateway de Fabric y devuelve el contrato.
 * @param {string} org - 'hotel' o 'cafeteria' (identidad con la que firmamos)
 * @returns {Object} { gateway, contract, network }
 */
async function connectToFabric(org) {
    const orgConfig = ORGS[org];
    if (!orgConfig) throw new Error(`Org desconocida: ${org}`);

    const cryptoPath = path.join(networkPath, 'crypto-config', 'peerOrganizations',
        orgConfig.domain);

    // Leer certificado del admin de la org elegida
    const certPath = path.join(cryptoPath, 'users', `Admin@${orgConfig.domain}`,
        'msp', 'signcerts');
    const certFile = fs.readdirSync(certPath)[0];
    const certificate = fs.readFileSync(path.join(certPath, certFile), 'utf8');

    // Leer clave privada del admin
    const keyPath = path.join(cryptoPath, 'users', `Admin@${orgConfig.domain}`,
        'msp', 'keystore');
    const keyFile = fs.readdirSync(keyPath)[0];
    const privateKey = fs.readFileSync(path.join(keyPath, keyFile), 'utf8');

    // Crear wallet en memoria con la identidad del admin
    const wallet = await Wallets.newInMemoryWallet();
    const identity = {
        credentials: { certificate, privateKey },
        mspId: orgConfig.msp,
        type: 'X.509',
    };
    await wallet.put('admin', identity);

    // Certificados TLS: necesitamos los DOS peers (el chaincode tiene política
    // de endorsement MAJORITY = ambas orgs) y el del orderer.
    const hotelTlsCert = readPeerTlsCert(ORGS.hotel);
    const cafeTlsCert = readPeerTlsCert(ORGS.cafeteria);
    const ordererTlsCert = fs.readFileSync(path.join(networkPath, 'crypto-config',
        'ordererOrganizations', 'fidelitychain.com', 'orderers',
        'orderer.fidelitychain.com', 'tls', 'ca.crt'), 'utf8');

    // Connection profile estatico: declaramos explicitamente los dos peers como
    // avaladores. NO usamos service discovery (en una red local con cryptogen
    // suele fallar con "access denied"); al listar ambos peers a mano, el SDK
    // recoge el endorsement de las dos orgs de forma determinista.
    const ccp = {
        name: `fidelitychain-${org}`,
        version: '1.0.0',
        channels: {
            'fidelity-channel': {
                orderers: ['orderer.fidelitychain.com'],
                peers: {
                    [ORGS.hotel.peerHost]: {
                        endorsingPeer: true,
                        chaincodeQuery: true,
                        ledgerQuery: true,
                        eventSource: true,
                    },
                    [ORGS.cafeteria.peerHost]: {
                        endorsingPeer: true,
                        chaincodeQuery: true,
                        ledgerQuery: true,
                        eventSource: true,
                    },
                },
            },
        },
        organizations: {
            HotelMSP: {
                mspid: 'HotelMSP',
                peers: [ORGS.hotel.peerHost],
            },
            CafeteriaMSP: {
                mspid: 'CafeteriaMSP',
                peers: [ORGS.cafeteria.peerHost],
            },
        },
        orderers: {
            'orderer.fidelitychain.com': {
                url: 'grpcs://localhost:7050',
                tlsCACerts: { pem: ordererTlsCert },
                grpcOptions: {
                    'ssl-target-name-override': 'orderer.fidelitychain.com',
                },
            },
        },
        peers: {
            [ORGS.hotel.peerHost]: {
                url: ORGS.hotel.peerUrl,
                tlsCACerts: { pem: hotelTlsCert },
                grpcOptions: {
                    'ssl-target-name-override': ORGS.hotel.peerHost,
                },
            },
            [ORGS.cafeteria.peerHost]: {
                url: ORGS.cafeteria.peerUrl,
                tlsCACerts: { pem: cafeTlsCert },
                grpcOptions: {
                    'ssl-target-name-override': ORGS.cafeteria.peerHost,
                },
            },
        },
    };

    // Conectar al Gateway con discovery desactivado.
    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: 'admin',
        discovery: { enabled: false },
    });

    const network = await gateway.getNetwork('fidelity-channel');
    const contract = network.getContract('fidelitypoints');

    return { gateway, contract, network };
}

module.exports = { connectToFabric };
