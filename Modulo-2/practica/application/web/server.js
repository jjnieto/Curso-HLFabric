'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const { connectToFabric } = require('../utils/fabric-connection');
const { signMessage, verifySignature } = require('../utils/crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
});

const connections = {};
async function getCtx(org) {
    if (!['cliente', 'proveedor'].includes(org)) {
        const err = new Error(`role inválido: ${org}`);
        err.status = 400;
        throw err;
    }
    if (!connections[org]) {
        connections[org] = await connectToFabric(org);
    }
    return connections[org];
}

function sha256OfBuffer(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function decodeJson(bytes) {
    const text = new TextDecoder().decode(bytes).trim();
    if (text === '' || text === 'null') return null;
    return JSON.parse(text);
}

function asyncHandler(fn) {
    return (req, res) => {
        Promise.resolve(fn(req, res)).catch((err) => {
            console.error(`[${req.method} ${req.path}]`, err.message);
            const status = err.status || 500;
            res.status(status).json({ error: err.message });
        });
    };
}

app.get('/api/health', asyncHandler(async (req, res) => {
    res.json({
        ok: true,
        connectedOrgs: Object.keys(connections),
        time: new Date().toISOString(),
    });
}));

app.get('/api/documents', asyncHandler(async (req, res) => {
    const role = req.query.role || 'cliente';
    const ctx = await getCtx(role);
    const result = await ctx.contract.evaluateTransaction('GetAllDocuments');
    const docs = decodeJson(result) || [];
    res.json({ documents: docs });
}));

app.get('/api/documents/:id', asyncHandler(async (req, res) => {
    const role = req.query.role || 'cliente';
    const ctx = await getCtx(role);
    const result = await ctx.contract.evaluateTransaction('GetDocument', req.params.id);
    const doc = decodeJson(result);
    res.json({ document: doc });
}));

app.get('/api/documents/:id/history', asyncHandler(async (req, res) => {
    const role = req.query.role || 'cliente';
    const ctx = await getCtx(role);
    const result = await ctx.contract.evaluateTransaction('GetDocumentHistory', req.params.id);
    const history = decodeJson(result) || [];
    res.json({ history });
}));

app.post('/api/documents', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        const err = new Error('falta el archivo');
        err.status = 400;
        throw err;
    }
    const { id, title, description = '' } = req.body;
    if (!id || !title) {
        const err = new Error('id y title son obligatorios');
        err.status = 400;
        throw err;
    }

    const hash = sha256OfBuffer(req.file.buffer);
    const ctx = await getCtx('cliente');
    await ctx.contract.submitTransaction('CreateDocument', id, hash, title, description);
    res.json({ ok: true, id, hash, filename: req.file.originalname });
}));

app.post('/api/documents/:id/sign', upload.single('file'), asyncHandler(async (req, res) => {
    const role = req.body.role || req.query.role;
    if (!['cliente', 'proveedor'].includes(role)) {
        const err = new Error('role debe ser cliente o proveedor');
        err.status = 400;
        throw err;
    }
    if (!req.file) {
        const err = new Error('falta el archivo a firmar (para verificar el hash)');
        err.status = 400;
        throw err;
    }

    const localHash = sha256OfBuffer(req.file.buffer);
    const ctx = await getCtx(role);

    const docRaw = await ctx.contract.evaluateTransaction('GetDocument', req.params.id);
    const doc = decodeJson(docRaw);
    if (!doc) {
        const err = new Error(`documento ${req.params.id} no existe`);
        err.status = 404;
        throw err;
    }
    if (doc.hash !== localHash) {
        const err = new Error(
            `el hash del archivo no coincide con el del ledger.\n` +
            `local:  ${localHash}\nledger: ${doc.hash}`);
        err.status = 400;
        throw err;
    }

    const signature = signMessage(localHash, ctx.privateKeyPem);
    await ctx.contract.submitTransaction('ApproveDocument', req.params.id, signature);

    const updatedRaw = await ctx.contract.evaluateTransaction('GetDocument', req.params.id);
    const updated = decodeJson(updatedRaw);

    res.json({
        ok: true,
        id: req.params.id,
        signedBy: role,
        newStatus: updated.status,
        signaturesCount: updated.signatures.length,
    });
}));

app.post('/api/documents/:id/reject', asyncHandler(async (req, res) => {
    const { role, reason } = req.body;
    if (!['cliente', 'proveedor'].includes(role)) {
        const err = new Error('role debe ser cliente o proveedor');
        err.status = 400;
        throw err;
    }
    if (!reason || reason.trim() === '') {
        const err = new Error('motivo del rechazo obligatorio');
        err.status = 400;
        throw err;
    }
    const ctx = await getCtx(role);
    await ctx.contract.submitTransaction('RejectDocument', req.params.id, reason);
    res.json({ ok: true, id: req.params.id, rejectedBy: role });
}));

app.post('/api/documents/:id/cancel', asyncHandler(async (req, res) => {
    const role = req.body.role || 'cliente';
    const ctx = await getCtx(role);
    await ctx.contract.submitTransaction('CancelDocument', req.params.id);
    res.json({ ok: true, id: req.params.id, cancelledBy: role });
}));

app.use(express.static(path.join(__dirname, 'public')));

function shutdown() {
    console.log('\nCerrando conexiones Fabric...');
    for (const ctx of Object.values(connections)) {
        try { ctx.gateway.close(); } catch (_) { /* noop */ }
        try { ctx.client.close(); } catch (_) { /* noop */ }
    }
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`SignChain web server escuchando en http://localhost:${port}`);
    console.log(`Network root: ${process.env.SIGNCHAIN_NETWORK_PATH || 'default $HOME/signchain/network'}`);
});
