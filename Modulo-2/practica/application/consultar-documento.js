'use strict';

const fs = require('fs');
const path = require('path');
const { connectToFabric } = require('./utils/fabric-connection');
const { sha256OfFile, verifySignature } = require('./utils/crypto');

const MSP_TO_DOMAIN = {
    ClienteMSP: { dir: 'cliente.signchain.com', user: 'Admin@cliente.signchain.com' },
    ProveedorMSP: { dir: 'proveedor.signchain.com', user: 'Admin@proveedor.signchain.com' },
};

function networkRoot() {
    return process.env.SIGNCHAIN_NETWORK_PATH
        || path.resolve(process.env.HOME || process.env.USERPROFILE, 'signchain', 'network');
}

function loadAdminCertForMsp(mspId) {
    const meta = MSP_TO_DOMAIN[mspId];
    if (!meta) throw new Error(`MSP desconocido: ${mspId}`);
    const certDir = path.join(networkRoot(),
        'organizations', 'peerOrganizations', meta.dir,
        'users', meta.user, 'msp', 'signcerts');
    return fs.readFileSync(path.join(certDir, fs.readdirSync(certDir)[0]), 'utf8');
}

async function main() {
    const docID = process.argv[2];
    const filePath = process.argv[3];

    if (!docID) {
        console.error('Uso: node consultar-documento.js <docID> [ruta-documento-local]');
        process.exit(1);
    }

    const { gateway, contract, client } = await connectToFabric('cliente');

    try {
        const docJSON = await contract.evaluateTransaction('GetDocument', docID);
        const doc = JSON.parse(new TextDecoder().decode(docJSON));

        console.log('Documento:');
        console.log(`  ID:          ${doc.id}`);
        console.log(`  Título:      ${doc.title}`);
        console.log(`  Hash:        ${doc.hash}`);
        console.log(`  Creado por:  ${doc.createdBy}`);
        console.log(`  Creado en:   ${doc.createdAt}`);
        console.log(`  Estado:      ${doc.status}`);
        console.log(`  Firmas:      ${doc.signatures.length}`);

        if (filePath && fs.existsSync(filePath)) {
            const localHash = sha256OfFile(filePath);
            const match = localHash === doc.hash;
            console.log('\nVerificación de hash:');
            console.log(`  Hash local:    ${localHash}`);
            console.log(`  Hash remoto:   ${doc.hash}`);
            console.log(`  Coinciden:     ${match ? 'SÍ' : 'NO (documento diferente)'}`);

            if (match && doc.signatures.length > 0) {
                console.log('\nVerificación de firmas:');
                for (const sig of doc.signatures) {
                    const certPem = loadAdminCertForMsp(sig.org);
                    const valid = verifySignature(doc.hash, sig.signature, certPem);
                    console.log(`  ${sig.org}: ${valid ? 'VÁLIDA' : 'INVÁLIDA'} ` +
                                `(firmado en ${sig.timestamp})`);
                }
            }
        }
    } catch (err) {
        console.error(`Error consultando el documento: ${err.message}`);
        process.exitCode = 1;
    } finally {
        gateway.close();
        client.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
