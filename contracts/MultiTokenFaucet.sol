// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.4 <=8.0.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@pooltogether/pooltogether-contracts/contracts/token/TokenListener.sol";
import "@pooltogether/pooltogether-contracts/contracts/token-faucet/TokenFaucet.sol";

import "./external/AddressRegistry.sol";

/// @title MultiTokenFaucet is an ownable contract which holds a number of TokenFaucets
/// @notice MultiTokenFaucet passes through the ControlledToken beforeTokenMint and beforeTokenTransfer hooks to each TokenFaucet in its registry
contract MultiTokenFaucet is Ownable, TokenListener, AddressRegistry {


    constructor(address _owner) public AddressRegistry("TokenFaucets", _owner) {
        transferOwnership(_owner);
    }

    /// @notice Pass through the beforeTokenMint hook to all the registry TokenFaucets
    /// @param to The address being minted to
    /// @param amount The amount of controlledToken being minted
    /// @param controlledToken The controlledToken address being minted
    /// @param referrer The referrer address
    function beforeTokenMint(address to, uint256 amount, address controlledToken, address referrer) external override {

        address faucet = addressList.start();

        while(faucet != addressList.end()){
            TokenFaucet(faucet).beforeTokenMint(to, amount, controlledToken, referrer);
            faucet = addressList.next(faucet);
        }
    }

    /// @notice Pass through the beforeTokenTransfer hook to all the registry TokenFaucets
    /// @param from The address being transferred from
    /// @param to The address being transferred to
    /// @param amount The amount of controlledToken being transferred
    /// @param controlledToken The controlledToken address
    function beforeTokenTransfer(address from, address to, uint256 amount, address controlledToken) external override {

        address faucet = addressList.start();

        while(faucet != addressList.end()){
            TokenFaucet(faucet).beforeTokenTransfer(from, to, amount, controlledToken);
            faucet = addressList.next(faucet);
        }
    }

}