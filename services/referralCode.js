// services/referralCode.js
export function generateReferralCode() {
  const prefix = "JC";
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${random}`;
}
