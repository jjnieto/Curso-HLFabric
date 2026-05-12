// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Counter {

    uint public count;

    address public owner;

    mapping(address => bool) public whitelist;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Solo el owner puede hacer esto");
        _;
    }

    modifier onlyWhitelisted() {
        require(whitelist[msg.sender], "No estas en la whitelist");
        _;
    }

    function addToWhitelist(address user) external onlyOwner {
        whitelist[user] = true;
    }

    function removeFromWhitelist(address user) external onlyOwner {
        whitelist[user] = false;
    }

    function increment() external onlyWhitelisted {
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