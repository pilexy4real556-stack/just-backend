import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import checkoutRouter from "./routes/checkout.js";
import distanceRouter from "./routes/distance.js";

const app = express();

/* =========================
   CORS CONFIG (IMPORTANT)
   ========================= */
app.use(
  cors({
    origin: [
      "https://justcook-liart.vercel.app",
      "https://justcook-nnjsq2kne-justcooks-projects.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// IMPORTANT: handle preflight explicitly
app.options("*", cors());

app.use(express.json());

// Routes
app.use("/api/checkout", checkoutRouter);
app.use("/api/distance", distanceRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
