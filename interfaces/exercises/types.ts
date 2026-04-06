// API response types (backend schema)
export interface ExerciseApiItem {
  id: string;
  name: string;
  exercise_type: string;
  primary_muscle: string;
  image_url?: string | null;
  demo_video_url?: string | null;
  is_active?: boolean;
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
  source?: string;
  owner_user_id?: string | null;
  sort_order?: number;
  equipment_ids?: number[];
}

// UI model (basic, used in lists)
export interface Exercise {
  id: string;
  name: string;
  exerciseType: string;
  primaryMuscle: string;
  imageUrl?: string;
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
  equipmentIds: number[];
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
