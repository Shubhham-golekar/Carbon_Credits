# 🌱 CarbonX — Blockchain Carbon Credit Trading Platform

> A fully decentralized, end-to-end carbon credit issuance, trading, and retirement platform built on Ethereum.

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?logo=solidity)](https://soliditylang.org)
[![Hardhat](https://img.shields.io/badge/Framework-Hardhat-yellow)](https://hardhat.org)
[![React](https://img.shields.io/badge/Frontend-React+Vite-61DAFB?logo=react)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📐 Architecture

```
carbonx/
├── contracts/                  # Solidity smart contracts
│   ├── CarbonCreditToken.sol   # ERC-20 CCT token (mint, retire, roles)
│   ├── ProjectRegistry.sol     # Project registration & verification
│   └── Marketplace.sol         # P2P trading with partial fills
├── scripts/
│   └── deploy.js               # Deployment script (all 3 contracts)
├── test/
│   └── CarbonX.test.js         # 40+ Mocha/Chai tests
├── frontend/                   # React + Vite + ethers.js v6
│   └── src/
│       ├── context/            # Web3Context (wallet, contracts, roles)
│       ├── contracts/          # ABIs & addresses
│       ├── pages/
│       │   ├── LandingPage.jsx
│       │   ├── TransparencyPage.jsx
│       │   ├── ProjectDetail.jsx
│       │   ├── seller/         # SellerDashboard, RegisterProject, ManageListings
│       │   ├── buyer/          # BuyerDashboard, Marketplace, Portfolio
│       │   └── admin/          # AdminDashboard (verify, mint, grant roles)
│       └── utils/              # Formatting helpers
└── backend/                    # Node.js + Express + MongoDB
    ├── index.js                # REST API server
    └── models/Project.js       # Mongoose schema
```

---

## 🔑 Core Concept

| Entity | Role |
|---|---|
| **CCT Token** | 1 CCT = 1 ton CO₂ offset (ERC-20, ERC-20Burnable) |
| **VERIFIER** | Reviews projects and authorizes minting |
| **SELLER** | Registers projects, receives minted CCT, creates listings |
| **BUYER** | Purchases CCT, retires credits, gets PDF certificate |
| **ADMIN** | Full access — grant/revoke all roles |

---

## 🛠 Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **MetaMask** browser extension
- **MongoDB** (optional — for backend)
- **Infura/Alchemy** RPC URL (for Sepolia deployment)

---

## ⚡ Quick Start

### 1. Clone & Install Root Dependencies
```bash
cd hakethon
npm install
```

### 2. Compile Contracts
```bash
npm run compile
# OR
npx hardhat compile
```

### 3. Run Tests
```bash
npm test
# OR
npx hardhat test
```

### 4. Start Local Hardhat Node
```bash
npm run node
# This starts a local blockchain at http://127.0.0.1:8545
```

### 5. Deploy Locally
```bash
npm run deploy:local
```

This creates `deployments.json` in the root and auto-updates `frontend/.env`.

---

## 🚀 Deploy to Sepolia Testnet

### Step 1 — Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
PRIVATE_KEY=your_wallet_private_key_here
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
ETHERSCAN_API_KEY=your_etherscan_key
```

> ⚠️ **Never commit `.env` to git!** It contains your private key.

### Step 2 — Deploy
```bash
npm run deploy:sepolia
```

Contract addresses will be printed and saved to `deployments.json`.

### Step 3 — Update Frontend
After deployment, `frontend/.env` is updated automatically. If not, copy manually:
```env
VITE_CONTRACT_CCT=0x...
VITE_CONTRACT_MARKETPLACE=0x...
VITE_CONTRACT_REGISTRY=0x...
VITE_CHAIN_ID=11155111
```

---

## 🌐 Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Required wallet setup for full functionality:
1. Import your deployer account into MetaMask
2. Add Sepolia (or localhost) network
3. Connect wallet on the site
4. The deployer has ADMIN + VERIFIER roles automatically

---

## 🔧 Backend Setup (Optional)

```bash
cd backend
npm install

# Create .env
echo "MONGODB_URI=mongodb://localhost:27017/carbonx" > .env
echo "PORT=5000" >> .env

npm run dev
# Starts at http://localhost:5000
```

API endpoints:
```
GET    /api/projects              - List all projects
GET    /api/projects/:id          - Get single project  
POST   /api/projects              - Register project metadata
PATCH  /api/projects/:id          - Update metadata
PATCH  /api/projects/:id/status   - Update approval status
POST   /api/projects/:id/upload   - Upload documents
GET    /api/stats                 - Platform statistics
GET    /api/health                - Health check
```

---

## 📋 Smart Contract Details

### CarbonCreditToken.sol (CCT)

```solidity
// Roles
VERIFIER_ROLE — can mint credits
SELLER_ROLE   — can receive minted credits
DEFAULT_ADMIN — can grant/revoke all roles

// Key functions
mint(seller, amount, projectId)          // VERIFIER only
retire(amount, projectId, reason)        // Any token holder
registerSeller(address)                  // ADMIN only
getRoles(address) returns (bool, bool, bool)
```

### ProjectRegistry.sol

```solidity
registerProject(name, desc, location, type, credits, ipfsHash)   // SELLER
approveProject(projectId, approvedCredits)                         // VERIFIER
rejectProject(projectId, reason)                                   // VERIFIER
```

### Marketplace.sol

```solidity
createListing(amount, pricePerToken, projectId)   // Any token holder
cancelListing(listingId)                           // Seller or ADMIN
buy(listingId, amount) payable                     // Anyone
quoteBuy(listingId, amount) view                   // Preview cost
```

---

## 🧪 Test Coverage

```
CarbonX Platform
  CarbonCreditToken
    Roles & Access Control   ✅ 5 tests
    Minting                  ✅ 6 tests
    Retiring                 ✅ 7 tests
  ProjectRegistry
    Registration             ✅ 5 tests
    Approval & Rejection     ✅ 5 tests
  Marketplace
    Creating Listings        ✅ 4 tests
    Cancelling Listings      ✅ 3 tests
    Buying – Full Purchase   ✅ 5 tests
    Buying – Partial         ✅ 4 tests
    Price Updates            ✅ 2 tests
    Admin Functions          ✅ 4 tests
    Sale History & Views     ✅ 2 tests
```

---

## 🔒 Security Features

| Feature | Implementation |
|---|---|
| Reentrancy protection | `ReentrancyGuard` on all state-changing functions |
| Role-based access | `AccessControl` with VERIFIER, SELLER, ADMIN roles |
| Input validation | `require()` guards on all sensitive parameters |
| CEI pattern | Check-Effects-Interactions in `buy()` |
| Overpayment refund | ETH excess automatically returned in `buy()` |
| Token escrow | Tokens pulled into marketplace contract on listing |
| Anti-double retire | Balance check before burn |
| Anti-over-sell | `remainingAmount` check before purchase |
| Fee cap | Platform fee hard-capped at 10% (1000 bps) |

---

## 🌍 Platform Flow

```
1. Admin grants SELLER_ROLE to seller
2. Seller registers project (name, docs, IPFS hash) → Pending
3. Verifier reviews → approves with credit allocation
4. Verifier/Admin calls mint() → CCT tokens sent to seller
5. Seller approves Marketplace → createListing(amount, price)
6. Buyer calls buy(listingId, amount) with ETH
7. Tokens transferred to buyer; ETH to seller (minus 2.5% fee)
8. Buyer can retire(amount, projectId, reason) → tokens burned
9. Frontend generates PDF certificate with tx hash
10. Every step is permanently recorded on-chain
```

---

## 📜 License

MIT — see [LICENSE](LICENSE)

---

*Built for the Hackathon 2026 · CarbonX Team*
