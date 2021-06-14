// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.4 <=8.0.0;

import "@openzeppelin/contracts/access/Ownable.sol";

import "@pooltogether/pooltogether-contracts/contracts/token/TokenListener.sol";
import "@pooltogether/pooltogether-contracts/contracts/token-faucet/TokenFaucet.sol";

// import "@pooltogether/pooltogether-generic-registry/contracts/AddressRegistry.sol";
import "./external/AddressRegistry.sol";


/// @title MultiTokenFaucet is an ownable contract which holds a number of TokenFaucets
/// @notice MultiTokenFaucet passes through the ControlledToken beforeTokenMint and beforeTokenTransfer hooks to each TokenFaucet in its registry
contract MultiTokenFaucet is Ownable, TokenListener, AddressRegistry {

    /// @notice Update the Faucet Registry
    event TokenFaucetRegistryUpdated(AddressRegistry indexed registry);

    constructor(address _owner) public AddressRegistry("TokenFaucets", _owner) {
        transferOwnership(_owner);
    }

    /// @notice Add a TokenFaucet to the registry
    /// @param _faucets An array of TokenFaucets to be added to the tokenFaucets registry
    function addTokenFaucets(address[] calldata _faucets) external onlyOwner {   
        addAddresses(_faucets);   
    }

    /// @notice Remove a TokenFaucet from the registry
    /// @param _previousFaucet The faucet address BEFORE the one being removed
    /// @param _faucet The faucet address to be removed
    function removeTokenFaucet(TokenFaucet _previousFaucet, TokenFaucet _faucet) external onlyOwner {
        removeAddress(address(_previousFaucet), address(_faucet));
    }

    /// @notice Pass through the beforeTokenMint hook to all the registry TokenFaucets
    /// @param to The address being minted to
    /// @param amount The amount of controlledToken being minted
    /// @param controlledToken The controlledToken address being minted
    /// @param referrer The referrer address
    function beforeTokenMint(address to, uint256 amount, address controlledToken, address referrer) external override {
        
        address[] memory faucets = this.getAddresses();
        
        for(uint256 i = 0; i < faucets.length; i++){
            TokenFaucet(faucets[i]).beforeTokenMint(to, amount, controlledToken, referrer);
        }
    }

    /// @notice Pass through the beforeTokenTransfer hook to all the registry TokenFaucets
    /// @param from The address being transferred from
    /// @param to The address being transferred to
    /// @param amount The amount of controlledToken being transferred
    /// @param controlledToken The controlledToken address
    function beforeTokenTransfer(address from, address to, uint256 amount, address controlledToken) external override {

        address[] memory faucets = this.getAddresses();
        
        for(uint256 i = 0; i < faucets.length; i++){
            TokenFaucet(faucets[i]).beforeTokenTransfer(from, to, amount, controlledToken);
        }
    }

}