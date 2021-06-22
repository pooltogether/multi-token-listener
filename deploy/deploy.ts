import chalk from 'chalk';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction, DeployResult } from 'hardhat-deploy/types';
import { factoryDeploy } from "@pooltogether/pooltogether-proxy-factory-package"

const displayLogs = !process.env.HIDE_DEPLOY_LOG;

function dim(logMessage: string) {
  if (displayLogs) {
    console.log(chalk.dim(logMessage));
  }
}

function cyan(logMessage: string) {
  if (displayLogs) {
    console.log(chalk.cyan(logMessage));
  }
}

function yellow(logMessage: string) {
  if (displayLogs) {
    console.log(chalk.yellow(logMessage));
  }
}

function green(logMessage: string) {
  if (displayLogs) {
    console.log(chalk.green(logMessage));
  }
}

function displayResult(name: string, result: DeployResult) {
  if (!result.newlyDeployed) {
    yellow(`Re-used existing ${name} at ${result.address}`);
  } else {
    green(`${name} deployed at ${result.address}`);
  }
}

const chainName = (chainId: number) => {
  switch (chainId) {
    case 1:
      return 'Mainnet';
    case 3:
      return 'Ropsten';
    case 4:
      return 'Rinkeby';
    case 5:
      return 'Goerli';
    case 42:
      return 'Kovan';
    case 77:
      return 'POA Sokol';
    case 99:
      return 'POA';
    case 100:
      return 'xDai';
    case 137:
      return 'Matic';
    case 31337:
      return 'HardhatEVM';
    case 80001:
      return 'Matic (Mumbai)';
    default:
      return 'Unknown';
  }
};

const deployFunction: any = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, getChainId, ethers } = hre;
  const { deploy } = deployments;

  let { deployer, admin } = await getNamedAccounts();

  const chainId = parseInt(await getChainId());
  // 31337 is unit testing, 1337 is for coverage
  const isTestEnvironment = chainId === 31337 || chainId === 1337;

  const signer = ethers.provider.getSigner(deployer);

  dim('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  dim('PoolTogether MultiTokenListener Deploy Script');
  dim('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

  dim(`network: ${chainName(chainId)} (${isTestEnvironment ? 'local' : 'remote'})`);
  dim(`deployer: ${deployer}`);

  if (!admin) {
    admin = signer._address;
  }

  dim(`deployer: ${admin}`);

  cyan(`\nDeploying MultiTokenListener Implementation...`);
  const multiTokenListener = await deploy('MultiTokenListener', {
    from: deployer,
    args: [],
    skipIfAlreadyDeployed: true
  });
  displayResult('MultiTokenListener Implementation', multiTokenListener);
  
  const multiTokenListenerAbi = (await hre.artifacts.readArtifact("MultiTokenListener")).abi
  const multiTokenListenerInterface = new ethers.utils.Interface(multiTokenListenerAbi)

  const initializerArgs: string = multiTokenListenerInterface.encodeFunctionData(multiTokenListenerInterface.getFunction("initialize(address)"),
      [
        deployer  // _owner
      ]
  )

  cyan(`now deploying using factoryDeploy`)
  // now deploy with generic proxy factory package
  const result = await factoryDeploy({
    implementationAddress: multiTokenListener.address,
    contractName: "MultiTokenListenerInstance",
    initializeData: initializerArgs,
    provider: ethers.provider,
    signer: signer
  })
  console.log(result)

  green("Done!")
};

export default deployFunction;
