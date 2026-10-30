require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const DEPLOYER_ACCOUNTS = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const MST_TESTNET_RPC = process.env.MST_TESTNET_RPC || "https://testnetrpc.mstblockchain.com";
const MST_MAINNET_RPC = process.env.MST_MAINNET_RPC || "https://mariorpc.mstblockchain.com";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: DEPLOYER_ACCOUNTS,
      chainId: 11155111,
    },
    mstTestnet: {
      url: MST_TESTNET_RPC,
      chainId: 91562037,
      accounts: DEPLOYER_ACCOUNTS,
    },
    mstMainnet: {
      url: MST_MAINNET_RPC,
      chainId: 4646,
      accounts: DEPLOYER_ACCOUNTS,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};
