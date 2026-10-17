// Contract ABIs — auto-generated from Hardhat artifacts after compilation
// Update contract addresses in .env after deployment

export const CCT_ABI = [
  // ERC-20
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  // Custom
  "function mint(address seller, uint256 amount, uint256 projectId) external",
  "function retire(uint256 amount, uint256 projectId, string reason) external",
  "function registerSeller(address seller) external",
  "function revokeSeller(address seller) external",
  "function totalIssued() view returns (uint256)",
  "function totalRetired() view returns (uint256)",
  "function issuedByProject(uint256) view returns (uint256)",
  "function retiredByAddress(address) view returns (uint256)",
  "function retirementCount() view returns (uint256)",
  "function getRetirement(uint256 index) view returns (tuple(address retiree, uint256 amount, uint256 projectId, string reason, uint256 timestamp, bytes32 txHash))",
  "function getRoles(address account) view returns (bool isAdmin, bool isVerifier, bool isSeller)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account) external",
  // Events
  "event CreditsMinted(address indexed seller, uint256 amount, uint256 indexed projectId, address indexed verifier, uint256 timestamp)",
  "event Retired(address indexed retiree, uint256 amount, uint256 indexed projectId, string reason, uint256 retirementIndex, uint256 timestamp)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

export const REGISTRY_ABI = [
  "function registerProject(string name, string description, string location, uint8 projectType, uint256 estimatedCredits, string ipfsDocHash) external returns (uint256)",
  "function updateProject(uint256 projectId, string description, string ipfsDocHash, uint256 estimatedCredits) external",
  "function approveProject(uint256 projectId, uint256 approvedCredits) external",
  "function rejectProject(uint256 projectId, string reason) external",
  "function disableMinting(uint256 projectId) external",
  "function grantSellerRole(address account) external",
  "function grantVerifierRole(address account) external",
  "function getSellerProjects(address seller) view returns (uint256[])",
  "function totalProjects() view returns (uint256)",
  "function isApprovedForMinting(uint256 projectId) view returns (bool)",
  "function getProject(uint256 projectId) view returns (tuple(uint256 id, address seller, string name, string description, string location, uint8 projectType, uint256 estimatedCredits, uint256 approvedCredits, string ipfsDocHash, uint8 status, uint256 registeredAt, uint256 reviewedAt, string rejectionReason, bool mintingEnabled))",
  "function getProjects(uint256 offset, uint256 limit) view returns (tuple(uint256 id, address seller, string name, string description, string location, uint8 projectType, uint256 estimatedCredits, uint256 approvedCredits, string ipfsDocHash, uint8 status, uint256 registeredAt, uint256 reviewedAt, string rejectionReason, bool mintingEnabled)[], uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  // Events
  "event ProjectRegistered(uint256 indexed projectId, address indexed seller, string name, uint8 projectType, uint256 timestamp)",
  "event ProjectApproved(uint256 indexed projectId, address indexed verifier, uint256 approvedCredits, uint256 timestamp)",
  "event ProjectRejected(uint256 indexed projectId, address indexed verifier, string reason, uint256 timestamp)",
];

export const MARKETPLACE_ABI = [
  "function createListing(uint256 amount, uint256 pricePerToken, uint256 projectId) external returns (uint256)",
  "function cancelListing(uint256 listingId) external",
  "function updateListingPrice(uint256 listingId, uint256 newPrice) external",
  "function buy(uint256 listingId, uint256 amount) payable external",
  "function setFee(uint256 newFeeBps) external",
  "function setFeeRecipient(address newRecipient) external",
  "function token() view returns (address)",
  "function platformFeeBps() view returns (uint256)",
  "function feeRecipient() view returns (address)",
  "function totalListings() view returns (uint256)",
  "function totalSales() view returns (uint256)",
  "function listings(uint256) view returns (tuple(uint256 listingId, address seller, uint256 projectId, uint256 totalAmount, uint256 remainingAmount, uint256 pricePerToken, bool active, uint256 createdAt, uint256 updatedAt))",
  "function getSellerListings(address seller) view returns (uint256[])",
  "function getBuyerPurchases(address buyer) view returns (uint256[])",
  "function getSale(uint256 index) view returns (tuple(uint256 listingId, address buyer, address seller, uint256 amount, uint256 totalPaid, uint256 projectId, uint256 timestamp))",
  "function quoteBuy(uint256 listingId, uint256 amount) view returns (uint256 gross, uint256 fee, uint256 net)",
  "function getListings(uint256 offset, uint256 limit) view returns (tuple(uint256 listingId, address seller, uint256 projectId, uint256 totalAmount, uint256 remainingAmount, uint256 pricePerToken, bool active, uint256 createdAt, uint256 updatedAt)[], uint256)",
  "function getActiveListings(uint256 offset, uint256 limit) view returns (tuple(uint256 listingId, address seller, uint256 projectId, uint256 totalAmount, uint256 remainingAmount, uint256 pricePerToken, bool active, uint256 createdAt, uint256 updatedAt)[], uint256)",
  // Events
  "event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed projectId, uint256 amount, uint256 pricePerToken, uint256 timestamp)",
  "event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 amount, uint256 totalPaid, uint256 projectId, uint256 timestamp)",
  "event Cancelled(uint256 indexed listingId, address indexed seller, uint256 remainingAmount, uint256 timestamp)",
  "event ListingUpdated(uint256 indexed listingId, address indexed seller, uint256 newPrice, uint256 timestamp)",
];

export const CONTRACT_ADDRESSES = {
  CCT:         import.meta.env.VITE_CONTRACT_CCT         || "",
  MARKETPLACE: import.meta.env.VITE_CONTRACT_MARKETPLACE || "",
  REGISTRY:    import.meta.env.VITE_CONTRACT_REGISTRY    || "",
};

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID) || 31337;

export const ROLES = {
  DEFAULT_ADMIN: "0x0000000000000000000000000000000000000000000000000000000000000000",
  VERIFIER:      "0x" + Array.from(new Uint8Array(32)).map((_,i) => i).reduce(() => ""), // computed at runtime
  SELLER:        "",
};

export const PROJECT_TYPES = ["Forest", "Solar", "Wind", "Hydro", "Other"];
export const PROJECT_STATUS = ["Pending", "Approved", "Rejected"];
