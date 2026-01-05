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

// UI model
export interface Exercise {
  id: string;
  name: string;
  exerciseType: string;
  primaryMuscle: string;
  imageUrl?: string;
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

