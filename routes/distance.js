import express from "express";
import fetch from "node-fetch";

const router = express.Router();

const SHOP_ADDRESS = process.env.SHOP_ADDRESS;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

router.post("/", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    if (!SHOP_ADDRESS || !GOOGLE_API_KEY) {
      return res.status(500).json({ error: "Server configuration missing" });
    }

    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${encodeURIComponent(SHOP_ADDRESS)}` +
      `&destinations=${encodeURIComponent(address)}` +
      `&units=imperial` +
      `&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    const element = data.rows?.[0]?.elements?.[0];

    if (!element || element.status !== "OK") {
      return res.status(400).json({ error: "Unable to calculate distance" });
    }

    const meters = element.distance.value;
    const miles = meters / 1609.34;

    res.json({ distanceMiles: miles });
  } catch (err) {
    console.error("Distance calculation error:", err);
    res.status(500).json({ error: "Distance calculation failed" });
  }
});

export default router;
