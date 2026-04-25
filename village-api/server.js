const express = require("express");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
const prisma = new PrismaClient();
const router = express.Router();

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "mysecret123";

/* ✅ CORS */
app.use(cors({
  origin: [
    "http://localhost:3001",
    "https://your-vercel-app.vercel.app"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-api-secret"]
}));

app.use(express.json());

/* ✅ ROOT */
app.get("/", (req, res) => {
  res.send("Backend is LIVE 🚀");
});

/* ================= AUTH ================= */
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

/* ================= API AUTH ================= */
async function authenticate(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  const apiSecret = req.headers["x-api-secret"];

  if (!apiKey || !apiSecret) {
    return res.status(401).json({ error: "API key required" });
  }

  const key = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    include: { user: true },
  });

  if (!key) return res.status(403).json({ error: "Invalid key" });

  const valid = await bcrypt.compare(apiSecret, key.secretHash);
  if (!valid) return res.status(403).json({ error: "Invalid secret" });

  req.apiKey = key;
  next();
}

/* ================= AUTH ROUTES ================= */
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

/* ================= DATA ================= */
router.get("/states", authenticate, async (req, res) => {
  const data = await prisma.state.findMany();
  res.json({ data });
});

router.get("/districts/:stateId", authenticate, async (req, res) => {
  const data = await prisma.district.findMany({
    where: { stateId: Number(req.params.stateId) }
  });
  res.json({ data });
});

router.get("/subdistricts/:districtId", authenticate, async (req, res) => {
  const data = await prisma.subDistrict.findMany({
    where: { districtId: Number(req.params.districtId) }
  });
  res.json({ data });
});

router.get("/villages/:subDistrictId", authenticate, async (req, res) => {
  const data = await prisma.village.findMany({
    where: { subDistrictId: Number(req.params.subDistrictId) }
  });
  res.json({ data });
});

router.get("/autocomplete", authenticate, async (req, res) => {
  const { q = "" } = req.query;

  const villages = await prisma.village.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    take: 10
  });

  res.json({ data: villages });
});

app.use("/v1", router);

/* ✅ FINAL */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
