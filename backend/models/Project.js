const mongoose = require('mongoose');

/**
 * Project metadata schema — mirrors on-chain data + extra off-chain fields
 * like additional documents, rich description, and cover image.
 */
const ProjectSchema = new mongoose.Schema({
  // On-chain reference
  projectId:     { type: Number, required: true, unique: true, index: true },
  sellerAddress: { type: String, required: true, index: true, lowercase: true },

  // Metadata
  name:          { type: String, required: true },
  description:   { type: String, default: '' },
  location:      { type: String, required: true },
  projectType:   { type: Number, enum: [0,1,2,3,4], required: true }, // 0=Forest,1=Solar,2=Wind,3=Hydro,4=Other
  estimatedCredits: { type: Number, required: true },
  ipfsDocHash:   { type: String, required: true },

  // Extra off-chain data
  coverImageUrl:  { type: String, default: '' },
  websiteUrl:     { type: String, default: '' },
  contactEmail:   { type: String, default: '' },
  additionalDocs: [{ name: String, url: String, uploadedAt: Date }],
  tags:           [String],

  // Status (mirrors on-chain for quick API queries)
  status:         { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  approvedCredits:{ type: Number, default: 0 },
  rejectionReason:{ type: String, default: '' },

  // Timestamps
  registeredAt:   { type: Date, default: Date.now },
  reviewedAt:     { type: Date },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Project', ProjectSchema);
