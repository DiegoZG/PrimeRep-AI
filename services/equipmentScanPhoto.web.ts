export interface ScanPhoto { uri: string; width: number; height: number }
export async function discardScanPhoto(_uri: string) {}
export async function cleanupEquipmentScanPhotos() {}
export async function pickScanPhoto(_source: "camera" | "library", _current: () => boolean): Promise<ScanPhoto | null> {
  throw new Error("Photo identification is available in the mobile app. Search for equipment below.");
}

export async function discardInterruptedScanPhoto() { return false; }
