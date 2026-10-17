// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
