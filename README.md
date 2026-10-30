# CarbonX

**A blockchain-based carbon credit platform for registering projects, trading tokenized credits, and recording carbon credit retirements.**

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Contracts-Hardhat-yellow)](https://hardhat.org/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react)](https://vite.dev/)
[![ethers.js](https://img.shields.io/badge/Web3-ethers.js%20v6-2535A0)](https://docs.ethers.org/v6/)

## Live Demo

- **Application:** [carboncredits-nu.vercel.app](https://carboncredits-nu.vercel.app/)
- **Product walkthrough:** [Watch the CarbonX demo on Loom](https://www.loom.com/share/45af8666b2e744e185a0877d2a0afe73)

> The app includes an explicit Demo Mode for exploring the interface. Demo activity is stored locally in the browser and is **not** submitted to a blockchain. Live contract actions require a supported wallet, the correct network, and deployed contract addresses.

## MST Testnet Deployment

The following contracts are deployed on **MST Testnet (chain ID `91562037`)**:

| Contract | Address | Deployment transaction |
|---|---|---|
| CCT Token (`CarbonCreditToken`) | `0x72ba007D3D4D6DB4208Df978DdEa09Ee534E725D` | `0x4fa581aa4ad594ad98b7e9e17946d979a76454c93e0b61cac5905ff1016e1a55` |
| Project Registry (`ProjectRegistry`) | `0x7EaE52b82adB080E47757D188715eF938A63A165` | `0x0bfba28292a204dfcffd0478b2791c9fc3628e94b26c07a6c43965b9a700fc4a` |
| Marketplace (`Marketplace`) | `0xF90A826F81465bA2177B44b736be10B85C8F429B` | `0xd4199fbd0ff8e022bd4fff5c9cdd1ce327adef68ad98632ab9204168c311f340` |

These are public testnet deployments, not mainnet contracts. Testnet tokens have no guaranteed real-world value.

To connect the Vercel deployment to these contracts, add the following variables in the Vercel project settings and redeploy:

```env
VITE_CONTRACT_CCT=0x72ba007D3D4D6DB4208Df978DdEa09Ee534E725D
VITE_CONTRACT_MARKETPLACE=0xF90A826F81465bA2177B44b736be10B85C8F429B
VITE_CONTRACT_REGISTRY=0x7EaE52b82adB080E47757D188715eF938A63A165
VITE_CHAIN_ID=91562037
```

The complete deployment record, including transaction hashes, is in [`deployments.json`](./deployments.json).

## Overview

CarbonX models a carbon-credit lifecycle on Ethereum-compatible networks:

1. A seller registers a carbon project and submits its supporting document reference.
2. An authorized verifier reviews the project and approves a credit allocation.
3. An authorized verifier mints CCT tokens to a registered seller.
4. Sellers list credits in the marketplace; buyers purchase available credits.
5. Credit holders can retire tokens and generate a retirement certificate.

The contracts use CCT as an ERC-20 token, with the project registry and marketplace handling project status and credit listings.

## Features

- Wallet chooser for detected browser wallets, with an explicit user connection step.
- Role-based project registration, review, approval, and credit issuance.
- Marketplace support for partial credit purchases and seller listings.
- Buyer portfolio for credit balances, purchases, and retirements.
- PDF retirement certificates, with demo status distinguished from on-chain proof.
- Project and marketplace transparency views.
- Local Demo Mode for exploring the product without submitting transactions.

## Technology

- **Smart contracts:** Solidity, OpenZeppelin, Hardhat
- **Frontend:** React, Vite, ethers.js v6, React Router
- **Optional backend:** Node.js, Express, MongoDB

## Repository Structure

```text
contracts/       Solidity token, project registry, and marketplace
scripts/         Contract deployment scripts
test/            Hardhat contract tests
frontend/        React application
backend/         Optional Express API and MongoDB model
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- A browser wallet for live on-chain actions
- MongoDB only if you intend to run the optional backend

### Install and run the frontend

Clone the repository and install its dependencies:

```bash
git clone https://github.com/Shubhham-golekar/Carbon_Credits.git
cd Carbon_Credits
npm install
npm --prefix frontend install
npm --prefix frontend run dev
```

Vite starts the frontend at `http://localhost:5173`.

### Compile contracts and run tests

```bash
npm run compile
npm test
```

### Run a local blockchain

In one terminal:

```bash
npm run node
```

In another terminal:

```bash
npm run deploy:local
```

The deployment script writes deployment details and transaction hashes to `deployments.json` and updates the local `frontend/.env` file.

## Wallet and Network Configuration

Click **Connect Wallet** in the application and choose one of the detected browser wallets. The wallet will ask you to approve the connection. The app does not request wallet access automatically on page load.

For live transactions, configure the frontend with addresses for the deployed contracts and the corresponding chain ID:

```env
VITE_CONTRACT_CCT=0x...
VITE_CONTRACT_MARKETPLACE=0x...
VITE_CONTRACT_REGISTRY=0x...
VITE_CHAIN_ID=11155111
```

Use the chain ID that matches your deployment; `11155111` is Ethereum Sepolia. Never put a private key in frontend environment variables. Deployment secrets such as `PRIVATE_KEY` belong only in a local, untracked backend/deployment `.env` file.

## Deploy to MST Testnet

Create a local `.env` file in the repository root with a funded MST Testnet deployer:

```env
PRIVATE_KEY=your_testnet_deployer_private_key
MST_TESTNET_RPC=https://testnetrpc.mstblockchain.com
```

Then deploy the contracts:

```bash
npm run deploy:mst-testnet
```

The deployment script checks the network chain ID, records addresses and transaction hashes in `deployments.json`, and writes the local frontend configuration. Do not commit `.env` or expose its private key.

## Deploy to Sepolia

Create a local `.env` file in the repository root and provide the deployment settings:

```env
PRIVATE_KEY=your_deployer_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key
```

Then deploy:

```bash
npm run deploy:sepolia
```

Keep `.env` out of version control and never publish private keys or RPC credentials. Verify the resulting contract addresses and chain configuration before using live transactions.

## Optional Backend

```bash
cd backend
npm install
```

Configure `MONGODB_URI` and `PORT` in a local `.env` file, then start the backend with the script defined in `backend/package.json`.

## Smart Contracts

| Contract | Responsibility |
|---|---|
| `CarbonCreditToken.sol` | ERC-20 carbon credit token, role-based minting, and credit retirement |
| `ProjectRegistry.sol` | Project registration, review, approval, and status |
| `Marketplace.sol` | Escrowed listings, partial purchases, sale records, and platform fees |

Important operations include:

- **CCT:** `mint`, `retire`, `registerSeller`, `getRoles`
- **Registry:** `registerProject`, `approveProject`, `rejectProject`
- **Marketplace:** `createListing`, `cancelListing`, `buy`, `quoteBuy`

The deployed contract code and configuration determine the final behavior. Review the contracts and deployment settings before using real assets.

## Security and Demo Disclaimer

CarbonX is a software project and should not be treated as an audited carbon registry, certification body, or financial product. Smart-contract controls such as role checks, input validation, and reentrancy protection do not replace an independent security audit.

Demo Mode uses browser-local sample data. It does not create verified carbon credits, transfer funds, or record blockchain retirements. Only transactions confirmed by the connected wallet on a network with the correct deployed contracts are on-chain actions.
