const express = require("express");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
const prisma = new PrismaClient();
const router = express.Router();

/* ===============================
   🔥 PORT FIX (CRITICAL FOR RENDER)
================================ */
const PORT = process.env.PORT || 3000;

/* ===============================
   🔥 CORS (ALLOW FRONTEND)
================================ */
app.use(cors({
  origin: [
    "http://localhost:3001",
    "https://your-vercel-app.vercel.app" // update after deploy
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-api-secret"]
}));

app.use(express.json());

/* ===============================
   🔥 ROOT ROUTE (IMPORTANT FOR TEST)
================================ */
app.get("/", (req, res) => {
  res.send("Backend is LIVE 🚀");
});

/* ===============================
   🔐 SECRET (USE ENV IN PROD)
================================ */
const SECRET = process.env.JWT_SECRET || "mysecret123";

/* ===============================
   ✅ STANDARD RESPONSE
================================ */
function sendResponse(res, data, start) {
  const responseTime = Date.now() - start;

  res.json({
    success: true,
    count: Array.isArray(data) ? data.length : 1,
    data,
    meta: { responseTime }
  });
}

/* ===============================
   🔐 JWT AUTH
================================ */
function requireLogin(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) return res.status(401).json({ error: "Login required" });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

/* ===============================
   🔐 LIMIT LOGIC
================================ */
async function checkUsageLimit(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await prisma.apiLog.count({
    where: {
      userId,
      createdAt: { gte: today },
    },
  });
}

function getLimitByPlan(planType) {
  if (planType === "free") return 100;
  if (planType === "premium") return 10000;
  if (planType === "pro") return Infinity;
  return 100;
}

/* ===============================
   🔐 API KEY AUTH
================================ */
async function authenticate(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  const apiSecret = req.headers["x-api-secret"];

  if (!apiKey || !apiSecret) {
    return res.status(401).json({ error: "API key and secret required" });
  }

  const key = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    include: { user: true },
  });

  if (!key) return res.status(403).json({ error: "Invalid API key" });

  const valid = await bcrypt.compare(apiSecret, key.secretHash);
  if (!valid) return res.status(403).json({ error: "Invalid API secret" });

  const usage = await checkUsageLimit(key.userId);
  const limit = getLimitByPlan(key.user.planType);

  res.set({
    "X-RateLimit-Limit": limit,
    "X-RateLimit-Remaining": limit === Infinity ? "∞" : limit - usage
  });

  if (usage >= limit) {
    return res.status(429).json({
      error: `Daily limit exceeded (${key.user.planType})`,
    });
  }

  req.apiKey = key;
  next();
}

/* ===============================
   🔐 AUTH ROUTES
================================ */
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, password: hashed, planType: "free" }
  });

  res.json(user);
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign({ userId: user.id }, SECRET);

  res.json({ token });
});

/* ===============================
   🔑 GENERATE KEY
================================ */
app.post("/generate-key", requireLogin, async (req, res) => {
  const apiKey = crypto.randomBytes(16).toString("hex");
  const apiSecret = crypto.randomBytes(32).toString("hex");

  const hash = await bcrypt.hash(apiSecret, 10);

  await prisma.apiKey.create({
    data: {
      key: apiKey,
      secretHash: hash,
      userId: req.user.userId
    }
  });

  res.json({ apiKey, apiSecret });
});

/* ===============================
   🌍 LOCATION APIs
================================ */
router.get("/states", authenticate, async (req, res) => {
  const start = Date.now();
  const data = await prisma.state.findMany();
  sendResponse(res, data, start);
});

router.get("/districts/:stateId", authenticate, async (req, res) => {
  const start = Date.now();
  const data = await prisma.district.findMany({
    where: { stateId: Number(req.params.stateId) }
  });
  sendResponse(res, data, start);
});

router.get("/subdistricts/:districtId", authenticate, async (req, res) => {
  const start = Date.now();
  const data = await prisma.subDistrict.findMany({
    where: { districtId: Number(req.params.districtId) }
  });
  sendResponse(res, data, start);
});

router.get("/villages/:subDistrictId", authenticate, async (req, res) => {
  const start = Date.now();
  const data = await prisma.village.findMany({
    where: { subDistrictId: Number(req.params.subDistrictId) },
    take: 50
  });
  sendResponse(res, data, start);
});

/* ===============================
   🔍 SEARCH
================================ */
router.get("/search", authenticate, async (req, res) => {
  const start = Date.now();
  let { q = "", limit = 20 } = req.query;

  if (q.length < 2) {
    return res.status(400).json({ error: "Query too short" });
  }

  const data = await prisma.village.findMany({
    where: {
      name: { contains: q, mode: "insensitive" }
    },
    take: Number(limit)
  });

  sendResponse(res, data, start);
});

/* ===============================
   ⚡ AUTOCOMPLETE
================================ */
router.get("/autocomplete", authenticate, async (req, res) => {
  const start = Date.now();
  const { q = "" } = req.query;

  if (q.length < 2) {
    return res.status(400).json({ error: "Query too short" });
  }

  const villages = await prisma.village.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    include: {
      subDistrict: {
        include: {
          district: {
            include: { state: true }
          }
        }
      }
    },
    take: 10
  });

  const data = villages.map(v => ({
    value: v.id,
    label: v.name,
    fullAddress: `${v.name}, ${v.subDistrict.name}, ${v.subDistrict.district.name}, ${v.subDistrict.district.state.name}, India`
  }));

  sendResponse(res, data, start);
});

/* ===============================
   VERSIONING
================================ */
app.use("/v1", router);

/* ===============================
   🔥 FINAL SERVER FIX
================================ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
