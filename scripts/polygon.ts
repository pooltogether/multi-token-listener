import { factoryDeploy } from "@pooltogether/pooltogether-proxy-factory-package"

const hardhat = require('hardhat')
const chalk = require("chalk")
const { ethers, deployments, getChainId } = hardhat

const tokenFaucetProxyFactoryAddress = "0xB3e8bBD6CB0443e0dc59602825Dc6854D7ec5c4b"
const multiTokenFaucetImplemenationAddress = "0xB294D9344186C613bb8F1b92E71f6954b414bD29" 

//pre-existing erc20 mintable on Polygon - used as ASSET token
const pool = "0x08193764bd81a742c15125e48f41b1232068c912" 

// addresses asscoiated with mnemonic
const account2 = "0x8838f17ECe48008bDb723a9A52f6AD8A83013Ae8" // account with zero "pool" balance => depositTo() called with this as arg
const walletAddress = "0x3F0556bCA55Bdbb78A9316936067a47fd4C4C4f4"

// deployed with builder GUI
const prizeStrategyAddress = "0x0D3AA1b40383729b8fE3d5EC7881FD4E427854A2"
const prizePoolAddress = "0xbf9bbc18f17e29dd13ba38f67c1e8ecb4b7c7974"

// deployed with generic proxy factory
const multiTokenFaucetAddress = "0xa5eec0d6af0b3d31ef62aa5614b7dd56f60ebbb0"


// helper function
async function getProxy(tx:any, signer: any) { 
    const tokenFaucetProxyFactory = await ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryAddress, signer)
    console.log(`waiting for tx.. ${tx.hash}`)
    await ethers.provider.waitForTransaction(tx.hash)
    const createResultReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
    const createResultEvents = createResultReceipt.logs.map((log:any) => { try { return tokenFaucetProxyFactory.interface.parseLog(log) } catch (e) { return null } })
    return createResultEvents[0].args.proxy
}



async function runSetUp() {
    
    const signers = await ethers.getSigners()
    const gnosisSafe = signers[0]

    console.log("using signer address: ", gnosisSafe.address)

    const tokenFaucetProxyFactory = await ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryAddress, gnosisSafe)

    const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, gnosisSafe)

    // existing maninnet multiple winners addresses
    const usdcPrizeStrategy = await ethers.getContractAt('MultipleWinners', prizeStrategyAddress, gnosisSafe)


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
    // console.log("waiting to confirm ", multiTokenFaucetResult.transactionHash)
    // await ethers.provider.waitForTransaction(multiTokenFaucetResult.transactionHash)

    // console.log("MultiTokenFaucet at ", multiTokenFaucetResult.address)


    const mintDripAmount = ethers.utils.parseEther('5')
    const mintSponsorshipDripAmount = ethers.utils.parseEther('10')
    const mintDripRate = mintDripAmount.div(3600) // disperse over 1 hour

    console.log(`Creating usdc TokenFaucet...`)
    const usdcTokenFaucetTx = await tokenFaucetProxyFactory.create(pool, await usdcPrizeStrategy.sponsorship(), mintDripRate) // or usdcPrizeStrategy.sponsorship()
    
    console.log("usdcTokenFaucetTx", usdcTokenFaucetTx)
    
    console.log(`Retrieving proxy...`)
    const usdcTokenFaucet = await getProxy(usdcTokenFaucetTx, gnosisSafe)
    console.log(`Created usdc TokenFaucet at ${usdcTokenFaucet}!`)
    
    await poolToken.transfer(usdcTokenFaucet, mintDripAmount)
    console.log(`Transferred ${mintDripAmount} to ${usdcTokenFaucet}`)

    // add Faucets to MultiTokenFaucet
    const multiTokenFaucet = await ethers.getContractAt("MultiTokenFaucet", multiTokenFaucetAddress, gnosisSafe)
    console.log("adding TokenFaucets to MultiTokenFaucet ",usdcTokenFaucet)
    const addAddressesResult = await multiTokenFaucet.addAddresses([usdcTokenFaucet])

    // set token listeners on strategies
    console.log("setting tokenlisteners")
    await usdcPrizeStrategy.setTokenListener(multiTokenFaucetAddress)
    console.log("tokenListeners set")

    // now deposit into pool 
    const prizePool = await ethers.getContractAt('YieldSourcePrizePool', prizePoolAddress, gnosisSafe)
    
    const token = await ethers.getContractAt('IERC20Upgradeable', await prizePool.token(), gnosisSafe)

    console.log("prizePool.token() is ", await prizePool.token())

    // const decimals = await token.decimals() // not supported on USDC polygon deployment
    const decimals = 6 // USDC

    const prizeStrategy = await ethers.getContractAt('MultipleWinners', await prizePool.prizeStrategy(), gnosisSafe)
    
    const sponsorshipTicketAddress = await prizeStrategy.sponsorship()
  
    const depositAmount = ethers.utils.parseUnits('0.5', decimals)
  
    let tokenBalance = await token.balanceOf(gnosisSafe.address)
    console.log(`token Holder starting token balance: ${ethers.utils.formatUnits(tokenBalance, decimals)}`)
  
    console.log(`Approving token spend for ${gnosisSafe.address}...`)
    const approveResult = await token.approve(prizePool.address, depositAmount)
    await ethers.provider.waitForTransaction(approveResult.hash)

    console.log(`Depositing into Pool with ${gnosisSafe.address}, ${ethers.utils.formatUnits(depositAmount, decimals)}, ${sponsorshipTicketAddress} ${ethers.constants.AddressZero}...`)
    

    await prizePool.depositTo(walletAddress, depositAmount, sponsorshipTicketAddress, ethers.constants.AddressZero)


     console.log("balance of before claim : ", await poolToken.balanceOf(walletAddress)) // address of an unlocked account holding ptDai
    // wait and then check using runClaim()
}


// runSetUp()


async function runClaim(usdcTokenFaucet: string){
    console.log("running claim on faucet ", usdcTokenFaucet)
    const signers = await ethers.getSigners()
    const gnosisSafe = signers[0]

    const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, gnosisSafe)
    console.log("balance of before claim : ", await poolToken.balanceOf(walletAddress)) 

    const usdcTokenFaucetContract = await ethers.getContractAt("TokenFaucet", usdcTokenFaucet, gnosisSafe)

    console.log("userState of ", walletAddress)
    console.log(await usdcTokenFaucetContract.userStates(walletAddress))

    console.log("claiming for ", walletAddress)
    const usdcFaucetClaimResult = await usdcTokenFaucetContract.claim(walletAddress)
    await ethers.provider.waitForTransaction(usdcFaucetClaimResult.hash)

    
    console.log("balance of after claim : ", await poolToken.balanceOf(walletAddress)) // this number should be greater than the beforeClaim
}

runClaim("0x2f5044b85f60F545Cb4243c79eB490f43682F543") // populate with usdcFaucetAddress from earlier