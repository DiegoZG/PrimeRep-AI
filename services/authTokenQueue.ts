import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from "./tokenStorage";

let writes: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>) {
  const next = writes.catch(() => {}).then(operation);
  writes = next;
  return next;
}

export function persistSessionTokens(access: string, refresh: string, isCurrent: () => boolean) {
  return serialize(async () => {
    if (!isCurrent()) return;
    await setRefreshToken(refresh);
    if (isCurrent()) await setAccessToken(access);
  });
}

export function clearSessionTokens(isCurrent: () => boolean) {
  return serialize(async () => { if (isCurrent()) await clearTokens(); });
}

export function captureAndClearSessionTokens() {
  return serialize(async () => {
    const refresh = await getRefreshToken().catch(() => null);
    await clearTokens();
    return refresh;
  });
}

export async function waitForTokenWrites() {
  await writes.catch(() => {});
}
