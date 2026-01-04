import dotenv from "dotenv";
dotenv.config();

import express from "express";
import checkoutRouter from "./routes/checkout.js";
import distanceRouter from "./routes/distance.js";

const app = express();

app.use(express.json());

// routes
app.use("/api/checkout", checkoutRouter);
app.use("/api/distance", distanceRouter);

// health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
