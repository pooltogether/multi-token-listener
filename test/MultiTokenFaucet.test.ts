import { expect } from 'chai';
import { deployMockContract, MockContract } from 'ethereum-waffle';
import { Contract, ContractFactory, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { Interface } from 'ethers/lib/utils'; 

describe('MultiToken Faucet', () => {
    let multiTokenFaucet, tokenFaucet1, tokenFaucet2, testErc20Measure1, testErc20Measure2, testErc20Asset1, testErc20Asset2: Contract
    let wallet, wallet2, wallet3, wallet4

    beforeEach(async () =>{
        [wallet, wallet2, wallet3, wallet4] = await ethers.getSigners()

        const multiTokenFaucetContractFactory: ContractFactory = await ethers.getContractFactory("MultiTokenFaucet", wallet)
        multiTokenFaucet = await multiTokenFaucetContractFactory.deploy(wallet.address)

        const erc20ContractFactory: ContractFactory = await ethers.getContractFactory("ERC20Mintable")
        testErc20Measure1 = await erc20ContractFactory.deploy("measure1", "MEASURE1")
        testErc20Measure2 = await erc20ContractFactory.deploy("measure2", "MEASURE2")
        testErc20Asset1 = await erc20ContractFactory.deploy("asset1", "ASSET1")
        testErc20Asset2 = await erc20ContractFactory.deploy("asset1", "ASSET2")

        const tokenFaucetContractFactory: ContractFactory = await ethers.getContractFactory("TokenFaucet")
        tokenFaucet1 = await tokenFaucetContractFactory.deploy()
        await tokenFaucet1.initialize(testErc20Asset1.address, testErc20Measure1.address, 10000000)
        tokenFaucet2 = await tokenFaucetContractFactory.deploy()
        await tokenFaucet2.initialize(testErc20Asset2.address, testErc20Measure2.address, 5000000)

        await multiTokenFaucet.addTokenFaucets([tokenFaucet1.address, tokenFaucet2.address])
    })

    it('', async () => {
        
    })

})