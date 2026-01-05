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
const allowedOrigins = [
  "http://localhost:3000",
  "https://justcook-nnjsq2kne-justcooks-projects.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server or same-origin requests
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
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
