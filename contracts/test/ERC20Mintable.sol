// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.4 <=8.0.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mintable is ERC20{

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) public {

    }   
}
