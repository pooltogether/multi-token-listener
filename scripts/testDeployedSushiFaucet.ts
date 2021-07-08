const hardhat = require('hardhat')
const { ethers } = hardhat

const TIMELOCK_ADDRESS    = '0x42cd8312d2bce04277dd5161832460e95b24262e'
const SUSHI_RICH_ADDRESS  = '0xD6216fC19DB775Df9774a6E33526131dA7D19a2c'
const PPOOL_RICH_ADDRESS  = '0xb532fe24310aa59fb428a3dd02dc61b86bf953fa'
const OWNER_ADDRESS       = '0x029aa20dcc15c022b1b61d420aacf7f179a9c73f'
const BINANCE_ADDRESS     = '0xF977814e90dA44bFA03b6295A0616a897441aceC'

const PPOOL_ADDRESS = '0x27d22a7648e955e510a40bdb058333e9190d12d4'
const SUSHI_MULTI_TOKEN_LISTENER = '0x798c67449ed4c8ea108fa05ed0af19793626cb60'

async function run() {
  await hardhat.ethers.provider.send("hardhat_impersonateAccount",[OWNER_ADDRESS])
  await hardhat.ethers.provider.send("hardhat_impersonateAccount",[BINANCE_ADDRESS]) // ether rich binance account
  await hardhat.ethers.provider.send("hardhat_impersonateAccount",[SUSHI_RICH_ADDRESS])
  await hardhat.ethers.provider.send("hardhat_impersonateAccount",[TIMELOCK_ADDRESS])
  await hardhat.ethers.provider.send("hardhat_impersonateAccount",[PPOOL_RICH_ADDRESS])

  console.log(`Sending ether from binance....`)
  const binance = await ethers.provider.getUncheckedSigner(BINANCE_ADDRESS)

  console.log(`Sending ether to timelock....`)
  await binance.sendTransaction({ to: TIMELOCK_ADDRESS, value: ethers.utils.parseEther('0.5') })

  console.log(`Sending ether to sushi....`)
  await binance.sendTransaction({ to: SUSHI_RICH_ADDRESS, value: ethers.utils.parseEther('0.5') })

  console.log(`Sending ether to owner....`)
  await binance.sendTransaction({ to: OWNER_ADDRESS, value: ethers.utils.parseEther('0.5') })
  
  const poolPoolRichSigner = await ethers.provider.getUncheckedSigner(PPOOL_RICH_ADDRESS)
  const timelock = await ethers.provider.getUncheckedSigner(TIMELOCK_ADDRESS)
  const sushiRichSigner = await ethers.provider.getUncheckedSigner(SUSHI_RICH_ADDRESS)
  const owner = await ethers.provider.getUncheckedSigner(OWNER_ADDRESS)

  console.log(`creating contracts....`)
  const poolPoolToken = await ethers.getContractAt('IERC20Upgradeable', PPOOL_ADDRESS, poolPoolRichSigner)
  
  const sushiPrizePool = await ethers.getContractAt('YieldSourcePrizePool', '0xc32a0f9dfe2d93e8a60ba0200e033a59aec91559', sushiRichSigner)
  const sushiPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x94ac4f591908ad5a1ccc9e05d2d75b0dd62d97fa', owner)
  const sushiSushiFaucetAddress = '0xddcf915656471b7c44217fb8c51f9888701e759a'
  const sushiSushiFaucet = await ethers.getContractAt("TokenFaucet", sushiSushiFaucetAddress)
  const sushiPoolPoolFaucet = await ethers.getContractAt('TokenFaucet', '0xd186302304fD367488b5087Af5b12CB9B7cf7540', owner)
  const sushi = await ethers.getContractAt('IERC20Upgradeable', await sushiSushiFaucet.asset(), owner)
  
  const multiTokenListener = await ethers.getContractAt('MultiTokenListener', SUSHI_MULTI_TOKEN_LISTENER)
  
  console.log(`Depositing pool pool into faucet...`)
  const poolFaucetAmount = ethers.utils.parseEther('1000')
  await poolPoolToken.transfer(OWNER_ADDRESS, poolFaucetAmount)
  await poolPoolToken.connect(owner).approve(sushiPoolPoolFaucet.address, poolFaucetAmount)
  await sushiPoolPoolFaucet.deposit(poolFaucetAmount)

  // set token listeners on strategies
  console.log(`Setting prize strategy token listener to ${multiTokenListener.address}`)
  await sushiPrizeStrategy.setTokenListener(multiTokenListener.address)
  console.log("tokenListeners set")

  const depositAmount = ethers.utils.parseEther('500')
  
  // get token
  const depositTokenAddress = await sushiPrizePool.token()

  console.log("approving token")
  let depositToken = await ethers.getContractAt("IERC20Upgradeable", depositTokenAddress, sushiRichSigner)
  await depositToken.approve(sushiPrizePool.address, depositAmount)
  console.log("depositing")
  const depositResult = await sushiPrizePool.depositTo(SUSHI_RICH_ADDRESS, depositAmount, await sushiPrizeStrategy.ticket(), ethers.constants.AddressZero)
  const depositReceipt = await ethers.provider.getTransactionReceipt(depositResult.hash)
  console.log(`depositTo() gasUsed with ${(await multiTokenListener.getAddresses()).length} token listeners: , ${depositReceipt.gasUsed.toString()}`)

  console.log("withdrawing")
  const withdrawAmount = ethers.utils.parseEther("1")
  const withdrawResult = await sushiPrizePool.withdrawInstantlyFrom(SUSHI_RICH_ADDRESS, withdrawAmount, await sushiPrizeStrategy.ticket(), withdrawAmount)
  const withdrawReceipt = await ethers.provider.getTransactionReceipt(withdrawResult.hash)
  console.log(`withdrawInstantlyFrom() gasUsed with ${(await multiTokenListener.getAddresses()).length} token listeners: , ${withdrawReceipt.gasUsed.toString()}`)

  console.log("balance of before claim : ", await poolPoolToken.balanceOf(SUSHI_RICH_ADDRESS)) // address of an unlocked account holding ptDai
  console.log(`moving 30 days forward in time`)
  await increaseTime(30 * 24 * 3600)
  
  console.log("Sushi balance before claim : ", ethers.utils.formatEther(await sushi.balanceOf(SUSHI_RICH_ADDRESS)))
  await sushiSushiFaucet.claim(SUSHI_RICH_ADDRESS)
  console.log("Sushi balance after claim : ", ethers.utils.formatEther(await sushi.balanceOf(SUSHI_RICH_ADDRESS)))

  console.log("PPOOL balance before claim : ", ethers.utils.formatEther(await poolPoolToken.balanceOf(SUSHI_RICH_ADDRESS)))
  await sushiPoolPoolFaucet.claim(SUSHI_RICH_ADDRESS)
  console.log("PPOOL balance after claim : ", ethers.utils.formatEther(await poolPoolToken.balanceOf(SUSHI_RICH_ADDRESS)))

  await depositToken.approve(sushiPrizePool.address, depositAmount)
  console.log("depositing")
  const secondDepositResult = await sushiPrizePool.depositTo(SUSHI_RICH_ADDRESS, depositAmount, await sushiPrizeStrategy.ticket(), ethers.constants.AddressZero)
  const secondDepositReceipt = await ethers.provider.getTransactionReceipt(secondDepositResult.hash)
  console.log(`second: depositTo() gasUsed with ${(await multiTokenListener.getAddresses()).length} token listeners: , ${secondDepositReceipt.gasUsed.toString()}`)

  const secondWithdrawResult = await sushiPrizePool.withdrawInstantlyFrom(SUSHI_RICH_ADDRESS, withdrawAmount, await sushiPrizeStrategy.ticket(), withdrawAmount)
  const secondWithdrawReceipt = await ethers.provider.getTransactionReceipt(secondWithdrawResult.hash)
  console.log(`withdrawInstantlyFrom() gasUsed with ${(await multiTokenListener.getAddresses()).length} token listeners: , ${secondWithdrawReceipt.gasUsed.toString()}`)
}
async function increaseTime(time:any) {
  let provider = hardhat.ethers.provider
  await provider.send('evm_increaseTime', [ time ])
  await provider.send('evm_mine', [])
}

run()
