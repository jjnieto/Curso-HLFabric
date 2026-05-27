'use strict';

// CLI de la organización Mayorista.

const { connectAsOrg, decodeJSON } = require('./utils/fabric-connection');

const COMMANDS = {
    'crear-pedido-fabricante':       { args: ['<pedido-id>', '<lineas-json>'],  handler: crearPedidoFabricante },
    'confirmar-recepcion-fabricante':{ args: ['<pedido-id>'],                   handler: confirmarRecepcionFabricante },
    'transferir-custodia':           { args: ['<serie>', '<destinoMSP>'],       handler: transferirCustodia },
    'aceptar-pedido-minorista':      { args: ['<pedido-id>'],                   handler: aceptarPedidoMinorista },
    'registrar-envio-minorista':     { args: ['<pedido-id>', '<tracking>'],     handler: registrarEnvioMinorista },
    'consultar-producto':            { args: ['<serie>'],                       handler: consultarProducto },
    'consultar-pedido-fabricante':   { args: ['<pedido-id>'],                   handler: consultarPedidoFabricante },
    'consultar-pedido-minorista':    { args: ['<pedido-id>'],                   handler: consultarPedidoMinorista },
    'verificar-autenticidad':        { args: ['<serie>'],                       handler: verificarAutenticidad },
};

async function crearPedidoFabricante(ctx, [pedidoID, lineasJSON]) {
    const cc = ctx.getContract('canal-mayorista', 'cc-pedido');
    await cc.submitTransaction('CrearPedido', pedidoID, lineasJSON);
    console.log(`Pedido ${pedidoID} creado al fabricante.`);
}

async function confirmarRecepcionFabricante(ctx, [pedidoID]) {
    const cc = ctx.getContract('canal-mayorista', 'cc-pedido');
    await cc.submitTransaction('ConfirmarRecepcion', pedidoID);
    console.log(`Recepción del pedido ${pedidoID} (canal-mayorista) confirmada.`);
}

async function transferirCustodia(ctx, [serie, destinoMSP]) {
    const cc = ctx.getContract('canal-trazabilidad', 'cc-producto');
    await cc.submitTransaction('TransferirCustodia', serie, destinoMSP);
    console.log(`Custodia de ${serie} transferida a ${destinoMSP}.`);
}

async function aceptarPedidoMinorista(ctx, [pedidoID]) {
    const cc = ctx.getContract('canal-minorista', 'cc-pedido');
    await cc.submitTransaction('AceptarPedido', pedidoID);
    console.log(`Pedido ${pedidoID} del minorista aceptado.`);
}

async function registrarEnvioMinorista(ctx, [pedidoID, tracking]) {
    const cc = ctx.getContract('canal-minorista', 'cc-pedido');
    await cc.submitTransaction('RegistrarEnvio', pedidoID, tracking);
    console.log(`Envío al minorista ${pedidoID} registrado (tracking ${tracking}).`);
}

async function consultarProducto(ctx, [serie]) {
    const cc = ctx.getContract('canal-trazabilidad', 'cc-producto');
    const result = await cc.evaluateTransaction('ConsultarProducto', serie);
    console.log(JSON.stringify(decodeJSON(result), null, 2));
}

async function consultarPedidoFabricante(ctx, [pedidoID]) {
    const cc = ctx.getContract('canal-mayorista', 'cc-pedido');
    const result = await cc.evaluateTransaction('ConsultarPedido', pedidoID);
    console.log(JSON.stringify(decodeJSON(result), null, 2));
}

async function consultarPedidoMinorista(ctx, [pedidoID]) {
    const cc = ctx.getContract('canal-minorista', 'cc-pedido');
    const result = await cc.evaluateTransaction('ConsultarPedido', pedidoID);
    console.log(JSON.stringify(decodeJSON(result), null, 2));
}

async function verificarAutenticidad(ctx, [serie]) {
    const cc = ctx.getContract('canal-trazabilidad', 'cc-producto');
    const result = await cc.evaluateTransaction('VerificarAutenticidad', serie);
    const history = decodeJSON(result) || [];
    console.log(`Historial de custodia de ${serie} (${history.length} transferencias):`);
    history.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.origen} → ${t.destino} (${t.fecha})`);
    });
}

function printUsage() {
    console.error('Uso: node mayorista.js <comando> [args...]\n');
    console.error('Comandos disponibles:');
    for (const [name, cmd] of Object.entries(COMMANDS)) {
        console.error(`  ${name.padEnd(32)} ${cmd.args.join(' ')}`);
    }
    console.error('\nEjemplo de lineas-json:');
    console.error(`  '[{"producto":"GPU-X","cantidad":10,"precio":100.5}]'`);
}

async function main() {
    const [, , command, ...args] = process.argv;

    if (!command || !COMMANDS[command]) {
        printUsage();
        process.exit(command ? 1 : 0);
    }
    const cmd = COMMANDS[command];
    if (args.length < cmd.args.length) {
        console.error(`Faltan argumentos para '${command}'.`);
        console.error(`Uso: node mayorista.js ${command} ${cmd.args.join(' ')}`);
        process.exit(1);
    }

    const ctx = await connectAsOrg('mayorista');
    try {
        await cmd.handler(ctx, args);
    } catch (err) {
        console.error(`Error ejecutando '${command}': ${err.message}`);
        process.exitCode = 1;
    } finally {
        ctx.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
