import AsyncStorage from "@react-native-async-storage/async-storage";

export type PendingPurchase = { phase: "received" | "pending"; productId: string | null };
const keyFor = (userId: string) => `@primerep/pending-purchase/${encodeURIComponent(userId)}`;
const deletedOwners = new Set<string>();
let writes: Promise<unknown> = Promise.resolve();

function write(action: () => Promise<unknown>): Promise<void> {
  const next = writes.then(action, action).then(() => undefined);
  writes = next.catch(() => undefined);
  return next;
}

export async function loadPendingPurchase(userId: string): Promise<PendingPurchase | null> {
  await writes;
  if (deletedOwners.has(userId)) return null;
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if ((value.phase !== "received" && value.phase !== "pending") || (value.productId != null && typeof value.productId !== "string")) throw new Error("Purchase recovery information is unavailable.");
  return value;
}

export function savePendingPurchase(userId: string, pending: PendingPurchase | null) {
  return write(async () => {
    if (deletedOwners.has(userId)) return;
    if (pending) await AsyncStorage.setItem(keyFor(userId), JSON.stringify(pending));
    else await AsyncStorage.removeItem(keyFor(userId));
  });
}

export function clearPendingPurchaseForUser(userId: string) {
  deletedOwners.add(userId);
  return write(() => AsyncStorage.removeItem(keyFor(userId)));
}
