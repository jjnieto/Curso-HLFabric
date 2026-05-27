'use strict';

// CLI de la organización Fabricante.
// Subcomandos (ejecuta `node fabricante.js` sin args para verlos).

const { connectAsOrg, decode, decodeJSON } = require('./utils/fabric-connection');

const COMMANDS = {
    'registrar-producto':    { args: ['<serie>', '<modelo>', '<lote>'],   handler: registrarProducto },
    'transferir-custodia':   { args: ['<serie>', '<destinoMSP>'],         handler: transferirCustodia },
    'aceptar-pedido':        { args: ['<pedido-id>'],                     handler: aceptarPedido },
    'registrar-envio':       { args: ['<pedido-id>', '<tracking>'],       handler: registrarEnvio },
    'resolver-reclamacion':  { args: ['<reclamacion-id>', '<resolucion>', '<aceptada:true|false>'], handler: resolverReclamacion },
    'consultar-producto':    { args: ['<serie>'],                         handler: consultarProducto },
    'consultar-pedido':      { args: ['<pedido-id>'],                     handler: consultarPedido },
    'verificar-autenticidad':{ args: ['<serie>'],                         handler: verificarAutenticidad },
};

async function registrarProducto(ctx, [serie, modelo, lote]) {
    const cc = ctx.getContract('canal-trazabilidad', 'cc-producto');
    await cc.submitTransaction('RegistrarProducto', serie, modelo, lote);
    console.log(`Producto ${serie} (${modelo}, lote ${lote}) registrado.`);
}

async function transferirCustodia(ctx, [serie, destinoMSP]) {
    const cc = ctx.getContract('canal-trazabilidad', 'cc-producto');
    await cc.submitTransaction('TransferirCustodia', serie, destinoMSP);
    console.log(`Custodia de ${serie} transferida a ${destinoMSP}.`);
}

async function aceptarPedido(ctx, [pedidoID]) {
    const cc = ctx.getContract('canal-mayorista', 'cc-pedido');
    await cc.submitTransaction('AceptarPedido', pedidoID);
    console.log(`Pedido ${pedidoID} aceptado.`);
}

async function registrarEnvio(ctx, [pedidoID, tracking]) {
    const cc = ctx.getContract('canal-mayorista', 'cc-pedido');
    await cc.submitTransaction('RegistrarEnvio', pedidoID, tracking);
    console.log(`Envío del pedido ${pedidoID} registrado con tracking ${tracking}.`);
}

async function resolverReclamacion(ctx, [reclamacionID, resolucion, aceptadaStr]) {
    const aceptada = aceptadaStr === 'true';
    const cc = ctx.getContract('canal-trazabilidad', 'cc-garantia');
    await cc.submitTransaction('ResolverReclamacion', reclamacionID, resolucion, String(aceptada));
    console.log(`Reclamación ${reclamacionID} ${aceptada ? 'ACEPTADA' : 'RECHAZADA'}: ${resolucion}`);
}

async function consultarProducto(ctx, [serie]) {
    const cc = ctx.getContract('canal-trazabilidad', 'cc-producto');
    const result = await cc.evaluateTransaction('ConsultarProducto', serie);
    console.log(JSON.stringify(decodeJSON(result), null, 2));
}

async function consultarPedido(ctx, [pedidoID]) {
    const cc = ctx.getContract('canal-mayorista', 'cc-pedido');
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
    console.error('Uso: node fabricante.js <comando> [args...]\n');
    console.error('Comandos disponibles:');
    for (const [name, cmd] of Object.entries(COMMANDS)) {
        console.error(`  ${name.padEnd(25)} ${cmd.args.join(' ')}`);
    }
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
        console.error(`Uso: node fabricante.js ${command} ${cmd.args.join(' ')}`);
        process.exit(1);
    }

    const ctx = await connectAsOrg('fabricante');
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
