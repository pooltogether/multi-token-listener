# PoolTogether Multi TokenFaucet

[![Coverage Status](https://coveralls.io/repos/github/pooltogether/multi-token-faucet/badge.svg?branch=master)](https://coveralls.io/github/pooltogether/multi-token-faucet?branch=master)

![Tests](https://github.com/pooltogether/multi-token-faucet/actions/workflows/main.yml/badge.svg)

# About
MultiTokenFaucet is a contract which holds multiple [TokenFaucets](https://github.com/pooltogether/pooltogether-pool-contracts/blob/master/contracts/token-faucet/TokenFaucet.sol). This contract allows the allocation/rewarding of multiple tokens vs. a measure token, such as the PoolTogether Ticket. The `beforeTokenMint` and `beforeTokenTransfer` token hooks are called for each associated TokenFaucet. 

## Usage
1. TokenFaucets should be deployed and initialized individually. The owner of these TokenFaucets can be different to that of the MultiTokenFaucet.
1. This contract should be deployed.
1. The TokenFaucets should be added using `addTokenFaucets()`.
1. The appropriate `tokenListener` address should be set on the origin contract (PrizeStrategy)

# Installation
Install the repo and dependencies by running:
`yarn`

## Deployment
These contracts can be deployed to a network by running:
`yarn deploy <networkName>`

# Testing
Run the unit tests locally with:
`yarn test`

## Fork Test
In one terminal window run:
`yarn start-fork`

This will start the fork and deploy the implementation contract and also an instance of the MultiTokenFaucet.

In another terminal window run:
`yarn run-fork`

This will create several TokenFaucets, attach them to the MultiTokenFaucet instance, and set this address as the `tokenListener` for three prize strategies. Finally a rewards eligible ticket holders address balance is checked over time.   


## Coverage
Generate the test coverage report with:
`yarn coverage`