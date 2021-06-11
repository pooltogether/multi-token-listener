# PoolTogether Multi TokenFaucet

[![Coverage Status](https://coveralls.io/repos/github/pooltogether/multi-token-faucet/badge.svg?branch=master)](https://coveralls.io/github/pooltogether/multi-token-faucet?branch=master)

![Tests](https://github.com/pooltogether/multi-token-faucet/actions/workflows/main.yml/badge.svg)

# About
MultiTokenFaucet is a contract which holds multiple TokenFaucets. This allows the allocation/rewarding of multiple tokens vs. a measure token, such as the PoolTogether Ticket. The `beforeTokenMint` and `beforeTokenTransfer` token hooks are called for each associated TokenFaucet. 

# Installation
Install the repo and dependencies by running:
`yarn`

## Deployment
These contracts can be deployed to a network by running:
`yarn deploy <networkName>`

# Testing
Run the unit tests locally with:
`yarn test`

## Coverage
Generate the test coverage report with:
`yarn coverage`