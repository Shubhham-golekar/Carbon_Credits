// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
        uint256     estimatedCredits;  // in whole CCT (1 = 1 ton)
        uint256     approvedCredits;   // set by verifier on approval
        string      ipfsDocHash;       // IPFS CID of verification documents
        ProjectStatus status;
        uint256     registeredAt;
        uint256     reviewedAt;
        string      rejectionReason;
        bool        mintingEnabled;
    }

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 private _projectIdCounter;

    /// @notice All projects indexed by ID
    mapping(uint256 => Project) public projects;

    /// @notice Project IDs owned by a seller
    mapping(address => uint256[]) public sellerProjects;

    /// @notice Quick lookup: is a (seller, projectId) combination approved for minting?
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
