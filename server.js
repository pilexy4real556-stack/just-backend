import express from "express";
import cors from "cors";

// routes
import checkoutRoutes from "./routes/checkout.js";
import distanceRoutes from "./routes/distance.js";

const app = express();

/* =========================
   ✅ CORS — FIXED
========================= */
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://justcook-liart.vercel.app"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

// VERY IMPORTANT: allow preflight
app.options("*", cors());

/* =========================
   Middleware
========================= */
app.use(express.json());

/* =========================
   Routes
========================= */
app.use("/api/checkout", checkoutRoutes);
app.use("/api/distance", distanceRoutes);

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
