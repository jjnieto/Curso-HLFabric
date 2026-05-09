// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Counter {

    uint public count;                                         

    function increment() external {
        count += 1;
    }

    function decrement() external {
        require(count > 0, "No puede ser negativo");  ← Si la condición falla, revierte la tx.
        count -= 1;
    }

    function reset() external {
        count = 0;
    }
}
