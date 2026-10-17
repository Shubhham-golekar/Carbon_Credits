// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ============================================================================
 * CARBONX / ECOCHAIN - COMBINED SMART CONTRACTS FOR REMIX IDE DEPLOYMENT
 * ============================================================================
 * 
 * 📋 DEPLOYMENT INSTRUCTIONS IN REMIX IDE (https://remix.ethereum.org):
 * 
 * 1. Create a new file in Remix named `CombinedContracts.sol` and paste this code.
 * 2. In Solidity Compiler tab:
 *    - Select Compiler version: 0.8.20 (or higher 0.8.x)
 *    - Click "Advanced Configurations"
 *    - Check "Enable optimization" (200 runs)
 *    - Check "Enable via-ir" (Prevents "Stack too deep" compiler error)
 *    - Click "Compile CombinedContracts.sol"
 * 3. In Deploy & Run Transactions tab:
 *    - Environment: "Injected Provider - MetaMask" (connect your Sepolia or local testnet)
 * 
 * 🚀 DEPLOYMENT ORDER & CONSTRUCTOR ARGUMENTS:
 * 
 * Step 1: Deploy `CarbonCreditToken`
 *    - Select Contract: "CarbonCreditToken"
 *    - Constructor Arguments: (none) -> Click "Deploy"
 *    - COPY the deployed CarbonCreditToken address!
 * 
 * Step 2: Deploy `ProjectRegistry`
 *    - Select Contract: "ProjectRegistry"
 *    - Constructor Arguments: (none) -> Click "Deploy"
 *    - COPY the deployed ProjectRegistry address!
 * 
 * Step 3: Deploy `Marketplace`
 *    - Select Contract: "Marketplace"
 *    - Constructor Arguments:
 *        tokenAddress:    <Address of CarbonCreditToken from Step 1>
 *        platformFeeBps_: 250   (2.5% platform fee, 100 = 1%)
 *        feeRecipient_:   <Your MetaMask Wallet Address>
 *    - Click "Deploy"
 *    - COPY the deployed Marketplace address!
 * 
 * Step 4: Setup Roles & Permissions:
 *    - In CarbonCreditToken: call `grantRole(VERIFIER_ROLE, <your_or_verifier_address>)`
 *    - In CarbonCreditToken: call `registerSeller(<seller_address>)`
 *    - In ProjectRegistry: call `grantSellerRole(<seller_address>)`
 * 
 * Step 5: Update your frontend `.env` file:
 *    VITE_CCT_ADDRESS=<CarbonCreditToken_Address>
 *    VITE_REGISTRY_ADDRESS=<ProjectRegistry_Address>
 *    VITE_MARKETPLACE_ADDRESS=<Marketplace_Address>
 * ============================================================================
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ============================================================================
// 1. CARBON CREDIT TOKEN (CCT)
// ============================================================================

/**
 * @title CarbonCreditToken (CCT)
 * @notice ERC-20 token representing carbon credits. 1 CCT = 1 ton of CO2 offset.
 * @dev Supports role-based minting (VERIFIER only), burning/retiring credits,
 *      and per-project issuance tracking.
 */
contract CarbonCreditToken is ERC20, ERC20Burnable, AccessControl, ReentrancyGuard {
    // ─── Roles ────────────────────────────────────────────────────────────────
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant SELLER_ROLE   = keccak256("SELLER_ROLE");

    // ─── State ────────────────────────────────────────────────────────────────
    /// @notice Total credits ever issued across all projects
    uint256 public totalIssued;

    /// @notice Total credits retired (burned) across all time
    uint256 public totalRetired;

    /// @notice Credits issued per projectId
    mapping(uint256 => uint256) public issuedByProject;

    /// @notice Credits retired per address
    mapping(address => uint256) public retiredByAddress;

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct RetirementRecord {
        address retiree;
        uint256 amount;
        uint256 projectId;
        string  reason;
        uint256 timestamp;
        bytes32 txHash; // stored client-side; emitted in event
    }

    RetirementRecord[] public retirementHistory;

    // ─── Events ───────────────────────────────────────────────────────────────
    event CreditsMinted(
        address indexed seller,
        uint256 amount,
        uint256 indexed projectId,
        address indexed verifier,
        uint256 timestamp
    );

    event Retired(
        address indexed retiree,
        uint256 amount,
        uint256 indexed projectId,
        string  reason,
        uint256 retirementIndex,
        uint256 timestamp
    );

    event SellerRegistered(address indexed seller, address indexed admin);
    event SellerRevoked(address indexed seller, address indexed admin);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() ERC20("Carbon Credit Token", "CCT") {
        // Deployer gets DEFAULT_ADMIN_ROLE which can grant/revoke all other roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // ─── Minting ──────────────────────────────────────────────────────────────

    /**
     * @notice Mint carbon credits to a verified seller for an approved project.
     * @dev Only callable by VERIFIER_ROLE. Enforces non-zero checks.
     * @param seller    Address of the seller receiving credits
     * @param amount    Number of tokens (in whole credits; scaled by 1e18 internally)
     * @param projectId The registry project ID that backs these credits
     */
    function mint(
        address seller,
        uint256 amount,
        uint256 projectId
    ) external onlyRole(VERIFIER_ROLE) nonReentrant {
        require(seller != address(0), "CCT: zero address seller");
        require(amount > 0, "CCT: amount must be > 0");
        require(hasRole(SELLER_ROLE, seller), "CCT: recipient is not a registered seller");

        uint256 scaledAmount = amount * 1e18;
        _mint(seller, scaledAmount);

        totalIssued           += scaledAmount;
        issuedByProject[projectId] += scaledAmount;

        emit CreditsMinted(seller, scaledAmount, projectId, msg.sender, block.timestamp);
    }

    // ─── Retiring ─────────────────────────────────────────────────────────────

    /**
     * @notice Retire (burn) credits to claim a CO2 offset.
     * @dev Records the retirement on-chain permanently.
     * @param amount    Number of CCT tokens to burn (in wei, 1e18 = 1 credit)
     * @param projectId The project these credits originated from
     * @param reason    Human-readable reason / company name for certificate
     */
    function retire(
        uint256 amount,
        uint256 projectId,
        string calldata reason
    ) external nonReentrant {
        require(amount > 0, "CCT: retire amount must be > 0");
        require(bytes(reason).length > 0, "CCT: reason required");
        require(balanceOf(msg.sender) >= amount, "CCT: insufficient balance to retire");

        _burn(msg.sender, amount);

        totalRetired                  += amount;
        retiredByAddress[msg.sender]  += amount;

        uint256 idx = retirementHistory.length;
        retirementHistory.push(RetirementRecord({
            retiree:   msg.sender,
            amount:    amount,
            projectId: projectId,
            reason:    reason,
            timestamp: block.timestamp,
            txHash:    bytes32(0) // placeholder; real tx hash captured off-chain
        }));

        emit Retired(msg.sender, amount, projectId, reason, idx, block.timestamp);
    }

    // ─── Seller Management ────────────────────────────────────────────────────

    /**
     * @notice Grant SELLER_ROLE to an address (admin only).
     */
    function registerSeller(address seller) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(seller != address(0), "CCT: zero address");
        _grantRole(SELLER_ROLE, seller);
        emit SellerRegistered(seller, msg.sender);
    }

    /**
     * @notice Revoke SELLER_ROLE from an address (admin only).
     */
    function revokeSeller(address seller) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(SELLER_ROLE, seller);
        emit SellerRevoked(seller, msg.sender);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Total number of retirement records ever created
    function retirementCount() external view returns (uint256) {
        return retirementHistory.length;
    }

    /// @notice Returns the full retirement record for a given index
    function getRetirement(uint256 index) external view returns (RetirementRecord memory) {
        require(index < retirementHistory.length, "CCT: index out of bounds");
        return retirementHistory[index];
    }

    /// @notice Check if an address holds any of the platform roles
    function getRoles(address account) external view returns (bool isAdmin, bool isVerifier, bool isSeller) {
        isAdmin    = hasRole(DEFAULT_ADMIN_ROLE, account);
        isVerifier = hasRole(VERIFIER_ROLE, account);
        isSeller   = hasRole(SELLER_ROLE, account);
    }

    // ─── Overrides ────────────────────────────────────────────────────────────
    function supportsInterface(bytes4 interfaceId)
        public view override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

// ============================================================================
// 2. PROJECT REGISTRY
// ============================================================================

/**
 * @title ProjectRegistry
 * @notice Manages carbon project registration, verification, and approval workflow.
 * @dev Sellers register projects here. Verifiers approve or reject them.
 *      Approval unlocks minting in CarbonCreditToken.
 */
contract ProjectRegistry is AccessControl, ReentrancyGuard {
    // ─── Roles ────────────────────────────────────────────────────────────────
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant SELLER_ROLE   = keccak256("SELLER_ROLE");

    // ─── Enums ────────────────────────────────────────────────────────────────
    enum ProjectStatus { Pending, Approved, Rejected }
    enum ProjectType   { Forest, Solar, Wind, Hydro, Other }

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Project {
        uint256     id;
        address     seller;
        string      name;
        string      description;
        string      location;
        ProjectType projectType;
        uint256     estimatedCredits; // in whole CCT credits
        uint256     approvedCredits;  // in whole CCT credits (set on approval)
        string      ipfsDocHash;      // IPFS CID of verification docs
        ProjectStatus status;
        uint256     registeredAt;
        uint256     reviewedAt;
        string      rejectionReason;
        bool        mintingEnabled;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 private _projectIdCounter;

    /// @notice projectId => Project
    mapping(uint256 => Project) public projects;

    /// @notice seller address => list of their projectIds
    mapping(address => uint256[]) public sellerProjects;

    /// @notice projectId => bool (true = verified and authorized for minting)
    mapping(uint256 => bool) public approvedForMinting;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ProjectRegistered(
        uint256 indexed projectId,
        address indexed seller,
        string  name,
        ProjectType projectType,
        uint256 timestamp
    );

    event ProjectApproved(
        uint256 indexed projectId,
        address indexed verifier,
        uint256 approvedCredits,
        uint256 timestamp
    );

    event ProjectRejected(
        uint256 indexed projectId,
        address indexed verifier,
        string  reason,
        uint256 timestamp
    );

    event ProjectUpdated(uint256 indexed projectId, address indexed seller, uint256 timestamp);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // ─── Seller Functions ─────────────────────────────────────────────────────

    /**
     * @notice Register a new carbon credit project for verification.
     * @param name             Project display name
     * @param description      Project description
     * @param location         Geographic location (e.g. "Amazon, Brazil")
     * @param projectType      Enum: Forest=0, Solar=1, Wind=2, Hydro=3, Other=4
     * @param estimatedCredits Estimated CCT tokens to be issued (whole units)
     * @param ipfsDocHash      IPFS CID pointing to verification documents
     * @return projectId       The newly assigned project ID
     */
    function registerProject(
        string calldata name,
        string calldata description,
        string calldata location,
        ProjectType projectType,
        uint256 estimatedCredits,
        string calldata ipfsDocHash
    ) external nonReentrant returns (uint256 projectId) {
        require(hasRole(SELLER_ROLE, msg.sender), "Registry: caller is not a registered seller");
        require(bytes(name).length > 0, "Registry: name required");
        require(bytes(location).length > 0, "Registry: location required");
        require(estimatedCredits > 0, "Registry: estimated credits must be > 0");
        require(bytes(ipfsDocHash).length > 0, "Registry: IPFS hash required");

        _projectIdCounter++;
        projectId = _projectIdCounter;

        projects[projectId] = Project({
            id:               projectId,
            seller:           msg.sender,
            name:             name,
            description:      description,
            location:         location,
            projectType:      projectType,
            estimatedCredits: estimatedCredits,
            approvedCredits:  0,
            ipfsDocHash:      ipfsDocHash,
            status:           ProjectStatus.Pending,
            registeredAt:     block.timestamp,
            reviewedAt:       0,
            rejectionReason:  "",
            mintingEnabled:   false
        });

        sellerProjects[msg.sender].push(projectId);

        emit ProjectRegistered(projectId, msg.sender, name, projectType, block.timestamp);
    }

    /**
     * @notice Update project metadata (only while Pending).
     */
    function updateProject(
        uint256 projectId,
        string calldata description,
        string calldata ipfsDocHash,
        uint256 estimatedCredits
    ) external nonReentrant {
        Project storage p = _getOwnedPendingProject(projectId);
        require(estimatedCredits > 0, "Registry: estimated credits must be > 0");

        p.description      = description;
        p.ipfsDocHash      = ipfsDocHash;
        p.estimatedCredits = estimatedCredits;

        emit ProjectUpdated(projectId, msg.sender, block.timestamp);
    }

    // ─── Verifier Functions ───────────────────────────────────────────────────

    /**
     * @notice Approve a project and set the actual minting allocation.
     * @param projectId      The project to approve
     * @param approvedCredits How many CCT tokens are authorized for minting
     */
    function approveProject(
        uint256 projectId,
        uint256 approvedCredits
    ) external onlyRole(VERIFIER_ROLE) nonReentrant {
        Project storage p = projects[projectId];
        require(p.id != 0, "Registry: project not found");
        require(p.status == ProjectStatus.Pending, "Registry: not pending");
        require(approvedCredits > 0, "Registry: approved credits must be > 0");

        p.status          = ProjectStatus.Approved;
        p.approvedCredits = approvedCredits;
        p.reviewedAt      = block.timestamp;
        p.mintingEnabled  = true;

        approvedForMinting[projectId] = true;

        emit ProjectApproved(projectId, msg.sender, approvedCredits, block.timestamp);
    }

    /**
     * @notice Reject a project with a reason.
     */
    function rejectProject(
        uint256 projectId,
        string calldata reason
    ) external onlyRole(VERIFIER_ROLE) nonReentrant {
        Project storage p = projects[projectId];
        require(p.id != 0, "Registry: project not found");
        require(p.status == ProjectStatus.Pending, "Registry: not pending");
        require(bytes(reason).length > 0, "Registry: reason required");

        p.status          = ProjectStatus.Rejected;
        p.reviewedAt      = block.timestamp;
        p.rejectionReason = reason;

        emit ProjectRejected(projectId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Disable minting on an approved project (admin safety measure).
     */
    function disableMinting(uint256 projectId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        projects[projectId].mintingEnabled = false;
        approvedForMinting[projectId]      = false;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function grantSellerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(SELLER_ROLE, account);
    }

    function grantVerifierRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VERIFIER_ROLE, account);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Returns all project IDs for a given seller
    function getSellerProjects(address seller) external view returns (uint256[] memory) {
        return sellerProjects[seller];
    }

    /// @notice Total number of projects ever registered
    function totalProjects() external view returns (uint256) {
        return _projectIdCounter;
    }

    /// @notice Check if a project is approved and minting is enabled
    function isApprovedForMinting(uint256 projectId) external view returns (bool) {
        return approvedForMinting[projectId];
    }

    /// @notice Get full project details
    function getProject(uint256 projectId) external view returns (Project memory) {
        require(projects[projectId].id != 0, "Registry: project not found");
        return projects[projectId];
    }

    /// @notice Get all projects (paginated)
    function getProjects(uint256 offset, uint256 limit)
        external view returns (Project[] memory result, uint256 total)
    {
        total = _projectIdCounter;
        if (offset >= total) return (new Project[](0), total);

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 len = end - offset;

        result = new Project[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = projects[offset + i + 1];
        }
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _getOwnedPendingProject(uint256 projectId)
        internal view returns (Project storage p)
    {
        p = projects[projectId];
        require(p.id != 0, "Registry: project not found");
        require(p.seller == msg.sender, "Registry: not project owner");
        require(p.status == ProjectStatus.Pending, "Registry: can only update pending project");
    }
}

// ============================================================================
// 3. MARKETPLACE
// ============================================================================

/**
 * @title Marketplace
 * @notice Peer-to-peer carbon credit marketplace.
 * @dev Sellers create listings; buyers purchase full or partial amounts using ETH.
 *      Uses approve/transferFrom pattern. ReentrancyGuard protects buy().
 */
contract Marketplace is AccessControl, ReentrancyGuard {
    // ─── Roles ────────────────────────────────────────────────────────────────
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Listing {
        uint256 listingId;
        address seller;
        uint256 projectId;
        uint256 totalAmount;       // total CCT tokens listed (wei)
        uint256 remainingAmount;   // tokens still available
        uint256 pricePerToken;     // price in wei per 1 CCT token (1e18)
        bool    active;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct SaleRecord {
        uint256 listingId;
        address buyer;
        address seller;
        uint256 amount;
        uint256 totalPaid;
        uint256 projectId;
        uint256 timestamp;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    IERC20  public immutable token;
    uint256 public           platformFeeBps;  // 100 bps = 1%
    address public           feeRecipient;

    uint256 private _listingIdCounter;

    /// @notice listingId => Listing
    mapping(uint256 => Listing) public listings;

    /// @notice seller address => array of listingIds
    mapping(address => uint256[]) public sellerListings;

    /// @notice Complete history of all sales
    SaleRecord[] public saleHistory;

    /// @notice buyer address => array of indexes into saleHistory
    mapping(address => uint256[]) public buyerPurchaseIndexes;

    // ─── Events ───────────────────────────────────────────────────────────────
    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed projectId,
        uint256 amount,
        uint256 pricePerToken,
        uint256 timestamp
    );

    event Sold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 totalPaid,
        uint256 projectId,
        uint256 timestamp
    );

    event Cancelled(
        uint256 indexed listingId,
        address indexed seller,
        uint256 remainingAmount,
        uint256 timestamp
    );

    event ListingUpdated(
        uint256 indexed listingId,
        address indexed seller,
        uint256 newPrice,
        uint256 timestamp
    );

    event FeeUpdated(uint256 oldFee, uint256 newFee, address indexed admin);

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param tokenAddress    Address of the CarbonCreditToken (CCT) contract
     * @param platformFeeBps_ Fee in basis points (100 bps = 1%); max 1000 (10%)
     * @param feeRecipient_   Address that receives platform fees
     */
    constructor(
        address tokenAddress,
        uint256 platformFeeBps_,
        address feeRecipient_
    ) {
        require(tokenAddress != address(0), "Market: zero token address");
        require(feeRecipient_ != address(0), "Market: zero fee recipient");
        require(platformFeeBps_ <= 1000, "Market: fee too high (max 10%)");

        token          = IERC20(tokenAddress);
        platformFeeBps = platformFeeBps_;
        feeRecipient   = feeRecipient_;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ─── Seller Functions ─────────────────────────────────────────────────────

    /**
     * @notice Create a new listing. Seller must have approved this contract
     *         to spend `amount` CCT tokens before calling.
     * @param amount        Number of CCT tokens to list (in wei, 1e18 = 1 credit)
     * @param pricePerToken Price in wei per 1 CCT token (1e18 units)
     * @param projectId     The registry project ID these credits belong to
     * @return listingId    The newly created listing ID
     */
    function createListing(
        uint256 amount,
        uint256 pricePerToken,
        uint256 projectId
    ) external nonReentrant returns (uint256 listingId) {
        require(amount > 0, "Market: amount must be > 0");
        require(pricePerToken > 0, "Market: price must be > 0");
        require(
            token.allowance(msg.sender, address(this)) >= amount,
            "Market: insufficient allowance"
        );
        require(token.balanceOf(msg.sender) >= amount, "Market: insufficient balance");

        // Pull tokens into escrow
        bool ok = token.transferFrom(msg.sender, address(this), amount);
        require(ok, "Market: token transfer failed");

        _listingIdCounter++;
        listingId = _listingIdCounter;

        listings[listingId] = Listing({
            listingId:       listingId,
            seller:          msg.sender,
            projectId:       projectId,
            totalAmount:     amount,
            remainingAmount: amount,
            pricePerToken:   pricePerToken,
            active:          true,
            createdAt:       block.timestamp,
            updatedAt:       block.timestamp
        });

        sellerListings[msg.sender].push(listingId);

        emit Listed(listingId, msg.sender, projectId, amount, pricePerToken, block.timestamp);
    }

    /**
     * @notice Cancel an active listing and return escrowed tokens to the seller.
     * @param listingId ID of the listing to cancel
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.listingId != 0, "Market: listing not found");
        require(l.seller == msg.sender || hasRole(ADMIN_ROLE, msg.sender), "Market: not authorized");
        require(l.active, "Market: already inactive");

        uint256 remaining = l.remainingAmount;
        l.active          = false;
        l.remainingAmount = 0;
        l.updatedAt       = block.timestamp;

        if (remaining > 0) {
            bool ok = token.transfer(l.seller, remaining);
            require(ok, "Market: refund transfer failed");
        }

        emit Cancelled(listingId, l.seller, remaining, block.timestamp);
    }

    /**
     * @notice Update the price of an active listing (seller only).
     */
    function updateListingPrice(uint256 listingId, uint256 newPrice) external {
        require(newPrice > 0, "Market: price must be > 0");
        Listing storage l = listings[listingId];
        require(l.listingId != 0, "Market: listing not found");
        require(l.seller == msg.sender, "Market: not seller");
        require(l.active, "Market: not active");

        l.pricePerToken = newPrice;
        l.updatedAt     = block.timestamp;

        emit ListingUpdated(listingId, msg.sender, newPrice, block.timestamp);
    }

    // ─── Buyer Functions ──────────────────────────────────────────────────────

    /**
     * @notice Purchase carbon credits from a listing. Supports partial purchases.
     * @dev msg.value must equal amount * pricePerToken (+ platform fee).
     *      Platform fee is deducted from the gross payment before forwarding to seller.
     * @param listingId   ID of the listing to buy from
     * @param amount      Number of CCT tokens to buy (in wei, 1e18 = 1 credit)
     */
    function buy(uint256 listingId, uint256 amount)
        external payable nonReentrant
    {
        Listing storage l = listings[listingId];
        require(l.listingId != 0, "Market: listing not found");
        require(l.active, "Market: listing not active");
        require(amount > 0, "Market: amount must be > 0");
        require(amount <= l.remainingAmount, "Market: amount exceeds available supply");
        require(l.seller != msg.sender, "Market: seller cannot buy own listing");

        // ── Payment calculation ────────────────────────────────────────────
        // pricePerToken is price for 1e18 tokens (1 whole credit)
        uint256 gross     = (amount * l.pricePerToken) / 1e18;
        uint256 fee       = (gross * platformFeeBps) / 10_000;
        uint256 sellerNet = gross - fee;

        require(msg.value >= gross, "Market: insufficient ETH sent");

        // ── State update before transfers (CEI pattern) ───────────────────
        l.remainingAmount -= amount;
        l.updatedAt        = block.timestamp;

        if (l.remainingAmount == 0) {
            l.active = false;
        }

        // ── Record sale ───────────────────────────────────────────────────
        uint256 saleIdx = saleHistory.length;
        saleHistory.push(SaleRecord({
            listingId: listingId,
            buyer:     msg.sender,
            seller:    l.seller,
            amount:    amount,
            totalPaid: gross,
            projectId: l.projectId,
            timestamp: block.timestamp
        }));
        buyerPurchaseIndexes[msg.sender].push(saleIdx);

        // ── Token transfer to buyer ───────────────────────────────────────
        bool tokOk = token.transfer(msg.sender, amount);
        require(tokOk, "Market: token transfer failed");

        // ── ETH transfers ─────────────────────────────────────────────────
        if (fee > 0) {
            (bool feeOk, ) = feeRecipient.call{value: fee}("");
            require(feeOk, "Market: fee transfer failed");
        }
        if (sellerNet > 0) {
            (bool selOk, ) = l.seller.call{value: sellerNet}("");
            require(selOk, "Market: seller payment failed");
        }

        // ── Refund overpayment ────────────────────────────────────────────
        if (msg.value > gross) {
            (bool refundOk, ) = msg.sender.call{value: msg.value - gross}("");
            require(refundOk, "Market: refund failed");
        }

        emit Sold(listingId, msg.sender, l.seller, amount, gross, l.projectId, block.timestamp);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /**
     * @notice Update the platform fee (max 10%).
     */
    function setFee(uint256 newFeeBps) external onlyRole(ADMIN_ROLE) {
        require(newFeeBps <= 1000, "Market: fee too high");
        emit FeeUpdated(platformFeeBps, newFeeBps, msg.sender);
        platformFeeBps = newFeeBps;
    }

    /**
     * @notice Update the fee recipient address.
     */
    function setFeeRecipient(address newRecipient) external onlyRole(ADMIN_ROLE) {
        require(newRecipient != address(0), "Market: zero address");
        feeRecipient = newRecipient;
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Total number of listings ever created
    function totalListings() external view returns (uint256) {
        return _listingIdCounter;
    }

    /// @notice Total number of completed sales
    function totalSales() external view returns (uint256) {
        return saleHistory.length;
    }

    /// @notice Get all listing IDs for a seller
    function getSellerListings(address seller) external view returns (uint256[] memory) {
        return sellerListings[seller];
    }

    /// @notice Get all purchase indexes for a buyer
    function getBuyerPurchases(address buyer) external view returns (uint256[] memory) {
        return buyerPurchaseIndexes[buyer];
    }

    /// @notice Get a specific sale record
    function getSale(uint256 index) external view returns (SaleRecord memory) {
        require(index < saleHistory.length, "Market: index out of bounds");
        return saleHistory[index];
    }

    /// @notice Compute the ETH cost for purchasing `amount` tokens from a listing
    /// @return gross   Total ETH required (before fee)
    /// @return fee     Platform fee portion
    /// @return net     Amount seller receives
    function quoteBuy(uint256 listingId, uint256 amount)
        external view returns (uint256 gross, uint256 fee, uint256 net)
    {
        Listing storage l = listings[listingId];
        require(l.listingId != 0, "Market: listing not found");
        gross = (amount * l.pricePerToken) / 1e18;
        fee   = (gross * platformFeeBps) / 10_000;
        net   = gross - fee;
    }

    /// @notice Get paginated listings
    function getListings(uint256 offset, uint256 limit)
        external view returns (Listing[] memory result, uint256 total)
    {
        total = _listingIdCounter;
        if (offset >= total) return (new Listing[](0), total);

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 len = end - offset;

        result = new Listing[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = listings[offset + i + 1];
        }
    }

    /// @notice Get paginated active listings only
    function getActiveListings(uint256 offset, uint256 limit)
        external view returns (Listing[] memory result, uint256 count)
    {
        // Count active listings first
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= _listingIdCounter; i++) {
            if (listings[i].active) activeCount++;
        }

        if (offset >= activeCount) return (new Listing[](0), activeCount);

        uint256 end = offset + limit;
        if (end > activeCount) end = activeCount;
        uint256 resultLen = end - offset;

        result = new Listing[](resultLen);
        uint256 idx = 0;
        uint256 skipped = 0;

        for (uint256 i = 1; i <= _listingIdCounter && idx < resultLen; i++) {
            if (listings[i].active) {
                if (skipped < offset) {
                    skipped++;
                } else {
                    result[idx++] = listings[i];
                }
            }
        }

        count = activeCount;
    }
}
