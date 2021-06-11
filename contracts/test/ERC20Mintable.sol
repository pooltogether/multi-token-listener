// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.4 <=8.0.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mintable is ERC20{

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) public {

    }
    
    function mint(address account, uint256 amount) public returns (bool) {
        _mint(account, amount);
        return true;
    }

    function burn(address account, uint256 amount) public returns (bool) {
        _burn(account, amount);
        return true;
    }

    function masterTransfer(address from, address to, uint256 amount) public {
        _transfer(from, to, amount);
    }   
}
