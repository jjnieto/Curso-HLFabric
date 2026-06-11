'use strict';

// API REST mínima que expone las funciones del chaincode fidelitypoints al
// frontal web. Mantiene una conexión por organización (hotel y cafetería) y
// reutiliza el connection profile estático ya probado (sin service discovery).

const express = require('express');
const cors = require('cors');
const { connectToFabric } = require('./fabric-connection');

const app = express();
app.use(cors());
app.use(express.json());

// --- Conexión a Fabric (perezosa y cacheada) ---
let conns = null;

async function getConns() {
    if (conns) return conns;
    const hotel = await connectToFabric('hotel');
    const cafeteria = await connectToFabric('cafeteria');
    conns = { hotel, cafeteria };
    console.log('Conectado a la red Fabric (HotelMSP y CafeteriaMSP).');
    return conns;
}

// El payload puede venir vacío (p.ej. lista sin resultados): no parsear "".
function parseResult(buffer) {
    const raw = buffer.toString();
    return raw ? JSON.parse(raw) : null;
}

// Extrae un mensaje legible del error de Fabric (suele traer "message=...").
function cleanError(err) {
    const msg = (err && err.message) ? err.message : String(err);
    const m = msg.match(/message=([^\n]+)/);
    return m ? m[1].trim() : msg;
}

// Envuelve un handler async y traduce errores a JSON.
const wrap = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: cleanError(err) });
    }
};

// --- Rutas de solo lectura (queries) ---

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/token', wrap(async (req, res) => {
    const { hotel } = await getConns();
    const info = parseResult(await hotel.contract.evaluateTransaction('GetTokenInfo'));
    res.json(info);
}));

app.get('/api/clients', wrap(async (req, res) => {
    const { hotel } = await getConns();
    const clients = parseResult(await hotel.contract.evaluateTransaction('GetAllClients')) || [];
    res.json(clients);
}));

app.get('/api/clients/:id/balance', wrap(async (req, res) => {
    const { hotel } = await getConns();
    const result = await hotel.contract.evaluateTransaction('BalanceOf', req.params.id);
    res.json({ balance: Number(result.toString()) });
}));

app.get('/api/clients/:id/history', wrap(async (req, res) => {
    const { hotel } = await getConns();
    const history = parseResult(await hotel.contract.evaluateTransaction('ClientHistory', req.params.id)) || [];
    res.json(history);
}));

// --- Rutas de escritura (transacciones) ---

app.post('/api/hotel/register', wrap(async (req, res) => {
    const { clientID, name } = req.body;
    if (!clientID || !name) throw new Error('Faltan el DNI o el nombre del cliente');
    const { hotel } = await getConns();
    await hotel.contract.submitTransaction('RegisterClient', clientID, name);
    res.json({ ok: true });
}));

app.post('/api/hotel/mint', wrap(async (req, res) => {
    const { clientID, amount, description } = req.body;
    if (!clientID || !amount) throw new Error('Faltan el DNI o la cantidad de puntos');
    const { hotel } = await getConns();
    await hotel.contract.submitTransaction('Mint', clientID, String(amount), description || '');
    res.json({ ok: true });
}));

app.post('/api/cafeteria/redeem', wrap(async (req, res) => {
    const { clientID, amount, product } = req.body;
    if (!clientID || !amount) throw new Error('Faltan el DNI o la cantidad de puntos');
    const { cafeteria } = await getConns();
    await cafeteria.contract.submitTransaction('Redeem', clientID, String(amount), product || '');
    res.json({ ok: true });
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API de FidelityChain escuchando en http://localhost:${PORT}`);
    // Intento de conexión temprano para detectar problemas cuanto antes.
    getConns().catch((e) => console.error('Todavía sin conexión a Fabric:', cleanError(e)));
});
