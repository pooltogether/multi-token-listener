pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "@pooltogether/pooltogether-contracts/contracts/token-faucet/TokenFaucet.sol";
import "@pooltogether/pooltogether-contracts/contracts/token-faucet/TokenFaucetProxyFactory.sol";
import "@pooltogether/pooltogether-contracts/contracts/prize-strategy/multiple-winners/MultipleWinners.sol"; 
import "@pooltogether/pooltogether-contracts/contracts/prize-pool/yield-source/YieldSourcePrizePool.sol"; 
import "@pooltogether/pooltogether-contracts/contracts/prize-pool/compound/CompoundPrizePool.sol"; 
/* solium-disable security/no-block-members */
contract TokenFaucetHarness is TokenFaucet {

  uint32 internal time;

  function setCurrentTime(uint32 _time) external {
    time = _time;
  }

  function _currentTime() internal override view returns (uint32) {
    return time;
  }

}