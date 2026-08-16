import { requestJson } from "./httpClient";

export interface EquipmentWeights {
  dumbbellWeights: number[];
  plateWeights: number[];
}

export function getEquipmentWeights(token: string) {
  return requestJson<EquipmentWeights>("/v1/users/me/equipment-weights", {
    method: "GET",
    token,
  });
}

export function replaceEquipmentWeights(
  token: string,
  weights: EquipmentWeights
) {
  return requestJson<EquipmentWeights>("/v1/users/me/equipment-weights", {
    method: "PUT",
    token,
    body: weights,
  });
}
