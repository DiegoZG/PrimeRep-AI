export interface ExerciseLoadProfile {
  basis: "per_implement" | "total" | "machine" | "bodyweight" | "added" | "assistance";
  implement_count: 1 | 2;
}

export interface ExerciseContent {
  steps: string[];
  cues: string[];
  mistakes: string[];
  benefits: string;
  beginner_guidance: string;
}

export interface ExerciseVideo {
  id: string;
  url: string;
  mime_type: string;
  poster_url?: string | null;
}

export interface CatalogPagination {
  limit: number;
  offset: number;
  total?: number;
  has_more: boolean;
}

interface PublishedExerciseFields {
  tracking_mode?: "reps" | "duration" | "distance" | null;
  content_version?: string | null;
  movement_pattern?: string | null;
  resistance_modality?: string | null;
  difficulty?: string | null;
  laterality?: string | null;
  load_profile?: ExerciseLoadProfile | null;
  structured_content?: ExerciseContent | null;
  media?: ExerciseVideo | null;
}

// API response types (backend schema)
export interface ExerciseApiItem extends PublishedExerciseFields {
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
  limit?: number;
  offset?: number;
  total?: number;
  has_more?: boolean;
  catalog_version?: string;
}

// API response for single exercise detail (snake_case from backend, matching list endpoint)
export interface ExerciseDetailApiResponse extends PublishedExerciseFields {
  id: string;
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
  trackingMode?: "reps" | "duration" | "distance" | null;
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
  contentVersion?: string | null;
  movementPattern?: string | null;
  loadProfile?: ExerciseLoadProfile | null;
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
  contentVersion?: string | null;
  structuredContent?: ExerciseContent | null;
  loadProfile?: ExerciseLoadProfile | null;
  media?: ExerciseVideo | null;
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
