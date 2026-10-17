import { ethers } from 'ethers';
import { DEMO_PROJECTS, DEMO_LISTINGS } from './demoData';

const STORAGE_KEYS = {
  PROJECTS: 'carbonx_custom_projects',
  LISTINGS: 'carbonx_custom_listings',
  PURCHASES: 'carbonx_custom_purchases',
};

function triggerUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('carbonx_storage_update'));
  }
}

// ── Projects ──────────────────────────────────────────────────────────────
export function getStoredProjects() {
  const custom = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '{}');
  const parsedCustom = {};
  for (const [key, val] of Object.entries(custom)) {
    parsedCustom[key] = {
      ...val,
      id: BigInt(val.id),
      estimatedCredits: BigInt(val.estimatedCredits),
      approvedCredits: BigInt(val.approvedCredits),
      registeredAt: BigInt(val.registeredAt),
      reviewedAt: BigInt(val.reviewedAt),
    };
  }
  return { ...DEMO_PROJECTS, ...parsedCustom };
}

export function addStoredProject(projectData, sellerAddress) {
  const existing = getStoredProjects();
  const nextId = (Object.keys(existing).length + 1).toString();

  const newProject = {
    id: BigInt(nextId),
    seller: sellerAddress || '0x40F7df064D6d17d00FF39056aFB183244F74dC6dc',
    name: projectData.name,
    description: projectData.description,
    location: projectData.location,
    projectType: Number(projectData.projectType || 0),
    estimatedCredits: BigInt(projectData.estimatedCredits || 1000),
    approvedCredits: BigInt(projectData.estimatedCredits || 1000),
    ipfsDocHash: projectData.ipfsDocHash || 'QmDemoHash1234567890abcdef',
    status: 1, // Auto-approved for seamless demo flow
    registeredAt: BigInt(Math.floor(Date.now() / 1000)),
    reviewedAt: BigInt(Math.floor(Date.now() / 1000)),
    rejectionReason: '',
    mintingEnabled: true,
  };

  const custom = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '{}');
  custom[nextId] = newProject;
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(custom, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));

  // Automatically add an initial listing for this newly registered project on the marketplace!
  const price = projectData.pricePerToken ? ethers.parseEther(projectData.pricePerToken.toString()) : ethers.parseEther('0.0020');
  addStoredListing({
    projectId: BigInt(nextId),
    seller: newProject.seller,
    totalAmount: ethers.parseEther(projectData.estimatedCredits.toString()),
    remainingAmount: ethers.parseEther(projectData.estimatedCredits.toString()),
    pricePerToken: price,
  });

  triggerUpdate();
  return newProject;
}

// ── Listings ──────────────────────────────────────────────────────────────
export function getStoredListings() {
  const custom = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTINGS) || '[]');
  const parsedCustom = custom.map(l => ({
    ...l,
    listingId: BigInt(l.listingId),
    projectId: BigInt(l.projectId),
    totalAmount: BigInt(l.totalAmount),
    remainingAmount: BigInt(l.remainingAmount),
    pricePerToken: BigInt(l.pricePerToken),
    createdAt: BigInt(l.createdAt),
    updatedAt: BigInt(l.updatedAt),
  }));

  // Filter out any demo listing that might have been locally modified
  const demoList = DEMO_LISTINGS.filter(
    dl => !parsedCustom.some(cl => cl.listingId.toString() === dl.listingId.toString())
  );

  return [...parsedCustom, ...demoList].filter(l => l.active !== false && l.remainingAmount > 0n);
}

export function addStoredListing(listingData) {
  const custom = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTINGS) || '[]');
  const nextId = BigInt(Date.now());

  const newListing = {
    listingId: nextId,
    seller: listingData.seller || '0x40F7df064D6d17d00FF39056aFB183244F74dC6dc',
    projectId: BigInt(listingData.projectId),
    totalAmount: listingData.totalAmount,
    remainingAmount: listingData.remainingAmount,
    pricePerToken: listingData.pricePerToken,
    active: true,
    createdAt: BigInt(Math.floor(Date.now() / 1000)),
    updatedAt: BigInt(Math.floor(Date.now() / 1000)),
  };

  custom.unshift(newListing);
  localStorage.setItem(STORAGE_KEYS.LISTINGS, JSON.stringify(custom, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
  triggerUpdate();
  return newListing;
}

export function updateStoredListing(listingId, amountBoughtWei) {
  const custom = JSON.parse(localStorage.getItem(STORAGE_KEYS.LISTINGS) || '[]');
  const targetIdStr = listingId.toString();
  let found = false;

  for (let i = 0; i < custom.length; i++) {
    if (custom[i].listingId.toString() === targetIdStr) {
      found = true;
      const cur = BigInt(custom[i].remainingAmount);
      const updated = cur > amountBoughtWei ? cur - amountBoughtWei : 0n;
      custom[i].remainingAmount = updated.toString();
      if (updated === 0n) {
        custom[i].active = false;
      }
      break;
    }
  }

  // If not found in custom, create an override entry for the demo listing
  if (!found) {
    const demo = DEMO_LISTINGS.find(d => d.listingId.toString() === targetIdStr);
    if (demo) {
      const cur = demo.remainingAmount;
      const updated = cur > amountBoughtWei ? cur - amountBoughtWei : 0n;
      custom.push({
        listingId: demo.listingId.toString(),
        seller: demo.seller,
        projectId: demo.projectId.toString(),
        totalAmount: demo.totalAmount.toString(),
        remainingAmount: updated.toString(),
        pricePerToken: demo.pricePerToken.toString(),
        active: updated > 0n,
        createdAt: demo.createdAt.toString(),
        updatedAt: Math.floor(Date.now() / 1000).toString(),
      });
    }
  }

  localStorage.setItem(STORAGE_KEYS.LISTINGS, JSON.stringify(custom));
  triggerUpdate();
}

// ── Purchases (Connects Buyer -> Seller) ──────────────────────────────────
export function recordPurchase({ listingId, projectId, amountWei, grossEthWei, buyerAddress }) {
  const custom = JSON.parse(localStorage.getItem(STORAGE_KEYS.PURCHASES) || '[]');
  const record = {
    saleId: Date.now().toString(),
    listingId: listingId.toString(),
    projectId: projectId.toString(),
    buyer: buyerAddress || '0xDemoBuyer',
    amount: amountWei.toString(),
    totalPaid: grossEthWei.toString(),
    timestamp: Math.floor(Date.now() / 1000),
  };
  custom.unshift(record);
  localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(custom));
  updateStoredListing(listingId, amountWei);
  triggerUpdate();
  return record;
}

export function getPurchases() {
  const custom = JSON.parse(localStorage.getItem(STORAGE_KEYS.PURCHASES) || '[]');
  return custom.map(p => ({
    saleId: BigInt(p.saleId || Date.now()),
    listingId: BigInt(p.listingId),
    projectId: BigInt(p.projectId),
    buyer: p.buyer,
    amount: BigInt(p.amount),
    totalPaid: BigInt(p.totalPaid),
    timestamp: BigInt(p.timestamp),
  }));
}
