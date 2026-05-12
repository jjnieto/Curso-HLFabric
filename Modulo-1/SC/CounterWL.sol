// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

//Versión ya deplegda y verificada: 0xf72e5734e0e7428E9546Ab1BBC23EEd227B22155

/*
    Smart contract sencillo de contador con control de acceso.

    - Existe un owner (el que despliega el contrato).
    - El owner puede gestionar una whitelist.
    - Solo las direcciones en whitelist pueden incrementar el contador.
    - El resto de funciones siguen siendo públicas.
*/

contract Counter {

    // Variable pública que almacena el valor actual del contador.
    // Solidity crea automáticamente una función getter llamada count().
    uint public count;

    // Dirección del propietario del contrato.
    // Será quien despliegue el contrato.
    address public owner;

    /*
        Mapping que almacena qué direcciones están autorizadas.

        Ejemplo:
        whitelist[0x123...] = true;

        Si una dirección tiene valor true,
        podrá ejecutar la función increment().
    */
    mapping(address => bool) public whitelist;

    /*
        Constructor:
        se ejecuta UNA sola vez al desplegar el contrato.
    */
    constructor() {

        // msg.sender es la cuenta que ejecuta el deploy.
        owner = msg.sender;
    }

    /*
        Modifier que restringe el acceso únicamente al owner.
    */
    modifier onlyOwner() {

        // Verificamos que quien llama sea el propietario.
        require(
            msg.sender == owner,
            "Solo el owner puede hacer esto"
        );

        // Continúa con la ejecución de la función.
        _;
    }

    /*
        Modifier que restringe el acceso
        solo a usuarios en whitelist.
    */
    modifier onlyWhitelisted() {

        // Verifica que la direccion esté autorizada.
        require(
            whitelist[msg.sender],
            "No estas en la whitelist"
        );

        _;
    }

    /*
        Añade una direccion a la whitelist.

        Solo el owner puede hacerlo.
    */
    function addToWhitelist(address user)
        external
        onlyOwner
    {
        whitelist[user] = true;
    }

    /*
        Elimina una direccion de la whitelist.

        Solo el owner puede hacerlo.
    */
    function removeFromWhitelist(address user)
        external
        onlyOwner
    {
        whitelist[user] = false;
    }

    /*
        Incrementa el contador en 1.

        SOLO usuarios autorizados.
    */
    function increment()
        external
        onlyWhitelisted
    {
        count += 1;
    }

    /*
        Decrementa el contador en 1.

        Puede ejecutarlo cualquiera.

        Se evita que el contador sea negativo.
    */
    function decrement() external {

        require(
            count > 0,
            "No puede ser negativo"
        );

        count -= 1;
    }

    /*
        Reinicia el contador a cero.

        Puede ejecutarlo cualquiera.
    */
    function reset() external {
        count = 0;
    }
}