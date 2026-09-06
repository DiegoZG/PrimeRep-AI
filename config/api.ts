const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
const developmentFallback = "http://192.168.86.30:8000";

if (!configuredApiUrl && !__DEV__) {
  throw new Error("EXPO_PUBLIC_API_URL must be set for production builds");
}

export const API_BASE_URL = configuredApiUrl ?? developmentFallback;
