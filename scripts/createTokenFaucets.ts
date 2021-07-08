import { factoryDeploy } from "@pooltogether/pooltogether-proxy-factory-package"

const hardhat = require('hardhat')
const { ethers } = hardhat

const tokenFaucetProxyFactoryAddress = "0xE4E9cDB3E139D7E8a41172C20b6Ed17b6750f117" // deployed on real mainnet -dont change
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

  const userAddress = "0x58f40a196d59a458a75478a2f9fc81ada5d5c710"
  await binance.sendTransaction({ to: userAddress, value: ethers.utils.parseEther('1') })
  await hardhat.ethers.provider.send("hardhat_impersonateAccount",[userAddress])

  const userAddressSigner = await ethers.provider.getUncheckedSigner(userAddress)
  const daiTokenAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"

  const daiPrizePool = await ethers.getContractAt('CompoundPrizePool', "0xEBfb47A7ad0FD6e57323C8A42B2E5A6a4F68fc1a", userAddressSigner)

  const depositAmount = ethers.utils.parseUnits('5', 18)
  const totalDepositsAmount = ethers.utils.parseUnits('50', 18)
  
  // get dai for address
  let daiToken = await ethers.getContractAt("IERC20Upgradeable",daiTokenAddress, binance)
  await daiToken.transfer(userAddress, totalDepositsAmount)

  daiToken = await ethers.getContractAt("IERC20Upgradeable", daiTokenAddress, userAddressSigner)
  await daiToken.approve(daiPrizePool.address, depositAmount)
  
  // NOTE: these results are only valid on the first script run - as state is maintained between runs on fork
  console.log("depositing")
  const singleListenerDeposit = await daiPrizePool.depositTo(userAddress, depositAmount, await daiPrizeStrategy.ticket(), ethers.constants.AddressZero)
  const singleListenerDepositReceipt = await ethers.provider.getTransactionReceipt(singleListenerDeposit.hash)
  console.log("depositTo() gasUsed with existing token listener: ", singleListenerDepositReceipt.gasUsed.toString())

  //existing depositTo() consumes 381269 gas

  console.log("withdrawing")
  const singleWithdrawAmount = ethers.utils.parseEther("1")
  const singleWithdrawResult = await daiPrizePool.withdrawInstantlyFrom(userAddress, singleWithdrawAmount, await daiPrizeStrategy.ticket(), singleWithdrawAmount)
  const singleWithdrawReceipt = await ethers.provider.getTransactionReceipt(singleWithdrawResult.hash)
  console.log("withdrawInstantlyFrom() gasUsed with existing token listeners: ", singleWithdrawReceipt.gasUsed.toString())

  // existing withdrawInstantlyFrom() from consumes 400189 gas

  const multiTokenListenerAbi = (await hardhat.artifacts.readArtifact("MultiTokenListener")).abi
  const multiTokenListenerInterface = new ethers.utils.Interface(multiTokenListenerAbi)

  const initializerArgs: string = multiTokenListenerInterface.encodeFunctionData(multiTokenListenerInterface.getFunction("initialize(address)"),
      [
        timelockAddress  // _owner
      ]
  )


  const multiTokenListenerImplementation = await ethers.getContract('MultiTokenListener')
  
  const multiTokenListenerResult = await factoryDeploy({
    implementationAddress: multiTokenListenerImplementation.address,
    contractName: "MultiTokenListenerInstance",
    initializeData: initializerArgs,
    provider: ethers.provider,
    signer: gnosisSafe
  })
  console.log("MultiTokenListener at ", multiTokenListenerResult.address)


  console.log(`Creating dai TokenFaucet...`)
  const daiDripAmount = ethers.utils.parseEther('2000')
  const daiDripRate = daiDripAmount.div(98 * 24 * 3600)
  const daiTicket = await daiPrizeStrategy.ticket()
  const createResultTx = await tokenFaucetProxyFactory.create(pool,daiTicket , daiDripRate)
  console.log(`getting Dai TokenFaucet address `)
  const daiTokenFaucet = await getProxy(createResultTx)
  
  
  console.log(`Created Dai TokenFaucet1 at ${daiTokenFaucet}!`)
  await poolToken.transfer(daiTokenFaucet, daiDripAmount)
  console.log(`Transferred ${daiDripAmount} to ${daiTokenFaucet}`)


  console.log(`Creating dai sponsorship TokenFaucet2...`)
  const daiTokenFaucet2Tx = await tokenFaucetProxyFactory.create(pool, await daiPrizeStrategy.sponsorship(), daiDripRate)
  console.log(`Retrieving proxy...`)
  const daiTokenFaucet2 = await getProxy(daiTokenFaucet2Tx)
  
  console.log(`Created dai TokenFaucet2 at ${daiTokenFaucet2}!`)
  await poolToken.transfer(daiTokenFaucet2, daiDripAmount)
  console.log(`Transferred ${daiDripAmount} to ${daiTokenFaucet2}`)


  console.log(`Creating dai TokenFaucet3...`)
  const uniDripAmount = ethers.utils.parseEther('2000')
  const uniDripRate = uniDripAmount.div(98 * 24 * 3600)
  const daiTokenFaucet3Tx = await tokenFaucetProxyFactory.create(pool, await daiPrizeStrategy.ticket(), uniDripRate)
  const daiTokenFaucet3 = await getProxy(daiTokenFaucet3Tx)
  
  console.log(`Created uni TokenFaucet at ${daiTokenFaucet3}!`)
  await poolToken.transfer(daiTokenFaucet3, uniDripAmount)
  console.log(`Transferred ${uniDripAmount} to ${daiTokenFaucet3}`)

  // add Faucets to MultiTokenListener
  const multiTokenListener = await ethers.getContractAt("MultiTokenListener", multiTokenListenerResult.address, gnosisSafe)
  console.log("adding TokenFaucets to MultiTokenListener ", daiTokenFaucet, daiTokenFaucet2, daiTokenFaucet3)
  
  const tokenFaucetArray = [daiTokenFaucet, daiTokenFaucet2]
  console.log(`adding ${tokenFaucetArray.length} faucets`)
  await multiTokenListener.addAddresses(tokenFaucetArray)

  console.log(`Supports interface: ${await multiTokenListener.supportsInterface('0xff5e34e7')}`)

  // set token listeners on strategies
  console.log(`Setting prize strategy token listener to ${multiTokenListenerResult.address}`)
  await daiPrizeStrategy.setTokenListener(multiTokenListenerResult.address)
  console.log("tokenListeners set")

  // deposit into pool and for gas comsumption
  daiToken = await ethers.getContractAt("IERC20Upgradeable", daiTokenAddress, userAddressSigner)
  console.log("approving dai")
  await daiToken.approve(daiPrizePool.address, depositAmount)
  console.log("depositing")
  const depositResult = await daiPrizePool.depositTo(userAddress, depositAmount, await daiPrizeStrategy.ticket(), ethers.constants.AddressZero)
  const depositReceipt = await ethers.provider.getTransactionReceipt(depositResult.hash)
  console.log(`depositTo() gasUsed with ${(await multiTokenListener.getAddresses()).length} token listeners: , ${depositReceipt.gasUsed.toString()}`)

  
  console.log("withdrawing")
  const withdrawAmount = ethers.utils.parseEther("1")
  const withdrawResult = await daiPrizePool.withdrawInstantlyFrom(userAddress, withdrawAmount, await daiPrizeStrategy.ticket(), withdrawAmount)
  const withdrawReceipt = await ethers.provider.getTransactionReceipt(withdrawResult.hash)
  console.log(`withdrawInstantlyFrom() gasUsed with ${(await multiTokenListener.getAddresses()).length} token listeners: , ${withdrawReceipt.gasUsed.toString()}`)


  console.log("balance of before claim : ", await poolToken.balanceOf(userAddress)) // address of an unlocked account holding ptDai
  console.log(`moving 30 days forward in time`)
  await increaseTime(30 * 24 * 3600)
  
  const daiTokenFaucetContract = await ethers.getContractAt("TokenFaucet", daiTokenFaucet, gnosisSafe)
  const daiFaucetClaimResult = await daiTokenFaucetContract.claim(userAddress)
  console.log("balance of after claim : ", await poolToken.balanceOf(userAddress))

  await daiToken.approve(daiPrizePool.address, depositAmount)
  console.log("depositing")
  const secondDepositResult = await daiPrizePool.depositTo(userAddress, depositAmount, await daiPrizeStrategy.ticket(), ethers.constants.AddressZero)
  const secondDepositReceipt = await ethers.provider.getTransactionReceipt(secondDepositResult.hash)
  console.log(`second: depositTo() gasUsed with ${(await multiTokenListener.getAddresses()).length} token listeners: , ${secondDepositReceipt.gasUsed.toString()}`)


  const secondWithdrawResult = await daiPrizePool.withdrawInstantlyFrom(userAddress, withdrawAmount, await daiPrizeStrategy.ticket(), withdrawAmount)
  const secondWithdrawReceipt = await ethers.provider.getTransactionReceipt(secondWithdrawResult.hash)
  console.log(`withdrawInstantlyFrom() gasUsed with ${(await multiTokenListener.getAddresses()).length} token listeners: , ${secondWithdrawReceipt.gasUsed.toString()}`)


}
async function increaseTime(time:any) {
  let provider = hardhat.ethers.provider
  await provider.send('evm_increaseTime', [ time ])
  await provider.send('evm_mine', [])
}

run()

  // GAS CONSUMPTION RESULTS: 

  //  depositTo() consumes 381,269 gas: 1 listener (existing setup)
  //  depositTo() consumes 445,856 gas : 2 listeners (+64,587)
  //  depositTo() consumes 505,877 gas : 3 listeners (+124,608)


  // withdrawInstantlyFrom() from consumes 400,189 gas (existing)
  // withdrawInstantlyFrom() gas used 495,958 : 2 listeners (+95,769)
  // withdrawInstantlyFrom() gas used 572,289 : 3 listeners (+172,100)


  // One Ticket measure Faucet + One Sponsorship measure Faucet
  // depositTo() 390,553
  // withdrawInstantlyFrom() 424,343

  // second transactions (when faucets are intialized)
   // depositTo() consumes 375,561
   // withdrawInstantlyFrom() consumes 409,343