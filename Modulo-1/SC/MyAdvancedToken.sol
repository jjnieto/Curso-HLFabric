// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title  MyAdvancedToken — ERC-20 con owner, mint, burn y allowance segura
/// @author Curso HL Fabric — Módulo 1
/// @notice Versión "siguiente paso" de BasicERC20 (MyToken.sol). Añade lo que
///         hace falta para que un token sea utilizable en proyectos reales:
///
///         1. Owner único con transferOwnership / renounceOwnership.
///         2. mint(): solo el owner crea tokens nuevos. Aumenta totalSupply.
///         3. burn(): cualquier holder quema sus propios tokens.
///            burnFrom(): un spender autorizado quema tokens de otro
///            (igual que transferFrom pero hacia "fuera" de la red).
///         4. increaseAllowance / decreaseAllowance: parches contra el
///            front-running clásico de approve(). Cambian el allowance
///            de forma atómica respecto al valor actual, en lugar de
///            sobrescribirlo a un valor arbitrario.
///         5. Eventos adicionales: Mint, Burn, OwnershipTransferred.
///
/// @dev    El contrato es autocontenido — no depende de OpenZeppelin para
///         que el alumno vea cómo se implementan los patrones a mano. En
///         producción es preferible usar OpenZeppelin (auditado, mantenido).
contract MyAdvancedToken {

    // ============================================================
    // Metadata
    // ============================================================

    /// @notice Nombre legible del token.
    string public constant name = "MyAdvancedToken";

    /// @notice Símbolo corto del token.
    string public constant symbol = "MATK";

    /// @notice Decimales. 18 es el estándar de Ethereum (1 token = 10^18 unidades base).
    uint8 public constant decimals = 18;

    /// @notice Suministro total en unidades base.
    uint256 public totalSupply;

    // ============================================================
    // Balances y allowances (idéntico a ERC-20 estándar)
    // ============================================================

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ============================================================
    // Ownership
    // ============================================================

    /// @notice Dirección con privilegios para mint y otras operaciones administrativas.
    ///         Si vale address(0), el contrato es "renunciado": ya no hay nadie que pueda mintear.
    address public owner;

    /// @dev Modifier que limita la ejecución al owner actual. Lo usan mint(),
    ///      transferOwnership() y renounceOwnership().
    modifier onlyOwner() {
        require(msg.sender == owner, "MyAdvancedToken: solo el owner");
        _;
    }

    // ============================================================
    // Eventos
    // ============================================================

    /// @notice Estándar ERC-20: se emite tanto en transfer normal como en mint (from=0) y burn (to=0).
    event Transfer(address indexed from, address indexed to, uint256 value);

    /// @notice Estándar ERC-20: se emite cada vez que cambia un allowance.
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// @notice No-estándar pero útil: se emite cuando el owner crea tokens nuevos.
    event Mint(address indexed to, uint256 value);

    /// @notice No-estándar pero útil: se emite cuando alguien quema tokens.
    event Burn(address indexed from, uint256 value);

    /// @notice Se emite al cambiar de owner (incluida la renuncia, donde newOwner = 0).
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============================================================
    // Constructor
    // ============================================================

    /// @param initialSupply Cantidad inicial en unidades "humanas" que recibe el owner.
    /// @dev Si initialSupply = 0, el contrato arranca con supply 0 y depende
    ///      del mint() posterior para emitir.
    constructor(uint256 initialSupply) {
        // Quien despliega es el owner inicial.
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);

        // Mint inicial opcional.
        if (initialSupply > 0) {
            uint256 amount = initialSupply * 10 ** uint256(decimals);
            totalSupply = amount;
            balanceOf[msg.sender] = amount;
            // Doble evento: Transfer por compatibilidad ERC-20 y Mint para claridad.
            emit Transfer(address(0), msg.sender, amount);
            emit Mint(msg.sender, amount);
        }
    }

    // ============================================================
    // Funciones ERC-20 estándar
    // ============================================================

    /// @notice Transferir `value` tokens desde el caller hacia `to`.
    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    /// @notice Autorizar a `spender` a gastar hasta `value` en nombre del caller.
    /// @dev    Esta función SIGUE teniendo la vulnerabilidad del front-running
    ///         heredada del estándar ERC-20. La incluimos para compatibilidad,
    ///         pero la recomendación es usar increaseAllowance / decreaseAllowance.
    function approve(address spender, uint256 value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    /// @notice Transferir `value` desde `from` hacia `to` consumiendo allowance del caller.
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= value, "MyAdvancedToken: allowance insuficiente");

        // Reducimos el allowance ANTES de transferir (checks-effects-interactions).
        // unchecked porque ya verificamos que current >= value.
        unchecked {
            _approve(from, msg.sender, currentAllowance - value);
        }
        _transfer(from, to, value);
        return true;
    }

    // ============================================================
    // Parches del approve clásico
    // ============================================================

    /// @notice Incrementa el allowance de `spender` en `addedValue` de forma atómica.
    /// @dev    No tiene la vulnerabilidad del approve() clásico porque parte
    ///         del valor actual, no lo sobrescribe.
    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        _approve(msg.sender, spender, allowance[msg.sender][spender] + addedValue);
        return true;
    }

    /// @notice Decrementa el allowance de `spender` en `subtractedValue` de forma atómica.
    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint256 currentAllowance = allowance[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "MyAdvancedToken: decrementa por debajo de cero");
        unchecked {
            _approve(msg.sender, spender, currentAllowance - subtractedValue);
        }
        return true;
    }

    // ============================================================
    // Mint y Burn
    // ============================================================

    /// @notice Crear `amount` tokens nuevos y enviárselos a `to`. Solo owner.
    /// @dev    `amount` está en unidades base (10^decimals). Para crear 100 tokens
    ///         humanos llama con amount = 100 * 10**18.
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "MyAdvancedToken: mint a address cero");

        totalSupply += amount;
        balanceOf[to] += amount;

        emit Transfer(address(0), to, amount);
        emit Mint(to, amount);
    }

    /// @notice Quemar `amount` tokens del caller (reducir su balance y el supply total).
    /// @dev    Es la operación contraria a mint. Disponible para CUALQUIER holder.
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /// @notice Quemar `amount` tokens de `account`. Requiere allowance previo.
    /// @dev    Útil para contratos que custodian tokens y deben destruirlos.
    ///         Ejemplo: un protocolo que bloquea collateral y lo quema al liquidar.
    function burnFrom(address account, uint256 amount) external {
        uint256 currentAllowance = allowance[account][msg.sender];
        require(currentAllowance >= amount, "MyAdvancedToken: allowance insuficiente para burn");
        unchecked {
            _approve(account, msg.sender, currentAllowance - amount);
        }
        _burn(account, amount);
    }

    // ============================================================
    // Gestión de ownership
    // ============================================================

    /// @notice Transferir el rol de owner a `newOwner`. Solo owner actual.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "MyAdvancedToken: nuevo owner no puede ser address(0)");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Renunciar al rol de owner. Hace el contrato "trustless" para mint.
    /// @dev    OPERACIÓN IRREVERSIBLE. Tras llamar a esto, NADIE puede volver
    ///         a mintear. Se usa cuando el supply ya está fijo y se quiere
    ///         demostrar a la comunidad que no habrá más emisión.
    function renounceOwnership() external onlyOwner {
        address previousOwner = owner;
        owner = address(0);
        emit OwnershipTransferred(previousOwner, address(0));
    }

    // ============================================================
    // Funciones internas (no expuestas en el ABI)
    // ============================================================

    /// @dev Lógica compartida de transferencia. La usan transfer y transferFrom.
    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "MyAdvancedToken: transfer a address cero");
        require(balanceOf[from] >= value, "MyAdvancedToken: saldo insuficiente");

        // unchecked tras la comprobación de require: ahorra un poco de gas
        // sin perder seguridad.
        unchecked {
            balanceOf[from] -= value;
            balanceOf[to] += value;
        }

        emit Transfer(from, to, value);
    }

    /// @dev Lógica compartida de approve. La usan approve, increase/decreaseAllowance,
    ///      transferFrom y burnFrom.
    function _approve(address tokenOwner, address spender, uint256 value) internal {
        require(tokenOwner != address(0), "MyAdvancedToken: owner cero");
        require(spender != address(0), "MyAdvancedToken: spender cero");
        allowance[tokenOwner][spender] = value;
        emit Approval(tokenOwner, spender, value);
    }

    /// @dev Lógica compartida de quemado. La usan burn y burnFrom.
    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "MyAdvancedToken: saldo insuficiente");

        unchecked {
            balanceOf[from] -= amount;
            totalSupply -= amount;
        }

        // Doble evento: Transfer hacia address(0) por compatibilidad ERC-20, y Burn para claridad.
        emit Transfer(from, address(0), amount);
        emit Burn(from, amount);
    }
}
