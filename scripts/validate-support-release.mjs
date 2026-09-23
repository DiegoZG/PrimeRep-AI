const email = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "").trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /\.(example|invalid|test)$/i.test(email)) {
  console.error("Release blocked: configure EXPO_PUBLIC_SUPPORT_EMAIL with a monitored support address.");
  process.exitCode = 1;
}
