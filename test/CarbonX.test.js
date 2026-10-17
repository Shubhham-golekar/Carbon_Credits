const { expect }  = require("chai");
const { ethers }  = require("hardhat");

/**
 * CarbonX – Comprehensive Test Suite
 * Coverage: CarbonCreditToken · ProjectRegistry · Marketplace
 * Topics:   mint · retire · list · buy (full & partial) · cancel · access control
 */
describe("CarbonX Platform", function () {
  // ─── Shared fixtures ──────────────────────────────────────────────────────
  let cct, registry, market;
  let owner, verifier, seller, buyer, buyer2, feeRecipient, stranger;

  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
  const SELLER_ROLE   = ethers.keccak256(ethers.toUtf8Bytes("SELLER_ROLE"));
  const ADMIN_ROLE    = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const DEFAULT_ADMIN = ethers.ZeroHash;

  // Helper: scale whole credits to 1e18
  const credits = (n) => ethers.parseEther(String(n));
  // Helper: price per token (whole credit)
  const priceOf  = (ethPerCredit) => ethers.parseEther(String(ethPerCredit));

  beforeEach(async () => {
    [owner, verifier, seller, buyer, buyer2, feeRecipient, stranger] =
      await ethers.getSigners();

    // Deploy CCT
    const CCT = await ethers.getContractFactory("CarbonCreditToken");
    cct = await CCT.connect(owner).deploy();
    await cct.waitForDeployment();

    // Deploy Registry
    const Registry = await ethers.getContractFactory("ProjectRegistry");
    registry = await Registry.connect(owner).deploy();
    await registry.waitForDeployment();

    // Deploy Marketplace (2.5% fee)
    const Market = await ethers.getContractFactory("Marketplace");
    market = await Market.connect(owner).deploy(
      await cct.getAddress(),
      250,
      feeRecipient.address
    );
    await market.waitForDeployment();

    // Setup roles
    await cct.connect(owner).grantRole(VERIFIER_ROLE, verifier.address);
    await cct.connect(owner).registerSeller(seller.address);
    await registry.connect(owner).grantSellerRole(seller.address);
    await registry.connect(owner).grantVerifierRole(verifier.address);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CarbonCreditToken
  // ══════════════════════════════════════════════════════════════════════════
  describe("CarbonCreditToken", () => {
    describe("Roles & Access Control", () => {
      it("owner has DEFAULT_ADMIN_ROLE and VERIFIER_ROLE", async () => {
        expect(await cct.hasRole(DEFAULT_ADMIN, owner.address)).to.be.true;
        expect(await cct.hasRole(VERIFIER_ROLE, owner.address)).to.be.true;
      });

      it("verifier has VERIFIER_ROLE", async () => {
        expect(await cct.hasRole(VERIFIER_ROLE, verifier.address)).to.be.true;
      });

      it("seller has SELLER_ROLE", async () => {
        expect(await cct.hasRole(SELLER_ROLE, seller.address)).to.be.true;
      });

      it("stranger has no roles", async () => {
        const { isAdmin, isVerifier, isSeller } = await cct.getRoles(stranger.address);
        expect(isAdmin).to.be.false;
        expect(isVerifier).to.be.false;
        expect(isSeller).to.be.false;
      });

      it("non-admin cannot grant SELLER_ROLE", async () => {
        await expect(
          cct.connect(stranger).registerSeller(stranger.address)
        ).to.be.reverted;
      });
    });

    describe("Minting", () => {
      it("verifier can mint credits to a registered seller", async () => {
        const tx = await cct.connect(verifier).mint(seller.address, 100, 1);
        await expect(tx)
          .to.emit(cct, "CreditsMinted");
        // Verify individual fields
        expect(await cct.balanceOf(seller.address)).to.equal(credits(100));
        expect(await cct.totalIssued()).to.equal(credits(100));
        expect(await cct.issuedByProject(1)).to.equal(credits(100));
      });

      it("minting reverts for non-verifier", async () => {
        await expect(
          cct.connect(stranger).mint(seller.address, 100, 1)
        ).to.be.reverted;
      });

      it("minting reverts for non-seller recipient", async () => {
        await expect(
          cct.connect(verifier).mint(stranger.address, 100, 1)
        ).to.be.revertedWith("CCT: recipient is not a registered seller");
      });

      it("minting reverts for zero amount", async () => {
        await expect(
          cct.connect(verifier).mint(seller.address, 0, 1)
        ).to.be.revertedWith("CCT: amount must be > 0");
      });

      it("minting reverts for zero address", async () => {
        await expect(
          cct.connect(verifier).mint(ethers.ZeroAddress, 100, 1)
        ).to.be.revertedWith("CCT: zero address seller");
      });

      it("accumulates issuance correctly across multiple mints", async () => {
        await cct.connect(verifier).mint(seller.address, 50, 1);
        await cct.connect(verifier).mint(seller.address, 75, 1);

        expect(await cct.totalIssued()).to.equal(credits(125));
        expect(await cct.issuedByProject(1)).to.equal(credits(125));
      });
    });

    describe("Retiring", () => {
      beforeEach(async () => {
        await cct.connect(verifier).mint(seller.address, 200, 1);
      });

      it("token holder can retire credits and emits Retired event", async () => {
        const tx = await cct.connect(seller).retire(credits(50), 1, "AcmeCorp 2024 offset");
        const receipt = await tx.wait();

        await expect(tx).to.emit(cct, "Retired");
        expect(await cct.balanceOf(seller.address)).to.equal(credits(150));
        expect(await cct.totalRetired()).to.equal(credits(50));
        expect(await cct.retiredByAddress(seller.address)).to.equal(credits(50));
      });

      it("stores retirement record on-chain", async () => {
        await cct.connect(seller).retire(credits(30), 1, "GreenCo offset");
        const record = await cct.getRetirement(0);

        expect(record.retiree).to.equal(seller.address);
        expect(record.amount).to.equal(credits(30));
        expect(record.projectId).to.equal(1);
        expect(record.reason).to.equal("GreenCo offset");
      });

      it("retirementCount increments correctly", async () => {
        await cct.connect(seller).retire(credits(10), 1, "A");
        await cct.connect(seller).retire(credits(10), 1, "B");
        expect(await cct.retirementCount()).to.equal(2);
      });

      it("reverts when retiring more than balance", async () => {
        await expect(
          cct.connect(seller).retire(credits(999), 1, "too much")
        ).to.be.revertedWith("CCT: insufficient balance to retire");
      });

      it("reverts retiring zero amount", async () => {
        await expect(
          cct.connect(seller).retire(0, 1, "zero")
        ).to.be.revertedWith("CCT: retire amount must be > 0");
      });

      it("reverts retiring with empty reason", async () => {
        await expect(
          cct.connect(seller).retire(credits(1), 1, "")
        ).to.be.revertedWith("CCT: reason required");
      });

      it("prevents double-spending (can't retire same tokens twice)", async () => {
        await cct.connect(seller).retire(credits(200), 1, "Full offset");
        await expect(
          cct.connect(seller).retire(credits(1), 1, "Over-retire attempt")
        ).to.be.revertedWith("CCT: insufficient balance to retire");
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ProjectRegistry
  // ══════════════════════════════════════════════════════════════════════════
  describe("ProjectRegistry", () => {
    const projectArgs = {
      name:      "Amazon Reforestation Fund",
      desc:      "Protecting 5000 ha of Amazon rainforest",
      location:  "Para, Brazil",
      type:      0, // Forest
      credits:   10000,
      ipfs:      "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    };

    describe("Registration", () => {
      it("registered seller can create a project and it starts Pending", async () => {
        const tx = await registry.connect(seller).registerProject(
          projectArgs.name, projectArgs.desc, projectArgs.location,
          projectArgs.type, projectArgs.credits, projectArgs.ipfs
        );
        await expect(tx).to.emit(registry, "ProjectRegistered").withArgs(
          1, seller.address, projectArgs.name, projectArgs.type, await latestTimestamp()
        );

        const p = await registry.getProject(1);
        expect(p.status).to.equal(0); // Pending
        expect(p.seller).to.equal(seller.address);
        expect(p.mintingEnabled).to.be.false;
      });

      it("non-seller cannot register a project", async () => {
        await expect(
          registry.connect(stranger).registerProject(
            "X", "Y", "Z", 0, 100, "QmHash"
          )
        ).to.be.revertedWith("Registry: caller is not a registered seller");
      });

      it("reverts if name is empty", async () => {
        await expect(
          registry.connect(seller).registerProject("", "desc", "loc", 0, 100, "QmHash")
        ).to.be.revertedWith("Registry: name required");
      });

      it("reverts if estimated credits is zero", async () => {
        await expect(
          registry.connect(seller).registerProject("N", "D", "L", 0, 0, "QmHash")
        ).to.be.revertedWith("Registry: estimated credits must be > 0");
      });

      it("tracks seller projects", async () => {
        await registry.connect(seller).registerProject(
          projectArgs.name, projectArgs.desc, projectArgs.location,
          projectArgs.type, projectArgs.credits, projectArgs.ipfs
        );
        const ids = await registry.getSellerProjects(seller.address);
        expect(ids.length).to.equal(1);
        expect(ids[0]).to.equal(1n);
      });
    });

    describe("Approval & Rejection", () => {
      beforeEach(async () => {
        await registry.connect(seller).registerProject(
          projectArgs.name, projectArgs.desc, projectArgs.location,
          projectArgs.type, projectArgs.credits, projectArgs.ipfs
        );
      });

      it("verifier can approve a project", async () => {
        await expect(
          registry.connect(verifier).approveProject(1, 9000)
        ).to.emit(registry, "ProjectApproved");

        const p = await registry.getProject(1);
        expect(p.status).to.equal(1); // Approved
        expect(p.mintingEnabled).to.be.true;
        expect(await registry.isApprovedForMinting(1)).to.be.true;
      });

      it("verifier can reject a project with reason", async () => {
        await expect(
          registry.connect(verifier).rejectProject(1, "Documents incomplete")
        ).to.emit(registry, "ProjectRejected");

        const p = await registry.getProject(1);
        expect(p.status).to.equal(2); // Rejected
        expect(p.rejectionReason).to.equal("Documents incomplete");
      });

      it("non-verifier cannot approve", async () => {
        await expect(
          registry.connect(stranger).approveProject(1, 1000)
        ).to.be.reverted;
      });

      it("cannot approve an already-approved project", async () => {
        await registry.connect(verifier).approveProject(1, 1000);
        await expect(
          registry.connect(verifier).approveProject(1, 500)
        ).to.be.revertedWith("Registry: not pending");
      });

      it("cannot reject with empty reason", async () => {
        await expect(
          registry.connect(verifier).rejectProject(1, "")
        ).to.be.revertedWith("Registry: reason required");
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Marketplace
  // ══════════════════════════════════════════════════════════════════════════
  describe("Marketplace", () => {
    const LISTING_AMOUNT = credits(100);   // 100 CCT
    const PRICE_PER_TOKEN = priceOf(0.01); // 0.01 ETH per credit

    beforeEach(async () => {
      // Mint 200 CCT to seller
      await cct.connect(verifier).mint(seller.address, 200, 1);
      // Seller approves Marketplace to spend tokens
      await cct.connect(seller).approve(await market.getAddress(), credits(200));
    });

    describe("Creating Listings", () => {
      it("seller can create a listing and tokens are escrowed", async () => {
        await expect(
          market.connect(seller).createListing(LISTING_AMOUNT, PRICE_PER_TOKEN, 1)
        ).to.emit(market, "Listed");

        const listing = await market.listings(1);
        expect(listing.active).to.be.true;
        expect(listing.remainingAmount).to.equal(LISTING_AMOUNT);

        // Tokens should be held by marketplace
        expect(await cct.balanceOf(await market.getAddress())).to.equal(LISTING_AMOUNT);
      });

      it("reverts if amount is zero", async () => {
        await expect(
          market.connect(seller).createListing(0, PRICE_PER_TOKEN, 1)
        ).to.be.revertedWith("Market: amount must be > 0");
      });

      it("reverts if price is zero", async () => {
        await expect(
          market.connect(seller).createListing(LISTING_AMOUNT, 0, 1)
        ).to.be.revertedWith("Market: price must be > 0");
      });

      it("reverts if allowance is insufficient", async () => {
        // Reset allowance
        await cct.connect(seller).approve(await market.getAddress(), 0);
        await expect(
          market.connect(seller).createListing(LISTING_AMOUNT, PRICE_PER_TOKEN, 1)
        ).to.be.revertedWith("Market: insufficient allowance");
      });
    });

    describe("Cancelling Listings", () => {
      beforeEach(async () => {
        await market.connect(seller).createListing(LISTING_AMOUNT, PRICE_PER_TOKEN, 1);
      });

      it("seller can cancel and tokens are returned", async () => {
        const balBefore = await cct.balanceOf(seller.address);

        await expect(
          market.connect(seller).cancelListing(1)
        ).to.emit(market, "Cancelled");

        expect(await cct.balanceOf(seller.address)).to.equal(balBefore + LISTING_AMOUNT);

        const listing = await market.listings(1);
        expect(listing.active).to.be.false;
      });

      it("stranger cannot cancel seller's listing", async () => {
        await expect(
          market.connect(stranger).cancelListing(1)
        ).to.be.revertedWith("Market: not authorized");
      });

      it("cannot cancel an inactive listing", async () => {
        await market.connect(seller).cancelListing(1);
        await expect(
          market.connect(seller).cancelListing(1)
        ).to.be.revertedWith("Market: already inactive");
      });
    });

    describe("Buying – Full Purchase", () => {
      beforeEach(async () => {
        await market.connect(seller).createListing(LISTING_AMOUNT, PRICE_PER_TOKEN, 1);
      });

      it("buyer can purchase all tokens from a listing", async () => {
        // Cost = 100 CCT * 0.01 ETH = 1 ETH
        const cost = ethers.parseEther("1.0");

        await expect(
          market.connect(buyer).buy(1, LISTING_AMOUNT, { value: cost })
        ).to.emit(market, "Sold");

        expect(await cct.balanceOf(buyer.address)).to.equal(LISTING_AMOUNT);

        const listing = await market.listings(1);
        expect(listing.active).to.be.false;
        expect(listing.remainingAmount).to.equal(0n);
      });

      it("fee recipient receives 2.5% platform fee", async () => {
        const cost = ethers.parseEther("1.0");
        const expectedFee = (cost * 250n) / 10000n; // 0.025 ETH

        const feeBefore = await ethers.provider.getBalance(feeRecipient.address);
        await market.connect(buyer).buy(1, LISTING_AMOUNT, { value: cost });
        const feeAfter = await ethers.provider.getBalance(feeRecipient.address);

        expect(feeAfter - feeBefore).to.equal(expectedFee);
      });

      it("overpayment is refunded to buyer", async () => {
        const overpay = ethers.parseEther("2.0"); // Send 2 ETH, cost is 1 ETH
        const cost    = ethers.parseEther("1.0");

        const buyerBefore = await ethers.provider.getBalance(buyer.address);
        const tx  = await market.connect(buyer).buy(1, LISTING_AMOUNT, { value: overpay });
        const rcpt = await tx.wait();
        const gasUsed = rcpt.gasUsed * rcpt.gasPrice;
        const buyerAfter = await ethers.provider.getBalance(buyer.address);

        // buyer should have spent ~1 ETH + gas (not 2 ETH)
        const spent = buyerBefore - buyerAfter;
        expect(spent).to.be.closeTo(cost + gasUsed, ethers.parseEther("0.001"));
      });

      it("seller cannot buy their own listing", async () => {
        const cost = ethers.parseEther("1.0");
        await expect(
          market.connect(seller).buy(1, LISTING_AMOUNT, { value: cost })
        ).to.be.revertedWith("Market: seller cannot buy own listing");
      });

      it("reverts if insufficient ETH sent", async () => {
        await expect(
          market.connect(buyer).buy(1, LISTING_AMOUNT, { value: ethers.parseEther("0.5") })
        ).to.be.revertedWith("Market: insufficient ETH sent");
      });
    });

    describe("Buying – Partial Purchase", () => {
      beforeEach(async () => {
        await market.connect(seller).createListing(LISTING_AMOUNT, PRICE_PER_TOKEN, 1);
      });

      it("buyer can purchase a partial amount and listing remains active", async () => {
        const buyAmount = credits(40); // buy 40 of 100
        const cost      = ethers.parseEther("0.4"); // 40 * 0.01 ETH

        await market.connect(buyer).buy(1, buyAmount, { value: cost });

        expect(await cct.balanceOf(buyer.address)).to.equal(buyAmount);

        const listing = await market.listings(1);
        expect(listing.active).to.be.true;
        expect(listing.remainingAmount).to.equal(credits(60));
      });

      it("two buyers can buy from the same listing sequentially", async () => {
        const cost1 = ethers.parseEther("0.4");
        const cost2 = ethers.parseEther("0.6");

        await market.connect(buyer).buy(1, credits(40), { value: cost1 });
        await market.connect(buyer2).buy(1, credits(60), { value: cost2 });

        expect(await cct.balanceOf(buyer.address)).to.equal(credits(40));
        expect(await cct.balanceOf(buyer2.address)).to.equal(credits(60));

        const listing = await market.listings(1);
        expect(listing.active).to.be.false;
      });

      it("reverts if buy amount exceeds remaining supply", async () => {
        const cost = ethers.parseEther("1.1");
        await expect(
          market.connect(buyer).buy(1, credits(101), { value: cost })
        ).to.be.revertedWith("Market: amount exceeds available supply");
      });

      it("quoteBuy returns correct values", async () => {
        const { gross, fee, net } = await market.quoteBuy(1, credits(50));
        expect(gross).to.equal(ethers.parseEther("0.5"));
        expect(fee).to.equal(ethers.parseEther("0.0125")); // 2.5%
        expect(net).to.equal(ethers.parseEther("0.4875"));
      });
    });

    describe("Price Updates", () => {
      beforeEach(async () => {
        await market.connect(seller).createListing(LISTING_AMOUNT, PRICE_PER_TOKEN, 1);
      });

      it("seller can update listing price", async () => {
        const newPrice = priceOf(0.02);
        await expect(
          market.connect(seller).updateListingPrice(1, newPrice)
        ).to.emit(market, "ListingUpdated");

        expect((await market.listings(1)).pricePerToken).to.equal(newPrice);
      });

      it("stranger cannot update listing price", async () => {
        await expect(
          market.connect(stranger).updateListingPrice(1, priceOf(0.02))
        ).to.be.revertedWith("Market: not seller");
      });
    });

    describe("Admin Functions", () => {
      it("admin can update platform fee", async () => {
        await expect(
          market.connect(owner).setFee(500)
        ).to.emit(market, "FeeUpdated").withArgs(250, 500, owner.address);

        expect(await market.platformFeeBps()).to.equal(500);
      });

      it("cannot set fee above 10%", async () => {
        await expect(
          market.connect(owner).setFee(1001)
        ).to.be.revertedWith("Market: fee too high");
      });

      it("non-admin cannot update fee", async () => {
        await expect(
          market.connect(stranger).setFee(100)
        ).to.be.reverted;
      });

      it("admin can cancel any listing", async () => {
        await market.connect(seller).createListing(LISTING_AMOUNT, PRICE_PER_TOKEN, 1);
        await expect(
          market.connect(owner).cancelListing(1)
        ).to.emit(market, "Cancelled");
      });
    });

    describe("Sale History & Views", () => {
      beforeEach(async () => {
        await market.connect(seller).createListing(LISTING_AMOUNT, PRICE_PER_TOKEN, 1);
        await market.connect(buyer).buy(1, credits(30), { value: ethers.parseEther("0.3") });
      });

      it("records sale history correctly", async () => {
        expect(await market.totalSales()).to.equal(1);
        const sale = await market.getSale(0);
        expect(sale.buyer).to.equal(buyer.address);
        expect(sale.amount).to.equal(credits(30));
      });

      it("tracks buyer purchase indexes", async () => {
        const indexes = await market.getBuyerPurchases(buyer.address);
        expect(indexes.length).to.equal(1);
        expect(indexes[0]).to.equal(0n);
      });
    });
  });

  // ─── Helper ────────────────────────────────────────────────────────────────
  async function latestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});
