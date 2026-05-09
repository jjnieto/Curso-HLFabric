// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// Ya desplegado en: 0xFaEC1ce8470b640eebE8a1E73a887FD4534d1884

/// @title MultiTimeLock - Bloquea Ether por usuario hasta que se cumpla el tiempo
contract MultiTimeLock {

    struct Deposit {
        uint256 amount;
        uint256 unlockTime;
    }

    // cada address puede tener un único depósito activo
    mapping(address => Deposit) public deposits;

    /// @notice Cualquiera puede bloquear Ether para sí mismo
    /// @param _secondsToLock tiempo en segundos que se bloquearán los fondos
    function lock(uint256 _secondsToLock) external payable {
        require(msg.value > 0, "Debes enviar ETH");
        require(deposits[msg.sender].amount == 0, "Ya tienes un deposito activo");

        deposits[msg.sender] = Deposit({
            amount: msg.value,
            unlockTime: block.timestamp + _secondsToLock
        });
    }

    /// @notice Retira los fondos una vez pasado el tiempo
    function withdraw() external {
        Deposit storage dep = deposits[msg.sender];
        require(dep.amount > 0, "No tienes deposito");
        require(block.timestamp >= dep.unlockTime, "Aun bloqueado");

        uint256 amount = dep.amount;
        dep.amount = 0; // evitar reentradas
        payable(msg.sender).transfer(amount);
    }
}
