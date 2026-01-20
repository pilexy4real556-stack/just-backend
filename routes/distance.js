// routes/distance.js
import express from "express";

const router = express.Router();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const STORE_ADDRESS = process.env.STORE_ADDRESS; // e.g. "Cabot Circus, Bristol BS1 3BX, UK"

function milesFromMeters(meters) {
  return meters / 1609.344;
}

async function googleJson(url) {
  const res = await fetch(url);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, data: { raw: text } };
  }

  return { ok: res.ok, status: res.status, data };
}

router.post("/", async (req, res) => {
  try {
    const { address } = req.body ?? {};

    if (!address || typeof address !== "string" || address.trim().length < 5) {
      return res.status(400).json({ error: "Address is required" });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res
        .status(500)
        .json({ error: "GOOGLE_MAPS_API_KEY not configured" });
    }

    if (!STORE_ADDRESS) {
      return res.status(500).json({ error: "STORE_ADDRESS not configured" });
    }

    const dest = encodeURIComponent(address.trim());
    const origin = encodeURIComponent(STORE_ADDRESS.trim());

    // 1) Geocode destination (validates address)
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${dest}&key=${GOOGLE_MAPS_API_KEY}`;
    const geo = await googleJson(geoUrl);

    if (!geo.ok) {
      return res
        .status(502)
        .json({ error: "Geocode request failed", details: geo.data });
    }

    if (geo.data.status !== "OK" || !geo.data.results?.length) {
      return res
        .status(400)
        .json({ error: "Address not found", details: geo.data });
    }

    // Use formatted address for consistent results
    const formattedDest = encodeURIComponent(
      geo.data.results[0].formatted_address,
    );

    // 2) Distance Matrix
    const dmUrl =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${origin}&destinations=${formattedDest}` +
      `&mode=driving&units=imperial&key=${GOOGLE_MAPS_API_KEY}`;

    const dm = await googleJson(dmUrl);

    if (!dm.ok) {
      return res
        .status(502)
        .json({ error: "Distance Matrix request failed", details: dm.data });
    }

    if (dm.data.status !== "OK") {
      return res
        .status(400)
        .json({ error: "Distance Matrix error", details: dm.data });
    }

    const element = dm.data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK" || !element.distance?.value) {
      return res
        .status(400)
        .json({ error: "Unable to calculate distance", details: dm.data });
    }

    const miles = milesFromMeters(element.distance.value);
    const distanceMiles = Number(miles.toFixed(2));

    console.log(`[DISTANCE API] "${address}" -> ${distanceMiles} miles`);

    return res.json({
      distanceMiles,
      origin: STORE_ADDRESS,
      destination: geo.data.results[0].formatted_address,
    });
  } catch (err) {
    console.error("[DISTANCE API EXCEPTION]", err);
    return res.status(500).json({ error: "Distance service failed" });
  }
});

export default router;
