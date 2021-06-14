import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const { AddressZero } = require("ethers").constants
const toWei = ethers.utils.parseEther

describe('MultiToken Faucet', () => {

    let multiTokenFaucet: Contract, tokenFaucet1 : Contract, tokenFaucet2: Contract, testErc20Asset1 : Contract, testErc20Asset2: Contract, addressRegistry: Contract, ticket1: Contract
    let wallet : SignerWithAddress, wallet2 : SignerWithAddress, wallet3 : SignerWithAddress, wallet4 : SignerWithAddress
    
    beforeEach(async () =>{
        
        [wallet, wallet2, wallet3, wallet4] = await ethers.getSigners()

        const multiTokenFaucetContractFactory: ContractFactory = await ethers.getContractFactory("MultiTokenFaucet", wallet)
        multiTokenFaucet = await multiTokenFaucetContractFactory.deploy(wallet.address)

        const erc20ContractFactory: ContractFactory = await ethers.getContractFactory("ERC20Mintable")

        ticket1 = await erc20ContractFactory.deploy("ticket1", "TICKET")
        
        testErc20Asset1 = await erc20ContractFactory.deploy("asset1", "ASSET1")
        testErc20Asset2 = await erc20ContractFactory.deploy("asset2", "ASSET2")

        const tokenFaucetContractFactory: ContractFactory = await ethers.getContractFactory("TokenFaucetHarness")
        let dripRatePerSecond = ethers.utils.parseEther('0.1')
        
        tokenFaucet1 = await tokenFaucetContractFactory.deploy()
        await expect(tokenFaucet1.initialize(testErc20Asset1.address, ticket1.address, dripRatePerSecond)).to.emit(tokenFaucet1, "Initialized").withArgs(
            testErc20Asset1.address,
            ticket1.address,
            dripRatePerSecond
        )
        
        tokenFaucet2 = await tokenFaucetContractFactory.deploy()
        await expect(tokenFaucet2.initialize(testErc20Asset2.address, ticket1.address, dripRatePerSecond)).to.emit(tokenFaucet2, "Initialized").withArgs(
            testErc20Asset2.address,
            ticket1.address,
            dripRatePerSecond
        )

    })

    describe('addAddresses()', () => {
        
        it('Owner can add TokenFaucets', async () => {
            await expect(multiTokenFaucet.addAddresses([tokenFaucet1.address, tokenFaucet2.address])).to.emit(multiTokenFaucet, "AddressAdded")
        })
    
        it('Non-owner cannot add TokenFaucets', async () => {
            await expect(multiTokenFaucet.connect(wallet2).addAddresses([tokenFaucet1.address, tokenFaucet2.address])).to.be.reverted
        })
    })

    describe('removeAddress()', () => {
        
        it('Owner can remove TokenFaucets', async () => {
            await multiTokenFaucet.addAddresses([tokenFaucet1.address, tokenFaucet2.address])
            await expect(multiTokenFaucet.removeAddress(tokenFaucet2.address, tokenFaucet1.address)).to.emit(multiTokenFaucet, "AddressRemoved")
                .withArgs(tokenFaucet1.address)
        })
    
        it('Non-owner cannot add TokenFaucets', async () => {
            await expect(multiTokenFaucet.connect(wallet2).removeAddress(tokenFaucet1.address)).to.be.reverted
        })
    })

    describe('beforeTokenMint()', () => {
        
        it('should not drip when no time has passed', async () => {
            await multiTokenFaucet.addAddresses([tokenFaucet1.address, tokenFaucet2.address])
            await ticket1.mint(wallet.address, toWei('100'))
            await testErc20Asset1.mint(tokenFaucet1.address, toWei('100'))
            await testErc20Asset2.mint(tokenFaucet2.address, toWei('100'))
    
            await expect(
                multiTokenFaucet.beforeTokenMint(wallet.address, '0', ticket1.address, AddressZero)
            ).not.to.emit(tokenFaucet1, 'Dripped')
            
        })
        
        it('should drip tokens on subsequent calls', async () => {
            await multiTokenFaucet.addAddresses([tokenFaucet1.address, tokenFaucet2.address])
            await ticket1.mint(wallet.address, toWei('100'))
            
            await testErc20Asset1.mint(tokenFaucet1.address, toWei('100'))
            await testErc20Asset2.mint(tokenFaucet2.address, toWei('100'))
    
            await tokenFaucet1.setCurrentTime(10)
            await tokenFaucet2.setCurrentTime(10)
    
            await expect(multiTokenFaucet.beforeTokenMint(wallet.address, '0', ticket1.address, AddressZero)).
                to.
                emit(tokenFaucet1, 'Dripped')
                    .withArgs(toWei('1')).
                and.
                to.
                emit(tokenFaucet2, 'Dripped')
                    .withArgs(toWei('1'))
    
            // mintee has balance captured
            let userState1 = await tokenFaucet1.userStates(wallet.address)
            expect(userState1.balance).to.equal(toWei('1'))
            let userState2 = await tokenFaucet2.userStates(wallet.address)
            expect(userState2.balance).to.equal(toWei('1'))
        })
    
        it('should not drip when unknown tokens are passed', async () => {
    
            await multiTokenFaucet.addAddresses([tokenFaucet1.address, tokenFaucet2.address])
            await ticket1.mint(wallet.address, toWei('100'))
            
            await testErc20Asset1.mint(tokenFaucet1.address, toWei('100'))
            await testErc20Asset2.mint(tokenFaucet2.address, toWei('100'))
            
            await tokenFaucet1.setCurrentTime(10)
            await tokenFaucet2.setCurrentTime(10)
    
            await expect(
              multiTokenFaucet.beforeTokenMint(wallet.address, '0', wallet.address, AddressZero)
            ).not.
                to.emit(tokenFaucet1, 'Dripped')
        })
    })

    describe('beforeTokenTransfer()', () => {
        it('should do nothing if minting', async () => {
            await multiTokenFaucet.addAddresses([tokenFaucet1.address, tokenFaucet2.address])
            await ticket1.mint(wallet.address, toWei('100'))
            
            await testErc20Asset1.mint(tokenFaucet1.address, toWei('100'))
            await testErc20Asset2.mint(tokenFaucet2.address, toWei('100'))
            
            await tokenFaucet1.setCurrentTime(10)
            await tokenFaucet2.setCurrentTime(10)

            await expect(
                multiTokenFaucet.beforeTokenTransfer(AddressZero, wallet.address, '0', ticket1.address)
            ).not.to.emit(tokenFaucet1, 'Dripped')
        })
    
        it('should do nothing if transfer for unrelated token', async () => {
            await multiTokenFaucet.addAddresses([tokenFaucet1.address, tokenFaucet2.address])
            await ticket1.mint(wallet.address, toWei('100'))
            
            await testErc20Asset1.mint(tokenFaucet1.address, toWei('100'))
            await testErc20Asset2.mint(tokenFaucet2.address, toWei('100'))
            
            await tokenFaucet1.setCurrentTime(10)
            await tokenFaucet2.setCurrentTime(10)

            await expect(
                multiTokenFaucet.beforeTokenTransfer(wallet.address, wallet.address, '0', wallet.address)
            ).not.to.emit(tokenFaucet1, 'Dripped')
        })
    
        it('should update the balance drips', async () => {
            await multiTokenFaucet.addAddresses([tokenFaucet1.address, tokenFaucet2.address])
            
            await ticket1.mint(wallet.address, toWei('80'))
            await ticket1.mint(wallet2.address, toWei('20'))
            
            await testErc20Asset1.mint(tokenFaucet1.address, toWei('100'))
            await testErc20Asset2.mint(tokenFaucet2.address, toWei('100'))
            
            await tokenFaucet1.setCurrentTime(10)
            await tokenFaucet2.setCurrentTime(10)

            await expect(multiTokenFaucet.beforeTokenTransfer(wallet.address, wallet2.address, '0', ticket1.address)).
                to.emit(tokenFaucet1, 'Dripped')
                .withArgs(toWei('1'))
                .and.to.emit(tokenFaucet2, "Dripped")
                .withArgs(toWei('1'))

            // from has balance captured
            const userStateTokenFaucet1 = await tokenFaucet1.userStates(wallet.address)
            expect(userStateTokenFaucet1.balance).to.equal(toWei('0.8'))

            const userStateTokenFaucet2 = await tokenFaucet2.userStates(wallet.address)
            expect(userStateTokenFaucet2.balance).to.equal(toWei('0.8'))
            
            // to has balance captured
            const userState2TokenFaucet1 = await tokenFaucet1.userStates(wallet2.address)
            expect(userState2TokenFaucet1.balance).to.equal(toWei('0.2'))
            
            const userState2TokenFaucet2 = await tokenFaucet1.userStates(wallet2.address)
            expect(userState2TokenFaucet2.balance).to.equal(toWei('0.2'))

        })
      })
})