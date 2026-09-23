if (process.env.EAS_BUILD_PROFILE === "production") {
  await import("./validate-support-release.mjs");
  await import("./validate-legal-release.mjs");
} else {
  console.log("Skipping legal release validation for a non-production EAS build.");
}
