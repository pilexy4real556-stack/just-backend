import express from "express";
import { calculateDistanceMiles } from "../services/delivery.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    const distanceMiles = await calculateDistanceMiles(address);

    res.json({ distanceMiles });
  } catch (err) {
    console.error("Distance route error:", err);
    res.status(500).json({ error: "Distance calculation failed" });
  }
});

export default router; // ← THIS LINE MUST EXIST