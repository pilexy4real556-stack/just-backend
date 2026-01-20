import express from "express";
import admin from "../firebase.js";

const router = express.Router();
const db = admin.firestore();

/**
 * Validate referral code BEFORE checkout
 */
router.post("/validate", async (req, res) => {
  try {
    const { code, customerId } = req.body;

    if (!code || !customerId) {
      return res.status(400).json({ valid: false });
    }

    const snap = await db
      .collection("users")
      .where("referralCode", "==", code)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({ valid: false, reason: "INVALID_CODE" });
    }

    const referrerDoc = snap.docs[0];
    const referrerData = referrerDoc.data();

    // Check if code has been used
    if (referrerData.referralCodeUsed) {
      return res.json({ valid: false, reason: "CODE_ALREADY_USED" });
    }

    // Prevent self-referral
    if (referrerDoc.id === customerId) {
      return res.status(400).json({ valid: false, reason: "SELF_REFERRAL" });
    }

    const userSnap = await db.collection("users").doc(customerId).get();

    if (userSnap.exists && userSnap.data().referredBy) {
      return res.status(400).json({ valid: false, reason: "ALREADY_REFERRED" });
    }

    return res.json({
      valid: true,
      referrerId: referrerDoc.id,
    });
  } catch (err) {
    console.error("❌ Referral validation failed:", err);
    res.status(500).json({ valid: false });
  }
});

export default router;
