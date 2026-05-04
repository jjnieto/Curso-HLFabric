'use strict';

const { connectToFabric } = require('./utils/fabric-connection');
const { sha256OfFile, signMessage } = require('./utils/crypto');

async function main() {
    const org = process.argv[2];
    const docID = process.argv[3];
    const filePath = process.argv[4];

    if (!org || !docID || !filePath) {
        console.error('Uso: node firmar-documento.js <cliente|proveedor> <docID> <ruta-documento>');
        process.exit(1);
    }

    const hash = sha256OfFile(filePath);
    console.log(`Hash local del documento: ${hash}`);

    const { gateway, contract, client, privateKeyPem } = await connectToFabric(org);

    try {
        const remoteJSON = await contract.evaluateTransaction('GetDocument', docID);
        const remoteDoc = JSON.parse(new TextDecoder().decode(remoteJSON));
        if (remoteDoc.hash !== hash) {
            throw new Error(
                `El hash del ledger (${remoteDoc.hash}) NO coincide con el local (${hash}).\n` +
                `El documento que tienes localmente no es el mismo que se registró.`);
        }
        console.log('Hash verificado: el documento local coincide con el del ledger.');

        const signature = signMessage(hash, privateKeyPem);
        console.log(`Firma generada (${signature.length} bytes en base64).`);

        await contract.submitTransaction('ApproveDocument', docID, signature);
        console.log(`Documento ${docID} firmado por ${org}.`);

        const updatedJSON = await contract.evaluateTransaction('GetDocument', docID);
        const updated = JSON.parse(new TextDecoder().decode(updatedJSON));
        console.log(`  Nuevo estado: ${updated.status}`);
        console.log(`  Firmas registradas: ${updated.signatures.length}`);
    } catch (err) {
        console.error(`Error firmando el documento: ${err.message}`);
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
