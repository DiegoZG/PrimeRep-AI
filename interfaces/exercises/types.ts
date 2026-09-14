// API response types (backend schema)
export interface ExerciseApiItem {
  id: string;
  name: string;
  exercise_type: string;
  primary_muscle: string;
  secondary_muscles?: string[];
  required_equipment_ids?: string[];
  image_url?: string | null;
  demo_video_url?: string | null;
  is_active?: boolean;
  is_favorited?: boolean;
  source?: "seed" | "custom" | "user";
  is_editable?: boolean;
  exerciseType?: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  imageUrl?: string | null;
  demoVideoUrl?: string | null;
  equipmentIds?: string[];
  requiredEquipmentIds?: string[];
  isFavorited?: boolean;
  isEditable?: boolean;
}

export interface ExerciseApiResponse {
  items: ExerciseApiItem[];
}

// API response for single exercise detail (snake_case from backend, matching list endpoint)
export interface ExerciseDetailApiResponse {
  id: number | string;
  name: string;
  exercise_type: string;
  primary_muscle: string;
  secondary_muscles?: string[];
  image_url?: string | null;
  demo_video_url?: string | null;
  is_active?: boolean;
  is_favorited?: boolean;
  source?: string;
  is_editable?: boolean;
  owner_user_id?: string | null;
  sort_order?: number;
  // `required_equipment_ids` is the current field name; `equipment_ids` is kept
  // as a fallback for backwards compatibility with older backend responses.
  required_equipment_ids?: string[];
  equipment_ids?: string[];
  how_to?: string | null;
  why_it_works?: string | null;
  common_mistakes?: string | null;
  beginner_notes?: string | null;
  exerciseType?: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  imageUrl?: string | null;
  demoVideoUrl?: string | null;
  equipmentIds?: string[];
  requiredEquipmentIds?: string[];
  instructions?: string | null;
  isFavorited?: boolean;
  isEditable?: boolean;
}

// UI model (basic, used in lists)
export interface Exercise {
  id: string;
  name: string;
  exerciseType: string;
  primaryMuscle: string;
  imageUrl?: string;
  isFavorited: boolean;
  secondaryMuscles?: string[];
  equipmentIds?: string[];
  source?: "seed" | "custom";
  isEditable?: boolean;
}

// UI model (detailed, used in exercise detail screen)
export interface ExerciseDetail {
  id: string;
  name: string;
  exerciseType: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  imageUrl?: string;
  demoVideoUrl?: string;
  equipmentIds: string[];
  howTo?: string;
  whyItWorks?: string;
  commonMistakes?: string;
  beginnerNotes?: string;
  isFavorited: boolean;
  source?: "seed" | "custom";
  isEditable?: boolean;
  instructions?: string;
}

// Query parameters for getExercises
export interface GetExercisesParams {
  q?: string;
  muscle?: string;
  equipmentId?: string;
  type?: string;
  limit?: number;
  offset?: number;
}
