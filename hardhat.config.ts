import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-abi-exporter';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
// import 'hardhat-dependency-compiler'

import { HardhatUserConfig } from 'hardhat/config';

import networks from './hardhat.network';

const optimizerEnabled = !process.env.OPTIMIZER_DISABLED;

const config: HardhatUserConfig = {
  abiExporter: {
    path: './abis',
    clear: true,
    flat: true,
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
  },
  mocha: {
    timeout: 30000,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  networks,
  solidity: {
    compilers: [
      {
        version: '0.6.4',
        settings: {
          optimizer: {
            enabled: optimizerEnabled,
            runs: 200,
          },
          evmVersion: 'istanbul',
        }
      },
        {
          version: '0.6.12',
          settings: {
            optimizer: {
              enabled: optimizerEnabled,
              runs: 200,
            },
            evmVersion: 'istanbul',
          }
        },
        {
          version: '0.7.6',
          settings: {
            optimizer: {
              enabled: optimizerEnabled,
              runs: 200,
            },
            evmVersion: 'istanbul',
          }
        },
        {
          version: '0.8.0',
          settings: {
            optimizer: {
              enabled: optimizerEnabled,
              runs: 200,
            },
            evmVersion: 'istanbul',
          }
        }
    ]


  }
};



export default config;
