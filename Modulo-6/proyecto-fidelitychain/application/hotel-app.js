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

async function main() {
    console.log('=== FidelityChain — App Hotel ===\n');
    console.log('Conectando a la red Fabric como HotelMSP...');

    const { gateway, contract } = await connectToFabric('hotel');
    console.log('Conectado.\n');

    let running = true;
    while (running) {
        console.log('--- Menu Hotel ---');
        console.log('1. Registrar cliente (por DNI)');
        console.log('2. Emitir puntos');
        console.log('3. Consultar saldo');
        console.log('4. Ver historial de cliente');
        console.log('5. Ver info del token');
        console.log('6. Listar todos los clientes');
        console.log('0. Salir');
        console.log('');

        const option = await ask('Opcion: ');

        try {
            switch (option.trim()) {
                case '1': {
                    const id = await ask('DNI del cliente: ');
                    const name = await ask('Nombre completo: ');
                    await contract.submitTransaction('RegisterClient', id.trim(), name.trim());
                    console.log(`\nCliente registrado: ${name.trim()} (DNI: ${id.trim()})\n`);
                    break;
                }
                case '2': {
                    const id = await ask('DNI del cliente: ');
                    const amount = await ask('Puntos a emitir: ');
                    const desc = await ask('Motivo: ');
                    await contract.submitTransaction('Mint', id.trim(), amount.trim(), desc.trim());
                    console.log(`\n${amount.trim()} puntos emitidos al cliente ${id.trim()}.\n`);
                    break;
                }
                case '3': {
                    const id = await ask('DNI del cliente: ');
                    const result = await contract.evaluateTransaction('BalanceOf', id.trim());
                    console.log(`\nSaldo: ${result.toString()} puntos\n`);
                    break;
                }
                case '4': {
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
                case '5': {
                    const result = await contract.evaluateTransaction('GetTokenInfo');
                    const info = JSON.parse(result.toString());
                    console.log(`\nToken: ${info.name} (${info.symbol})`);
                    console.log(`Total emitido:   ${info.totalSupply} pts`);
                    console.log(`Total canjeado:  ${info.totalRedeemed} pts`);
                    console.log(`En circulacion:  ${info.totalSupply - info.totalRedeemed} pts\n`);
                    break;
                }
                case '6': {
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
