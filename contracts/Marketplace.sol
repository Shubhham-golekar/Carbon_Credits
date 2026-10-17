// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
        uint256 amount;         // CCT tokens transferred (wei)
        uint256 totalPaid;      // ETH paid (wei)
        uint256 projectId;
        uint256 timestamp;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    IERC20 public immutable token;          // CarbonCreditToken contract
    uint256 public platformFeeBps;           // basis points (e.g. 250 = 2.5%)
    address public feeRecipient;

    uint256 private _listingIdCounter;

    mapping(uint256 => Listing) public listings;
    SaleRecord[] public saleHistory;

    /// @notice All listing IDs ever created by a seller
    mapping(address => uint256[]) public sellerListings;

    /// @notice All purchases made by a buyer
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
