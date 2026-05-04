'use strict';

const { connectToFabric } = require('./utils/fabric-connection');
const { sha256OfFile } = require('./utils/crypto');

async function main() {
    const docID = process.argv[2] || `DOC-${Date.now()}`;
    const filePath = process.argv[3] || './docs/contrato.pdf';
    const title = process.argv[4] || 'Contrato 2026';
    const description = process.argv[5] || 'Servicios profesionales';

    const hash = sha256OfFile(filePath);
    console.log(`Hash SHA-256 del documento: ${hash}`);

    const { gateway, contract, client } = await connectToFabric('cliente');

    try {
        await contract.submitTransaction('CreateDocument', docID, hash, title, description);
        console.log(`Documento ${docID} creado correctamente.`);
        console.log(`  Título: ${title}`);
        console.log(`  Estado: pending`);
    } catch (err) {
        console.error(`Error creando el documento: ${err.message}`);
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
