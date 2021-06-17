import { factoryDeploy } from "@pooltogether/pooltogether-proxy-factory-package"

const hardhat = require('hardhat')
const chalk = require("chalk")
const { ethers, deployments, getChainId } = hardhat

const tokenFaucetProxyFactoryAddress = "0xB3e8bBD6CB0443e0dc59602825Dc6854D7ec5c4b"

const multiTokenFaucetImplemenationAddress = "0xB294D9344186C613bb8F1b92E71f6954b414bD29" // update to that in when deployment ran
const pool = "0x08193764bd81a742c15125e48f41b1232068c912" //erc20 mintable for polygon test

const account2 = "0x8838f17ECe48008bDb723a9A52f6AD8A83013Ae8" // account with zero "pool" balance => depositTo() called with this as arg

async function getProxy(tx:any, signer: any) { 

    const tokenFaucetProxyFactory = await ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryAddress, signer)
    console.log("waiting for tx..")
    await ethers.provider.waitForTransaction(tx.hash)

    const createResultReceipt = await ethers.provider.getTransactionReceipt(tx.hash)


    console.log(createResultReceipt)
    const createResultEvents = createResultReceipt.logs.map((log:any) => { try { return tokenFaucetProxyFactory.interface.parseLog(log) } catch (e) { return null } })
    return createResultEvents[0].args.proxy
}



async function runSetUp() {
    const walletAddress = "0x3F0556bCA55Bdbb78A9316936067a47fd4C4C4f4"

    const signers = await ethers.getSigners()
    const gnosisSafe = signers[0]

    console.log("using signer address: ", gnosisSafe.address)

    const tokenFaucetProxyFactory = await ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryAddress, gnosisSafe)

    const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, gnosisSafe)

    // existing maninnet multiple winners addresses
    const usdcPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x6A33C675C195A9F6DC6758c32e2f659AE8609035', gnosisSafe)


    const multiTokenFaucetAbi = (await hardhat.artifacts.readArtifact("MultiTokenFaucet")).abi
    const multiTokenFaucetInterface = new ethers.utils.Interface(multiTokenFaucetAbi)

    const initializerArgs: string = multiTokenFaucetInterface.encodeFunctionData(multiTokenFaucetInterface.getFunction("initialize(address)"),
        [
        walletAddress  // _owner
        ]
    )

    console.log("multiTokenFaucetImplemenationAddress ", multiTokenFaucetImplemenationAddress)
    
    // console.log(`now deploying multitokenfaucet using factoryDeploy`)
    // const multiTokenFaucetResult = await factoryDeploy({
    //     implementationAddress: multiTokenFaucetImplemenationAddress,
    //     contractName: "MultiTokenFaucetInstance",
    //     initializeData: initializerArgs,
    //     provider: ethers.provider,
    //     signer: gnosisSafe
    // })
    // console.log("MultiTokenFaucet at ", multiTokenFaucetResult.address)

    const multiTokenFaucetAddress = "0x2dd1CB560366fF3cbaE4310C4321148f0ee995F5"


    const daiDripAmount = ethers.utils.parseEther('0.02')
    const daiDripRate = daiDripAmount.div(98 * 24 * 3600)

    console.log(`Creating usdc TokenFaucet...`)
    const usdcTokenFaucetTx = await tokenFaucetProxyFactory.create(pool, await usdcPrizeStrategy.ticket(), daiDripRate) // or usdcPrizeStrategy.sponsorship()
    
    console.log("usdcTokenFaucetTx", usdcTokenFaucetTx)
    
    console.log(`Retrieving proxy...`)
    const usdcTokenFaucet = await getProxy(usdcTokenFaucetTx, gnosisSafe)
    console.log(`Created usdc TokenFaucet at ${usdcTokenFaucet}!`)
    
    await poolToken.transfer(usdcTokenFaucet, daiDripAmount)
    console.log(`Transferred ${daiDripAmount} to ${usdcTokenFaucet}`)

    // add Faucets to MultiTokenFaucet
    const multiTokenFaucet = await ethers.getContractAt("MultiTokenFaucet", multiTokenFaucetAddress, gnosisSafe)
    console.log("adding TokenFaucets to MultiTokenFaucet ",usdcTokenFaucet)
    const addAddressesResult = await multiTokenFaucet.addAddresses([usdcTokenFaucet])

    // set token listeners on strategies
    console.log("setting tokenlisteners")
    await usdcPrizeStrategy.setTokenListener(multiTokenFaucetAddress)
    console.log("tokenListeners set")

    // now deposit into pool 
    const prizePoolAddress = "0xA74411AC118853682C323E5a76031bf6363d1287"
    const prizePool = await ethers.getContractAt('YieldSourcePrizePool', prizePoolAddress, gnosisSafe)
    
    const token = await ethers.getContractAt('IERC20Upgradeable', await prizePool.token(), gnosisSafe)

    console.log("prizePool.token() is ", await prizePool.token())

    // const decimals = await token.decimals() 
    const decimals = 6

    const prizeStrategy = await ethers.getContractAt('MultipleWinners', await prizePool.prizeStrategy(), gnosisSafe)
    
    const ticketAddress = await prizeStrategy.ticket()
  
    const depositAmount = ethers.utils.parseUnits('0.5', decimals)
  
    let tokenBalance = await token.balanceOf(gnosisSafe.address)
    console.log(`token Holder starting token balance: ${ethers.utils.formatUnits(tokenBalance, decimals)}`)
  
    console.log(`Approving token spend for ${gnosisSafe.address}...`)
    const approveResult = await token.approve(prizePool.address, depositAmount)
    await ethers.provider.waitForTransaction(approveResult.hash)

    console.log(`Depositing into Pool with ${gnosisSafe.address}, ${ethers.utils.formatUnits(depositAmount, decimals)}, ${ticketAddress} ${ethers.constants.AddressZero}...`)
    

    await prizePool.depositTo(account2, depositAmount, ticketAddress, ethers.constants.AddressZero)


     console.log("balance of before claim : ", await poolToken.balanceOf(account2)) // address of an unlocked account holding ptDai
    // wait and then check using runClaim()
}


// runSetUp()


async function runClaim(usdcTokenFaucet: string){
    console.log("running claim on faucet ", usdcTokenFaucet)
    const signers = await ethers.getSigners()
    const gnosisSafe = signers[0]

    const usdcTokenFaucetContract = await ethers.getContractAt("TokenFaucet", usdcTokenFaucet, gnosisSafe)

    console.log("userState of ", account2)
    console.log(await usdcTokenFaucetContract.userStates(account2))

    console.log("claiming for ", account2)
    const usdcFaucetClaimResult = await usdcTokenFaucetContract.claim(account2)
    await ethers.provider.waitForTransaction(usdcFaucetClaimResult.hash)

    const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, gnosisSafe)
    console.log("balance of after claim : ", await poolToken.balanceOf(account2))

}

runClaim("0x4AaFA507f255a9f2b7bc36c192dC6Dc13169BF09")