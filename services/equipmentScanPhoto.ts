import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { discardPickedPhoto } from "./privateFiles";

export interface ScanPhoto { uri: string; width: number; height: number }
const temporary = new Set<string>();
export async function discardScanPhoto(uri: string) {
  temporary.delete(uri);
  await discardPickedPhoto(uri);
}
export async function cleanupEquipmentScanPhotos() {
  const files = [...temporary];
  await Promise.allSettled(files.map(discardScanPhoto));
}
export async function pickScanPhoto(source: "camera" | "library", current: () => boolean): Promise<ScanPhoto | null> {
  if (source === "camera") {
    let permission = await ImagePicker.getCameraPermissionsAsync();
    if (!current()) return null;
    if (!permission.granted && permission.canAskAgain) permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!current()) return null;
    if (!permission.granted) throw new Error("Allow camera access in device settings, or choose a photo instead.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: false, allowsMultipleSelection: false, selectionLimit: 1, quality: 1, exif: false, base64: false };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const assets = result.assets;
  for (const asset of assets) temporary.add(asset.uri);
  try {
    if (!current()) return null;
    if (assets.length !== 1 || assets[0].type === "video" || !Number.isFinite(assets[0].width) || !Number.isFinite(assets[0].height) || assets[0].width <= 0 || assets[0].height <= 0) throw new Error("Choose one still photo of a single machine.");
    const asset = assets[0];
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > 1024) context.resize(asset.width >= asset.height ? { width: 1024 } : { height: 1024 });
    const rendered = await context.renderAsync();
    const normalized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    temporary.add(normalized.uri);
    if (!current()) { await discardScanPhoto(normalized.uri); return null; }
    return { uri: normalized.uri, width: normalized.width, height: normalized.height };
  } finally {
    await Promise.allSettled(assets.map((asset) => discardScanPhoto(asset.uri)));
  }
}

export async function discardInterruptedScanPhoto(): Promise<boolean> {
  const result = await ImagePicker.getPendingResultAsync();
  if (!result || "code" in result || result.canceled) return false;
  const assets = result.assets ?? [];
  await Promise.allSettled(assets.map((asset) => discardPickedPhoto(asset.uri)));
  return assets.length > 0;
}
