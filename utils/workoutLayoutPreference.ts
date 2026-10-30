import AsyncStorage from "@react-native-async-storage/async-storage";

export type WorkoutLayout = "focus" | "all";

const keyFor = (userId: string) => `@primerep/workout-layout/${encodeURIComponent(userId)}`;
const swipeHintKeyFor = (userId: string) => `${keyFor(userId)}/set-swipe-hint`;
const deletedOwners = new Set<string>();
let writeQueue: Promise<void> = Promise.resolve();

function write(action: () => Promise<void>): Promise<void> {
  const next = writeQueue.then(action, action);
  writeQueue = next.catch(() => undefined);
  return next;
}

export async function loadWorkoutLayout(userId: string): Promise<WorkoutLayout> {
  await writeQueue;
  const saved = await AsyncStorage.getItem(keyFor(userId));
  return saved === "all" ? "all" : "focus";
}

export function saveWorkoutLayout(userId: string, layout: WorkoutLayout): Promise<void> {
  return write(async () => {
    if (deletedOwners.has(userId)) throw new Error("This account was deleted.");
    await AsyncStorage.setItem(keyFor(userId), layout);
  });
}

export function clearWorkoutLayoutForUser(userId: string): Promise<void> {
  deletedOwners.add(userId);
  return write(async () => {
    await AsyncStorage.removeItem(keyFor(userId));
    await AsyncStorage.removeItem(swipeHintKeyFor(userId));
  });
}

export async function loadSetSwipeHintSeen(userId: string): Promise<boolean> {
  await writeQueue;
  return await AsyncStorage.getItem(swipeHintKeyFor(userId)) === "seen";
}

export function markSetSwipeHintSeen(userId: string): Promise<void> {
  return write(async () => {
    if (!deletedOwners.has(userId)) await AsyncStorage.setItem(swipeHintKeyFor(userId), "seen");
  });
}
