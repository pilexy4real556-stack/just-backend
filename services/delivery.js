import fetch from "node-fetch";

router.post("/distance", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || address.length < 5) {
      return res.status(400).json({ error: "Invalid address" });
    }

    const origin = encodeURIComponent("YOUR SHOP ADDRESS HERE");
    const destination = encodeURIComponent(address);

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${origin}&destinations=${destination}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || data.rows[0].elements[0].status !== "OK") {
      console.error("[GOOGLE MAPS ERROR]", data);
      return res.status(500).json({ error: "Distance lookup failed" });
    }

    const meters = data.rows[0].elements[0].distance.value;
    const miles = meters / 1609.34;

    console.log(`[DISTANCE API] ${address} → ${miles.toFixed(2)} miles`);

    res.json({ distanceMiles: miles });
  } catch (err) {
    console.error("[DISTANCE API EXCEPTION]", err);
    res.status(500).json({ error: "Distance calculation error" });
  }
});
