const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deployment Script for CarbonX Platform
 *
 * Deployment order:
 * 1. CarbonCreditToken (CCT)
 * 2. ProjectRegistry
 * 3. Marketplace (depends on CCT address)
 *
 * After deployment, grants cross-contract roles so verifiers can
 * approve projects and mint tokens seamlessly.
 */
async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 31337 && !process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY is required for public-network deployments.");
  }
  if (network.name === "mstTestnet" && chainId !== 91562037) {
    throw new Error(`Refusing deployment: MST Testnet returned unexpected chain ID ${chainId}.`);
  }

  const [deployer, verifier, feeRecipient] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account is configured. Set PRIVATE_KEY in the root .env file.");
  }

  console.log("═══════════════════════════════════════════════");
  console.log("  CarbonX Platform Deployment");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Network:       ${network.name}`);
  console.log(`  Chain ID:      ${chainId}`);
  console.log(`  Deployer:      ${deployer.address}`);
  console.log(`  Verifier:      ${verifier ? verifier.address : deployer.address}`);
  console.log(`  Fee Recipient: ${feeRecipient ? feeRecipient.address : deployer.address}`);
  console.log("═══════════════════════════════════════════════\n");

  const verifierAddr      = verifier      ? verifier.address      : deployer.address;
  const feeRecipientAddr  = feeRecipient  ? feeRecipient.address  : deployer.address;
  const PLATFORM_FEE_BPS  = 250; // 2.5%

  // ── 1. Deploy CarbonCreditToken ──────────────────────────────────────────
  console.log("1. Deploying CarbonCreditToken...");
  const CCT = await ethers.getContractFactory("contracts/CarbonCreditToken.sol:CarbonCreditToken");
  const cct = await CCT.deploy();
  await cct.waitForDeployment();
  const cctAddress = await cct.getAddress();
  const cctDeployment = cct.deploymentTransaction();
  const cctReceipt = await cctDeployment.wait();
  if (cctReceipt.status !== 1) throw new Error("CarbonCreditToken deployment transaction failed.");
  console.log(`   ✅ CarbonCreditToken deployed at: ${cctAddress}`);
  console.log(`      Transaction: ${cctReceipt.hash}`);

  // ── 2. Deploy ProjectRegistry ────────────────────────────────────────────
  console.log("\n2. Deploying ProjectRegistry...");
  const Registry = await ethers.getContractFactory("contracts/ProjectRegistry.sol:ProjectRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  const registryDeployment = registry.deploymentTransaction();
  const registryReceipt = await registryDeployment.wait();
  if (registryReceipt.status !== 1) throw new Error("ProjectRegistry deployment transaction failed.");
  console.log(`   ✅ ProjectRegistry deployed at:   ${registryAddress}`);
  console.log(`      Transaction: ${registryReceipt.hash}`);

  // ── 3. Deploy Marketplace ────────────────────────────────────────────────
  console.log("\n3. Deploying Marketplace...");
  const Market = await ethers.getContractFactory("contracts/Marketplace.sol:Marketplace");
  const market = await Market.deploy(cctAddress, PLATFORM_FEE_BPS, feeRecipientAddr);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  const marketDeployment = market.deploymentTransaction();
  const marketReceipt = await marketDeployment.wait();
  if (marketReceipt.status !== 1) throw new Error("Marketplace deployment transaction failed.");
  console.log(`   ✅ Marketplace deployed at:       ${marketAddress}`);
  console.log(`      Transaction: ${marketReceipt.hash}`);

  // ── 4. Grant Roles ───────────────────────────────────────────────────────
  console.log("\n4. Configuring roles...");

  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));

  // Grant VERIFIER_ROLE in CCT and Registry to the verifier address
  const roleGrantTransactions = {};
  if (verifierAddr.toLowerCase() !== deployer.address.toLowerCase()) {
    const cctGrant = await cct.grantRole(VERIFIER_ROLE, verifierAddr);
    const cctGrantReceipt = await cctGrant.wait();
    if (cctGrantReceipt.status !== 1) throw new Error("CCT verifier role transaction failed.");
    roleGrantTransactions.cctVerifierRole = cctGrantReceipt.hash;

    const registryGrant = await registry.grantRole(VERIFIER_ROLE, verifierAddr);
    const registryGrantReceipt = await registryGrant.wait();
    if (registryGrantReceipt.status !== 1) throw new Error("Registry verifier role transaction failed.");
    roleGrantTransactions.registryVerifierRole = registryGrantReceipt.hash;
    console.log(`   ✅ Granted VERIFIER_ROLE to: ${verifierAddr}`);
  } else {
    console.log(`   ℹ️  Deployer already holds VERIFIER_ROLE (single signer mode)`);
  }

  // ── 5. Save deployment addresses ────────────────────────────────────────
  console.log("\n5. Saving deployment artifacts...");

  const deployment = {
    network:      network.name,
    chainId,
    deployedAt:   new Date().toISOString(),
    deployer:     deployer.address,
    contracts: {
      CarbonCreditToken: cctAddress,
      ProjectRegistry:   registryAddress,
      Marketplace:       marketAddress,
    },
    transactions: {
      CarbonCreditTokenDeployment: cctReceipt.hash,
      ProjectRegistryDeployment: registryReceipt.hash,
      MarketplaceDeployment: marketReceipt.hash,
      ...roleGrantTransactions,
    },
    config: {
      platformFeeBps:  PLATFORM_FEE_BPS,
      feeRecipient:    feeRecipientAddr,
    },
  };

  const outputPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`   ✅ Deployment info saved to: ${outputPath}`);

  // Also write to frontend env file helper
  const envContent = [
    `VITE_CONTRACT_CCT=${cctAddress}`,
    `VITE_CONTRACT_MARKETPLACE=${marketAddress}`,
    `VITE_CONTRACT_REGISTRY=${registryAddress}`,
    `VITE_CHAIN_ID=${deployment.chainId}`,
  ].join("\n");

  const frontendEnvPath = path.join(__dirname, "../frontend/.env");
  if (fs.existsSync(path.join(__dirname, "../frontend"))) {
    fs.writeFileSync(frontendEnvPath, envContent);
    console.log(`   ✅ Frontend .env updated: ${frontendEnvPath}`);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Deployment complete! 🌿");
  console.log("═══════════════════════════════════════════════");
  console.log(`  CCT Token:    ${cctAddress}`);
  console.log(`  Registry:     ${registryAddress}`);
  console.log(`  Marketplace:  ${marketAddress}`);
  console.log(`  CCT Tx:       ${cctReceipt.hash}`);
  console.log(`  Registry Tx:  ${registryReceipt.hash}`);
  console.log(`  Market Tx:    ${marketReceipt.hash}`);
  console.log("═══════════════════════════════════════════════\n");

  // ── Verify on Etherscan (Sepolia) ────────────────────────────────────────
  if (process.env.ETHERSCAN_API_KEY && deployment.chainId === 11155111) {
    console.log("6. Verifying contracts on Etherscan...");
    const { run } = require("hardhat");
    try {
      await run("verify:verify", { address: cctAddress, constructorArguments: [] });
      await run("verify:verify", { address: registryAddress, constructorArguments: [] });
      await run("verify:verify", {
        address: marketAddress,
        constructorArguments: [cctAddress, PLATFORM_FEE_BPS, feeRecipientAddr],
      });
      console.log("   ✅ All contracts verified on Etherscan");
    } catch (e) {
      console.log("   ⚠️  Etherscan verification failed:", e.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
