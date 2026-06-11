'use strict';

const readline = require('readline');
const { connectToFabric } = require('./utils/fabric-connection');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

// Catalogo de productos con sus precios en puntos
const CATALOGO = {
    '1': { nombre: 'Cafe solo', puntos: 10 },
    '2': { nombre: 'Cafe con leche', puntos: 15 },
    '3': { nombre: 'Tostada', puntos: 15 },
    '4': { nombre: 'Desayuno completo', puntos: 30 },
    '5': { nombre: 'Menu almuerzo', puntos: 50 },
};

async function main() {
    console.log('=== FidelityChain — App Cafeteria ===\n');
    console.log('Conectando a la red Fabric como CafeteriaMSP...');

    const { gateway, contract } = await connectToFabric('cafeteria');
    console.log('Conectado.\n');

    let running = true;
    while (running) {
        console.log('--- Menu Cafeteria ---');
        console.log('1. Canjear puntos por producto');
        console.log('2. Consultar saldo de cliente');
        console.log('3. Ver historial de cliente');
        console.log('4. Ver info del token');
        console.log('5. Listar todos los clientes');
        console.log('0. Salir');
        console.log('');

        const option = await ask('Opcion: ');

        try {
            switch (option.trim()) {
                case '1': {
                    const clientId = await ask('DNI del cliente: ');

                    // Mostrar saldo actual
                    const balance = await contract.evaluateTransaction('BalanceOf', clientId.trim());
                    console.log(`\nSaldo actual: ${balance.toString()} puntos\n`);

                    // Mostrar catalogo
                    console.log('Catalogo de productos:');
                    Object.entries(CATALOGO).forEach(([key, prod]) => {
                        console.log(`  ${key}. ${prod.nombre} — ${prod.puntos} pts`);
                    });
                    console.log('');

                    const prodKey = await ask('Selecciona producto (1-5): ');
                    const producto = CATALOGO[prodKey.trim()];

                    if (!producto) {
                        console.log('Producto no valido.\n');
                        break;
                    }

                    await contract.submitTransaction('Redeem',
                        clientId.trim(),
                        producto.puntos.toString(),
                        producto.nombre);

                    const newBalance = await contract.evaluateTransaction('BalanceOf', clientId.trim());
                    console.log(`\nCanjeado: ${producto.nombre} (${producto.puntos} pts)`);
                    console.log(`Nuevo saldo: ${newBalance.toString()} puntos\n`);
                    break;
                }
                case '2': {
                    const id = await ask('DNI del cliente: ');
                    const result = await contract.evaluateTransaction('BalanceOf', id.trim());
                    console.log(`\nSaldo: ${result.toString()} puntos\n`);
                    break;
                }
                case '3': {
                    const id = await ask('DNI del cliente: ');
                    const result = await contract.evaluateTransaction('ClientHistory', id.trim());
                    const history = JSON.parse(result.toString());
                    if (!history || history.length === 0) {
                        console.log('\nEl cliente no tiene movimientos.\n');
                    } else {
                        console.log('\nHistorial de movimientos:');
                        history.forEach((tx, i) => {
                            const signo = tx.txType === 'mint' ? '+' : '-';
                            console.log(`  ${i + 1}. [${tx.txType.toUpperCase()}] ${signo}${tx.amount} pts — ${tx.description} (${tx.timestamp})`);
                        });
                        console.log('');
                    }
                    break;
                }
                case '4': {
                    const result = await contract.evaluateTransaction('GetTokenInfo');
                    const info = JSON.parse(result.toString());
                    console.log(`\nToken: ${info.name} (${info.symbol})`);
                    console.log(`Total emitido:   ${info.totalSupply} pts`);
                    console.log(`Total canjeado:  ${info.totalRedeemed} pts`);
                    console.log(`En circulacion:  ${info.totalSupply - info.totalRedeemed} pts\n`);
                    break;
                }
                case '5': {
                    const result = await contract.evaluateTransaction('GetAllClients');
                    const clients = JSON.parse(result.toString());
                    if (!clients || clients.length === 0) {
                        console.log('\nNo hay clientes registrados.\n');
                    } else {
                        console.log('\nClientes registrados:');
                        clients.forEach((c) => {
                            console.log(`  DNI: ${c.clientID} — ${c.name} — ${c.balance} pts`);
                        });
                        console.log('');
                    }
                    break;
                }
                case '0':
                    running = false;
                    break;
                default:
                    console.log('Opcion no valida.\n');
            }
        } catch (error) {
            console.error(`\nError: ${error.message}\n`);
        }
    }

    gateway.disconnect();
    rl.close();
    console.log('Desconectado. Hasta pronto.');
}

main().catch(console.error);
