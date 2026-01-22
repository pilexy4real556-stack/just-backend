import "dotenv/config";
import "./firebase.js";
import express from "express";
import cors from "cors";

// routes
import checkoutRoutes from "./routes/checkout.js";
import customerRoutes from "./routes/customer.js";
import webhookHandler from "./routes/webhook.js";
import referralRoutes from "./routes/referral.js";
import distanceRoutes from "./routes/distance.js";

console.log("✅ referralRoutes loaded:", referralRoutes);

const app = express();

/* =========================
   ✅ CORS — FIXED
========================= */
const allowedExact = new Set([
  "http://localhost:3000",
  "https://justcook-liart.vercel.app",
]);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow non-browser tools (Postman) and same-origin
      if (!origin) return cb(null, true);

      const isVercelPreview = origin.endsWith(".vercel.app");
      const isAllowed = allowedExact.has(origin) || isVercelPreview;

      if (isAllowed) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  }),
);

// preflight
app.options("*", cors());

/* =========================
   Stripe Webhook — RAW body ONLY
========================= */
app.post(
  "/api/webhook/stripe",
  express.raw({ type: "application/json" }),
  webhookHandler,
);

/* =========================
   Middleware
========================= */
app.use(express.json());

/* =========================
   Normal API Routes
========================= */
app.use("/api", customerRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/distance", distanceRoutes);
app.use("/api/referral", referralRoutes);

/* =========================
   Health check (optional)
========================= */
app.get("/", (req, res) => {
  res.send("JustCook backend running");
});

/* =========================
   Start server
========================= */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
