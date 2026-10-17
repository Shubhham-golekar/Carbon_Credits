import { ethers } from "ethers";
import { format } from "date-fns";

/**
 * Utility helpers for CarbonX frontend
 */

// ── Formatting ────────────────────────────────────────────────────────────

/** Format wei amount to a readable CCT value (e.g. "100.00 CCT") */
export function formatCCT(weiAmount, decimals = 2) {
  if (!weiAmount && weiAmount !== 0n) return "—";
  return `${Number(ethers.formatEther(weiAmount)).toFixed(decimals)} CCT`;
}

/** Format wei ETH to readable ETH string */
export function formatETH(weiAmount, decimals = 4) {
  if (!weiAmount && weiAmount !== 0n) return "—";
  return `${Number(ethers.formatEther(weiAmount)).toFixed(decimals)} ETH`;
}

/** Format basis points to percentage string */
export function formatBps(bps) {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

/** Truncate a wallet address for display */
export function truncateAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Format Unix timestamp to readable date */
export function formatDate(unixTs) {
  if (!unixTs) return "—";
  return format(new Date(Number(unixTs) * 1000), "MMM d, yyyy HH:mm");
}

/** Format Unix timestamp to short date */
export function formatDateShort(unixTs) {
  if (!unixTs) return "—";
  return format(new Date(Number(unixTs) * 1000), "MMM d, yyyy");
}

// ── Project helpers ───────────────────────────────────────────────────────

export const PROJECT_TYPE_LABELS  = ["Forest", "Solar", "Wind", "Hydro", "Other"];
export const PROJECT_TYPE_ICONS   = ["🌳", "☀️", "💨", "💧", "♻️"];
export const PROJECT_STATUS_LABELS = ["Pending", "Approved", "Rejected"];
export const PROJECT_STATUS_COLORS = {
  0: { bg: "status-pending",  text: "Pending"  },
  1: { bg: "status-approved", text: "Approved" },
  2: { bg: "status-rejected", text: "Rejected" },
};

export function getProjectTypeLabel(typeIndex) {
  return PROJECT_TYPE_LABELS[typeIndex] || "Unknown";
}

export function getProjectTypeIcon(typeIndex) {
  return PROJECT_TYPE_ICONS[typeIndex] || "♻️";
}

export function getProjectStatusInfo(statusIndex) {
  return PROJECT_STATUS_COLORS[statusIndex] || { bg: "", text: "Unknown" };
}

// ── Ethers helpers ────────────────────────────────────────────────────────

/** Parse user input (whole credits) to wei */
export function parseCredits(amount) {
  return ethers.parseEther(String(amount));
}

/** Parse ETH string to wei */
export function parseETH(amount) {
  return ethers.parseEther(String(amount));
}

/** Compute total ETH cost for buying credits at a given price */
export function computeCost(amountWei, pricePerTokenWei) {
  return (BigInt(amountWei) * BigInt(pricePerTokenWei)) / BigInt(1e18);
}

/** Build Etherscan URL for a tx hash */
export function etherscanTx(txHash, chainId) {
  const baseUrls = {
    1:        "https://etherscan.io/tx/",
    11155111: "https://sepolia.etherscan.io/tx/",
    31337:    null,
  };
  const base = baseUrls[chainId];
  return base ? `${base}${txHash}` : null;
}

/** Build Etherscan URL for an address */
export function etherscanAddr(address, chainId) {
  const baseUrls = {
    1:        "https://etherscan.io/address/",
    11155111: "https://sepolia.etherscan.io/address/",
    31337:    null,
  };
  const base = baseUrls[chainId];
  return base ? `${base}${address}` : null;
}

// ── Role keccak hashes ────────────────────────────────────────────────────

export const ROLE_HASHES = {
  DEFAULT_ADMIN: ethers.ZeroHash,
  VERIFIER:      ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE")),
  SELLER:        ethers.keccak256(ethers.toUtf8Bytes("SELLER_ROLE")),
  ADMIN:         ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE")),
};

// ── Copy to clipboard ─────────────────────────────────────────────────────
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ── Number helpers ────────────────────────────────────────────────────────
export function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ── Error formatting ──────────────────────────────────────────────────────
export function formatContractError(err, fallback = "Transaction failed") {
  if (!err) return fallback;
  const msg = err.message || "";

  if (err.code === 4001 || msg.includes("User rejected") || msg.includes("user rejected")) {
    return "Transaction was cancelled in MetaMask.";
  }
  if (msg.includes("OutOfFunds") || msg.includes("insufficient funds")) {
    return "Insufficient ETH in your wallet to cover transaction and gas fees.";
  }
  if (msg.includes("could not decode result data") || msg.includes("missing revert data")) {
    return "Contract call failed: Contract is not deployed on this network, or gas estimation failed.";
  }
  if (err.reason) {
    return err.reason;
  }
  if (msg.length > 0 && msg.length < 120) {
    return msg;
  }
  return fallback;
}
