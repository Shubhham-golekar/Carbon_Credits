require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');

const Project   = require('./models/Project');

// ── App Setup ─────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── File Upload (Multer) ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// ── MongoDB ────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/carbonx')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err.message));

// ── Routes ─────────────────────────────────────────────────────

/**
 * GET /api/health
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * GET /api/projects
 * List all projects (optionally filter by status, seller, type)
 */
app.get('/api/projects', async (req, res) => {
  try {
    const { status, seller, type, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (seller) filter.sellerAddress = seller.toLowerCase();
    if (type !== undefined) filter.projectType = Number(type);

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Project.countDocuments(filter);
    const docs  = await Project.find(filter).skip(skip).limit(Number(limit)).sort({ registeredAt: -1 });

    res.json({ projects: docs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/projects/:projectId
 * Get a single project by on-chain ID
 */
app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const doc = await Project.findOne({ projectId: Number(req.params.projectId) });
    if (!doc) return res.status(404).json({ error: 'Project not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects
 * Create project metadata (called after on-chain registration)
 * Body: { projectId, sellerAddress, name, description, location,
 *         projectType, estimatedCredits, ipfsDocHash, websiteUrl,
 *         contactEmail, tags }
 */
app.post('/api/projects', async (req, res) => {
  try {
    const {
      projectId, sellerAddress, name, description, location,
      projectType, estimatedCredits, ipfsDocHash,
      websiteUrl = '', contactEmail = '', tags = [],
    } = req.body;

    if (!projectId || !sellerAddress || !name || !location || !ipfsDocHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prevent duplicate
    const existing = await Project.findOne({ projectId: Number(projectId) });
    if (existing) return res.status(409).json({ error: 'Project already exists' });

    const doc = await Project.create({
      projectId: Number(projectId),
      sellerAddress: sellerAddress.toLowerCase(),
      name, description, location,
      projectType: Number(projectType),
      estimatedCredits: Number(estimatedCredits),
      ipfsDocHash, websiteUrl, contactEmail, tags,
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/projects/:projectId
 * Update off-chain project metadata (seller only — no on-chain auth here)
 */
app.patch('/api/projects/:projectId', async (req, res) => {
  try {
    const allowed = ['description', 'coverImageUrl', 'websiteUrl', 'contactEmail', 'tags'];
    const update  = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const doc = await Project.findOneAndUpdate(
      { projectId: Number(req.params.projectId) },
      update,
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/projects/:projectId/status
 * Update status (called from admin verifier workflow — should be secured)
 */
app.patch('/api/projects/:projectId/status', async (req, res) => {
  try {
    const { status, approvedCredits, rejectionReason } = req.body;
    const update = { status, reviewedAt: new Date() };
    if (approvedCredits) update.approvedCredits = approvedCredits;
    if (rejectionReason) update.rejectionReason = rejectionReason;

    const doc = await Project.findOneAndUpdate(
      { projectId: Number(req.params.projectId) },
      update, { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/projects/:projectId/upload
 * Upload additional documents for a project
 */
app.post('/api/projects/:projectId/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const doc = await Project.findOneAndUpdate(
      { projectId: Number(req.params.projectId) },
      { $push: { additionalDocs: { name: req.file.originalname, url: fileUrl, uploadedAt: new Date() } } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Project not found' });
    res.json({ url: fileUrl, project: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/stats
 * Platform-wide statistics from MongoDB
 */
app.get('/api/stats', async (req, res) => {
  try {
    const [total, pending, approved, rejected] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: 'pending' }),
      Project.countDocuments({ status: 'approved' }),
      Project.countDocuments({ status: 'rejected' }),
    ]);
    res.json({ total, pending, approved, rejected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌱 CarbonX Backend running on http://localhost:${PORT}`);
});
