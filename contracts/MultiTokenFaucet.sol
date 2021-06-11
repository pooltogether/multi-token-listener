// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.4 <=8.0.0;

import "@openzeppelin/contracts/access/Ownable.sol";

import "@pooltogether/pooltogether-contracts/contracts/token/TokenListener.sol";
import "@pooltogether/pooltogether-contracts/contracts/token-faucet/TokenFaucet.sol";

// import "@pooltogether/pooltogether-generic-registry/contracts/AddressRegistry.sol";
import "./external/AddressRegistry.sol";



/// @title
/// @notice
contract MultiTokenFaucet is Ownable, TokenListener {

    /// @notice registry of TokenFaucet addresses associated with this MultiTokenFacuet
    AddressRegistry public tokenFaucets;


    constructor(address _owner) public {
        tokenFaucets = new AddressRegistry("TokenFaucets", _owner);
        transferOwnership(_owner);
    }

    
    /// @notice Add a TokenFaucet to the registry
    function addTokenFaucets(address[] calldata _faucets) external onlyOwner {      
        tokenFaucets.addAddresses(_faucets);   
    }

    /// @notice Remove a TokenFaucet from the registry
    function removeTokenFaucet(TokenFaucet _previousFaucet, TokenFaucet _faucet) external onlyOwner {
        tokenFaucets.removeAddress(address(_previousFaucet), address(_faucet));
    }

    /// @notice Pass through the beforeTokenMint hook to all the registry TokenFaucets
    function beforeTokenMint(address to, uint256 amount, address controlledToken, address referrer) external override {
        // for each token faucet call beforeTokenTransfer

        address[] memory faucets = tokenFaucets.getAddresses();
        
        for(uint256 i = 0; i < faucets.length; i++){
            TokenFaucet(faucets[i]).beforeTokenMint(to, amount, controlledToken, referrer);
        }

    }

    /// @notice Pass through the beforeTokenTransfer hook to all the registry TokenFaucets
    function beforeTokenTransfer(address from, address to, uint256 amount, address controlledToken) external override {
        // for each token faucet call beforeTokenTransfer
        address[] memory faucets = tokenFaucets.getAddresses();
        
        for(uint256 i = 0; i < faucets.length; i++){
            TokenFaucet(faucets[i]).beforeTokenTransfer(from, to, amount, controlledToken);
        }
    }

}