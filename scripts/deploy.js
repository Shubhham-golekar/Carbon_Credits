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
  const [deployer, verifier, feeRecipient] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════");
  console.log("  CarbonX Platform Deployment");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Network:       ${(await ethers.provider.getNetwork()).name}`);
  console.log(`  Deployer:      ${deployer.address}`);
  console.log(`  Verifier:      ${verifier ? verifier.address : deployer.address}`);
  console.log(`  Fee Recipient: ${feeRecipient ? feeRecipient.address : deployer.address}`);
  console.log("═══════════════════════════════════════════════\n");

  const verifierAddr      = verifier      ? verifier.address      : deployer.address;
  const feeRecipientAddr  = feeRecipient  ? feeRecipient.address  : deployer.address;
  const PLATFORM_FEE_BPS  = 250; // 2.5%

  // ── 1. Deploy CarbonCreditToken ──────────────────────────────────────────
  console.log("1. Deploying CarbonCreditToken...");
  const CCT = await ethers.getContractFactory("CarbonCreditToken");
  const cct = await CCT.deploy();
  await cct.waitForDeployment();
  const cctAddress = await cct.getAddress();
  console.log(`   ✅ CarbonCreditToken deployed at: ${cctAddress}`);

  // ── 2. Deploy ProjectRegistry ────────────────────────────────────────────
  console.log("\n2. Deploying ProjectRegistry...");
  const Registry = await ethers.getContractFactory("ProjectRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`   ✅ ProjectRegistry deployed at:   ${registryAddress}`);

  // ── 3. Deploy Marketplace ────────────────────────────────────────────────
  console.log("\n3. Deploying Marketplace...");
  const Market = await ethers.getContractFactory("Marketplace");
  const market = await Market.deploy(cctAddress, PLATFORM_FEE_BPS, feeRecipientAddr);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log(`   ✅ Marketplace deployed at:       ${marketAddress}`);

  // ── 4. Grant Roles ───────────────────────────────────────────────────────
  console.log("\n4. Configuring roles...");

  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));

  // Grant VERIFIER_ROLE in CCT and Registry to the verifier address
  if (verifierAddr !== deployer.address) {
    await (await cct.grantRole(VERIFIER_ROLE, verifierAddr)).wait();
    await (await registry.grantRole(VERIFIER_ROLE, verifierAddr)).wait();
    console.log(`   ✅ Granted VERIFIER_ROLE to: ${verifierAddr}`);
  } else {
    console.log(`   ℹ️  Deployer already holds VERIFIER_ROLE (single signer mode)`);
  }

  // ── 5. Save deployment addresses ────────────────────────────────────────
  console.log("\n5. Saving deployment artifacts...");

  const deployment = {
    network:      (await ethers.provider.getNetwork()).name,
    chainId:      Number((await ethers.provider.getNetwork()).chainId),
    deployedAt:   new Date().toISOString(),
    deployer:     deployer.address,
    contracts: {
      CarbonCreditToken: cctAddress,
      ProjectRegistry:   registryAddress,
      Marketplace:       marketAddress,
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
