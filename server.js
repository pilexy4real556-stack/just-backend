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
      "http://localhost:3000",
      "https://justcook-liart.vercel.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Handle preflight requests
app.options("*", cors());

app.use(express.json());

// Routes
app.use("/api/checkout", checkoutRouter);
app.use("/api/distance", distanceRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
