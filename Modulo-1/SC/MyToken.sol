// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BasicERC20 — implementación mínima del estándar ERC-20
/// @notice Token fungible básico. Pensado como ejemplo didáctico: se queda
///         deliberadamente con lo justo para entender el estándar.
/// @dev    Limitaciones conocidas (en MyAdvancedToken.sol están resueltas):
///         - No hay mint ni burn: el supply queda fijado en el deploy.
///         - No hay owner ni control de acceso.
///         - approve() tiene el "front-running classic": si cambias de un
///           valor X > 0 a uno nuevo Y > 0, un spender malicioso puede
///           gastar X+Y. Solución: increaseAllowance / decreaseAllowance.
///         - No bloquea transferencias a address(0); ERC-20 estricto sí lo hace.
contract BasicERC20 {

    // ============================================================
    // Metadata del token
    // ============================================================

    /// @notice Nombre legible del token. Lo usa Etherscan, MetaMask, etc.
    string public name = "MyToken";

    /// @notice Símbolo corto (lo que se ve en wallets).
    string public symbol = "MTK";

    /// @notice Cantidad de decimales que se usan al "mostrar" balances.
    /// @dev Internamente todo se guarda en unidades enteras (uint256).
    ///      Si decimals=6 y balanceOf[X]=1_000_000, X tiene 1 "token humano".
    ///      USDC y USDT usan 6; la mayoría de tokens ERC-20 usan 18.
    uint8 public decimals = 6;

    /// @notice Suministro total emitido del token (en unidades base, no humanas).
    uint256 public totalSupply;

    // ============================================================
    // Estado: balances y allowances
    // ============================================================

    /// @notice Cuántos tokens tiene cada dirección. ERC-20 expone esto como getter.
    mapping(address => uint256) public balanceOf;

    /// @notice Cuánto puede gastar un "spender" en nombre de un "owner".
    /// @dev allowance[owner][spender] = cuántos tokens del owner puede mover el spender.
    mapping(address => mapping(address => uint256)) public allowance;

    // ============================================================
    // Eventos (los que exige ERC-20)
    // ============================================================

    /// @notice Se emite en CADA transferencia, incluyendo creación (from = 0) y quemado (to = 0).
    /// @dev Los 'indexed' permiten que las wallets puedan filtrar eventos por dirección.
    event Transfer(address indexed from, address indexed to, uint256 value);

    /// @notice Se emite cada vez que se concede una autorización con approve().
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ============================================================
    // Constructor
    // ============================================================

    /// @param initialSupply Cantidad inicial en unidades "humanas" (ej. 1000 = 1000 tokens).
    /// @notice Quien despliega el contrato (msg.sender) recibe todo el suministro inicial.
    constructor(uint256 initialSupply) {
        // initialSupply se multiplica por 10^decimals para pasar a unidades internas.
        totalSupply = initialSupply * 10 ** uint256(decimals);
        balanceOf[msg.sender] = totalSupply; // todo el supply para el creador

        // Por convención ERC-20, una "creación" (mint) se representa como una
        // transferencia desde la address cero. Esto permite que exploradores
        // como Etherscan detecten correctamente la operación.
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    // ============================================================
    // Funciones estándar ERC-20
    // ============================================================

    /// @notice Mover `value` tokens DESDE quien llama HACIA `to`.
    /// @return true si la operación tiene éxito (revert con causa si falla).
    function transfer(address to, uint256 value) public returns (bool) {
        // Comprobación de saldo. En Solidity 0.8+ el underflow ya hace revert
        // por sí solo, pero ponemos el require para devolver un error legible.
        require(balanceOf[msg.sender] >= value, "Saldo insuficiente");

        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;

        emit Transfer(msg.sender, to, value);
        return true;
    }

    /// @notice Autorizar a `spender` a gastar hasta `value` tokens en mi nombre.
    /// @dev    Esta función tiene la vulnerabilidad clásica de "front-running":
    ///         si pasas de un valor X > 0 a otro Y > 0, el spender puede
    ///         "vaciar" X antes de que el cambio se confirme y luego usar
    ///         también los Y nuevos. El parche recomendado por la comunidad
    ///         es ponerlo a 0 primero, o usar increaseAllowance/decreaseAllowance
    ///         (ver MyAdvancedToken.sol).
    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /// @notice Mover `value` tokens desde `from` hacia `to`, gastando del allowance.
    /// @dev    El llamante (msg.sender) tiene que tener allowance suficiente
    ///         concedido por `from`. Esta es la función que usan DEXs y
    ///         contratos que custodian tokens en nombre de terceros.
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(balanceOf[from] >= value, "Saldo insuficiente");
        require(allowance[from][msg.sender] >= value, "No autorizado");

        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;

        emit Transfer(from, to, value);
        return true;
    }
}
