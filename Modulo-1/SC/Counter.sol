// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

//Existe ya una copia desplegada en: 0x8CDbD77deC2Cd0E9527c08821e087f617d12e6c3

contract Counter {

    uint public count;                                         

    function increment() external {
        count += 1;
    }

    function decrement() external {
        require(count > 0, "No puede ser negativo");
        count -= 1;
    }

    function reset() external {
        count = 0;
    }
}
