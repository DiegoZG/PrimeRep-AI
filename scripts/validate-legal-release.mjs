import fs from "node:fs";

const release = JSON.parse(fs.readFileSync(new URL("../constants/legal-release.json", import.meta.url), "utf8"));
const legal = fs.readFileSync(new URL("../constants/legal.ts", import.meta.url), "utf8");
if (release.status !== "approved") {
  console.error("Release blocked: Terms and Privacy copy still requires legal approval.");
  process.exit(1);
}
if (!release.termsVersion || !release.privacyVersion || !release.lastUpdated) {
  console.error("Release blocked: legal release metadata is incomplete.");
  process.exit(1);
}
if (/\b(TODO|PLACEHOLDER|example\.com)\b/i.test(legal)) {
  console.error("Release blocked: legal copy contains a placeholder.");
  process.exit(1);
}
const contactEmail = process.env.EXPO_PUBLIC_LEGAL_EMAIL?.trim();
if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
  console.error("Release blocked: EXPO_PUBLIC_LEGAL_EMAIL must be a valid monitored address.");
  process.exit(1);
}
console.log("Legal release validation passed.");
