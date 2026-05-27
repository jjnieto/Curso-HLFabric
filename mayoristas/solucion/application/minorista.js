'use strict';

// CLI de la organización Minorista.

const { connectAsOrg, decodeJSON } = require('./utils/fabric-connection');

const COMMANDS = {
    'crear-pedido-mayorista':       { args: ['<pedido-id>', '<lineas-json>'], handler: crearPedidoMayorista },
    'confirmar-recepcion-mayorista':{ args: ['<pedido-id>'],                  handler: confirmarRecepcionMayorista },
    'activar-garantia':             { args: ['<serie>', '<clienteFinal>', '<meses>'], handler: activarGarantia },
    'reclamar-garantia':            { args: ['<serie>', '<motivo>'],          handler: reclamarGarantia },
    'verificar-autenticidad':       { args: ['<serie>'],                      handler: verificarAutenticidad },
    'consultar-producto':           { args: ['<serie>'],                      handler: consultarProducto },
    'consultar-garantia':           { args: ['<serie>'],                      handler: consultarGarantia },
    'consultar-pedido':             { args: ['<pedido-id>'],                  handler: consultarPedido },
};

async function crearPedidoMayorista(ctx, [pedidoID, lineasJSON]) {
    const cc = ctx.getContract('canal-minorista', 'cc-pedido');
    await cc.submitTransaction('CrearPedido', pedidoID, lineasJSON);
    console.log(`Pedido ${pedidoID} creado al mayorista.`);
}

async function confirmarRecepcionMayorista(ctx, [pedidoID]) {
    const cc = ctx.getContract('canal-minorista', 'cc-pedido');
    await cc.submitTransaction('ConfirmarRecepcion', pedidoID);
    console.log(`Recepción del pedido ${pedidoID} (canal-minorista) confirmada.`);
}

async function activarGarantia(ctx, [serie, clienteFinal, mesesStr]) {
    const cc = ctx.getContract('canal-trazabilidad', 'cc-garantia');
    await cc.submitTransaction('ActivarGarantia', serie, clienteFinal, mesesStr);
    console.log(`Garantía activada para ${serie} (cliente: ${clienteFinal}, ${mesesStr} meses).`);
}

async function reclamarGarantia(ctx, [serie, motivo]) {
    const cc = ctx.getContract('canal-trazabilidad', 'cc-garantia');
    const result = await cc.submitTransaction('ReclamarGarantia', serie, motivo);
    const reclamacionID = new TextDecoder().decode(result);
    console.log(`Reclamación abierta: ${reclamacionID}`);
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

async function consultarProducto(ctx, [serie]) {
    const cc = ctx.getContract('canal-trazabilidad', 'cc-producto');
    const result = await cc.evaluateTransaction('ConsultarProducto', serie);
    console.log(JSON.stringify(decodeJSON(result), null, 2));
}

async function consultarGarantia(ctx, [serie]) {
    const cc = ctx.getContract('canal-trazabilidad', 'cc-garantia');
    const result = await cc.evaluateTransaction('ConsultarGarantia', serie);
    console.log(JSON.stringify(decodeJSON(result), null, 2));
}

async function consultarPedido(ctx, [pedidoID]) {
    const cc = ctx.getContract('canal-minorista', 'cc-pedido');
    const result = await cc.evaluateTransaction('ConsultarPedido', pedidoID);
    console.log(JSON.stringify(decodeJSON(result), null, 2));
}

function printUsage() {
    console.error('Uso: node minorista.js <comando> [args...]\n');
    console.error('Comandos disponibles:');
    for (const [name, cmd] of Object.entries(COMMANDS)) {
        console.error(`  ${name.padEnd(32)} ${cmd.args.join(' ')}`);
    }
    console.error('\nEjemplo de lineas-json:');
    console.error(`  '[{"producto":"GPU-X","cantidad":2,"precio":150.0}]'`);
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
        console.error(`Uso: node minorista.js ${command} ${cmd.args.join(' ')}`);
        process.exit(1);
    }

    const ctx = await connectAsOrg('minorista');
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
