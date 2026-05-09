// SPDX-License-Identifier: MIT         ← Cabecera obligatoria con la licencia
pragma solidity ^0.8.20;                  ← Versión del compilador (igual o superior a 0.8.20)

contract Counter {                       ← Declara el contrato (como una clase)

    uint public count;                  ← Variable de estado pública. Vive en la blockchain.
                                         Solidity genera automáticamente un getter "count()".

    function increment() external {    ← Función pública. Modifica estado → cuesta gas.
        count += 1;                       ← Suma 1 al contador. Esto se grabará en blockchain.
    }

    function decrement() external {
        require(count > 0, "No puede ser negativo");  ← Si la condición falla, revierte la tx.
        count -= 1;
    }

    function reset() external {
        count = 0;
    }
}
