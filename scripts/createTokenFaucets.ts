import { factoryDeploy } from "@pooltogether/pooltogether-proxy-factory-package"

const hardhat = require('hardhat')
const chalk = require("chalk")
const { ethers, deployments, getChainId } = hardhat

const tokenFaucetProxyFactoryAddress = "0xE4E9cDB3E139D7E8a41172C20b6Ed17b6750f117" // deployed on real mainnet -dont change
const multiTokenFaucetImplemenationAddress = "0x037e907fFA9df4f8D13dA5B0BE5e9F317AD6e0Ef" // update to that in when deployment ran
const pool = "0x0cec1a9154ff802e7934fc916ed7ca50bde6844e"
const timelockAddress = "0x42cd8312d2bce04277dd5161832460e95b24262e"


async function getProxy(tx:any) { 
  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const tokenFaucetProxyFactory = await ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryAddress, gnosisSafe)
  const createResultReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
  const createResultEvents = createResultReceipt.logs.map((log:any) => { try { return tokenFaucetProxyFactory.interface.parseLog(log) } catch (e) { return null } })
  return createResultEvents[0].args.proxy
}



async function run() {
  
  await hardhat.ethers.provider.send("hardhat_impersonateAccount",[timelockAddress])
  await hardhat.ethers.provider.send("hardhat_impersonateAccount",["0xF977814e90dA44bFA03b6295A0616a897441aceC"]) // ether rich binance account

  const binance = await ethers.provider.getUncheckedSigner('0xF977814e90dA44bFA03b6295A0616a897441aceC')

  await binance.sendTransaction({ to: timelockAddress, value: ethers.utils.parseEther('1') })
  
  const gnosisSafe = await ethers.provider.getUncheckedSigner(timelockAddress)
  const tokenFaucetProxyFactory = await ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryAddress, gnosisSafe)

  const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, gnosisSafe)
  // existing maninnet multiple winners addresses
  const daiPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x178969A87a78597d303C47198c66F68E8be67Dc2', gnosisSafe)
  const usdcPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x3d9946190907ada8b70381b25c71eb9adf5f9b7b', gnosisSafe)
  const uniPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0xe8726B85236a489a8E84C56c95790d07a368f913', gnosisSafe)

  const multiTokenFaucetAbi = (await hardhat.artifacts.readArtifact("MultiTokenFaucet")).abi
  const multiTokenFaucetInterface = new ethers.utils.Interface(multiTokenFaucetAbi)

  const initializerArgs: string = multiTokenFaucetInterface.encodeFunctionData(multiTokenFaucetInterface.getFunction("initialize(address)"),
      [
        timelockAddress  // _owner
      ]
  )

  console.log("multiTokenFaucetImplemenationAddress ", multiTokenFaucetImplemenationAddress)

  console.log(`now deploying multitokenfaucet using factoryDeploy`)
  const multiTokenFaucetResult = await factoryDeploy({
    implementationAddress: multiTokenFaucetImplemenationAddress,
    contractName: "MultiTokenFaucetInstance",
    initializeData: initializerArgs,
    provider: ethers.provider,
    signer: gnosisSafe
  })
  console.log("MultiTokenFaucet at ", multiTokenFaucetResult.address)


  console.log(`Creating dai TokenFaucet...`)
  const daiDripAmount = ethers.utils.parseEther('2000')
  const daiDripRate = daiDripAmount.div(98 * 24 * 3600)
  const daiTicket = await daiPrizeStrategy.ticket()
  const createResultTx = await tokenFaucetProxyFactory.create(pool,daiTicket , daiDripRate)
  console.log(`getting Dai TokenFaucet address `)
  const daiTokenFaucet = await getProxy(createResultTx)
  
  
  console.log(`Created Dai TokenFaucet at ${daiTokenFaucet}!`)
  await poolToken.transfer(daiTokenFaucet, daiDripAmount)
  console.log(`Transferred ${daiDripAmount} to ${daiTokenFaucet}`)


  console.log(`Creating usdc TokenFaucet...`)
  const usdcTokenFaucetTx = await tokenFaucetProxyFactory.create(pool, await usdcPrizeStrategy.ticket(), daiDripRate)
  console.log(`Retrieving proxy...`)
  const usdcTokenFaucet = await getProxy(usdcTokenFaucetTx)
  
  console.log(`Created usdc TokenFaucet at ${usdcTokenFaucet}!`)
  await poolToken.transfer(usdcTokenFaucet, daiDripAmount)
  console.log(`Transferred ${daiDripAmount} to ${usdcTokenFaucet}`)


  console.log(`Creating uni TokenFaucet...`)
  const uniDripAmount = ethers.utils.parseEther('2000')
  const uniDripRate = uniDripAmount.div(98 * 24 * 3600)
  const uniTokenFaucetTx = await tokenFaucetProxyFactory.create(pool, await uniPrizeStrategy.ticket(), uniDripRate)
  const uniTokenFaucet = await getProxy(uniTokenFaucetTx)
  
  console.log(`Created uni TokenFaucet at ${uniTokenFaucet}!`)
  await poolToken.transfer(uniTokenFaucet, uniDripAmount)
  console.log(`Transferred ${uniDripAmount} to ${uniTokenFaucet}`)

  // add Faucets to MultiTokenFaucet
  const multiTokenFaucet = await ethers.getContractAt("MultiTokenFaucet", multiTokenFaucetResult.address, gnosisSafe)
  console.log("adding TokenFaucets to MultiTokenFaucet ", daiTokenFaucet, usdcTokenFaucet, uniTokenFaucet)
  const addAddressesResult = await multiTokenFaucet.addAddresses([daiTokenFaucet, usdcTokenFaucet, uniTokenFaucet])

  // set token listeners on strategies
  console.log("setting tokenlisteners")
  await daiPrizeStrategy.setTokenListener(multiTokenFaucetResult.address)
  await usdcPrizeStrategy.setTokenListener(multiTokenFaucetResult.address)
  await uniPrizeStrategy.setTokenListener(multiTokenFaucetResult.address)
  console.log("tokenListeners set")


  console.log("balance of before claim : ", await poolToken.balanceOf("0x58f40a196d59a458a75478a2f9fc81ada5d5c710")) // address of an unlocked account holding ptDai
  console.log(`moving 30 days forward in time`)
  await increaseTime(30 * 24 * 3600)
  
  const daiTokenFaucetContract = await ethers.getContractAt("TokenFaucet", daiTokenFaucet, gnosisSafe)
  const daiFaucetClaimResult = await daiTokenFaucetContract.claim("0x58f40a196d59a458a75478a2f9fc81ada5d5c710")
  console.log("balance of after claim : ", await poolToken.balanceOf("0x58f40a196d59a458a75478a2f9fc81ada5d5c710"))


}
async function increaseTime(time:any) {
  let provider = hardhat.ethers.provider
  await provider.send('evm_increaseTime', [ time ])
  await provider.send('evm_mine', [])
}

run()