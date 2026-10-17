import { ethers } from 'ethers';

export const DEMO_PROJECTS = {
  '1': {
    id: 1n,
    seller: '0x40F7df064D6d17d00FF39056aFB183244F74dC6dc',
    name: 'Amazon Basin Native Reforestation',
    description: 'Restoring 2,500 hectares of biodiverse rainforest canopy in Acre, Brazil. Verified under VCS standard with continuous satellite monitoring.',
    location: 'Acre, Brazil',
    projectType: 0, // Forest
    estimatedCredits: 5000n,
    approvedCredits: 5000n,
    ipfsDocHash: 'QmZtmD2qt8fJpq3CLdHynn5NtTrfbwpPB26AhYndGZYgEd',
    status: 1, // Approved
    registeredAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 14),
    reviewedAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 7),
    rejectionReason: '',
    mintingEnabled: true,
  },
  '2': {
    id: 2n,
    seller: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    name: 'Thar Desert 250MW Clean Solar Array',
    description: 'Replacing fossil fuel electricity in northern India with 250MW grid-connected photovoltaic capacity, preventing 12,000 tons of CO2 yearly.',
    location: 'Rajasthan, India',
    projectType: 1, // Solar
    estimatedCredits: 12000n,
    approvedCredits: 12000n,
    ipfsDocHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
    status: 1, // Approved
    registeredAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 10),
    reviewedAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 4),
    rejectionReason: '',
    mintingEnabled: true,
  },
  '3': {
    id: 3n,
    seller: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    name: 'North Sea Deep Offshore Wind Cluster',
    description: 'Deep-water floating wind turbines powering coastal communities in Scandinavia. Displaces coal-fired generation with 100% clean kinetic energy.',
    location: 'Rogaland, Norway',
    projectType: 2, // Wind
    estimatedCredits: 8500n,
    approvedCredits: 8500n,
    ipfsDocHash: 'QmPZ9gcCEpqKTo6aq61g2nXGUhM49wbdukTiWGLZ4jEPhc',
    status: 1, // Approved
    registeredAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 8),
    reviewedAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3),
    rejectionReason: '',
    mintingEnabled: true,
  },
  '4': {
    id: 4n,
    seller: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    name: 'Himalayan Run-of-River Hydroelectric',
    description: 'Zero-flooding run-of-river micro-hydro station providing green baseload electricity to mountain towns without ecological dislocation.',
    location: 'Himachal Pradesh, India',
    projectType: 3, // Hydro
    estimatedCredits: 3500n,
    approvedCredits: 3500n,
    ipfsDocHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    status: 1, // Approved
    registeredAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 5),
    reviewedAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 2),
    rejectionReason: '',
    mintingEnabled: true,
  },
};

export const DEMO_LISTINGS = [
  {
    listingId: 1n,
    seller: '0x40F7df064D6d17d00FF39056aFB183244F74dC6dc',
    projectId: 1n,
    totalAmount: ethers.parseEther('5000'),
    remainingAmount: ethers.parseEther('4200'),
    pricePerToken: ethers.parseEther('0.0025'),
    active: true,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 4),
    updatedAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 4),
  },
  {
    listingId: 2n,
    seller: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    projectId: 2n,
    totalAmount: ethers.parseEther('12000'),
    remainingAmount: ethers.parseEther('9800'),
    pricePerToken: ethers.parseEther('0.0018'),
    active: true,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3),
    updatedAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3),
  },
  {
    listingId: 3n,
    seller: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    projectId: 3n,
    totalAmount: ethers.parseEther('8500'),
    remainingAmount: ethers.parseEther('7100'),
    pricePerToken: ethers.parseEther('0.0022'),
    active: true,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 2),
    updatedAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 2),
  },
  {
    listingId: 4n,
    seller: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    projectId: 4n,
    totalAmount: ethers.parseEther('3500'),
    remainingAmount: ethers.parseEther('2800'),
    pricePerToken: ethers.parseEther('0.0020'),
    active: true,
    createdAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 1),
    updatedAt: BigInt(Math.floor(Date.now() / 1000) - 86400 * 1),
  },
];
