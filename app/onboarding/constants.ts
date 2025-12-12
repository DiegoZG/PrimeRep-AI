export interface ReasonOption {
  id: string;
  title: string;
  description: string;
}

export interface ExperienceOption {
  id: string;
  title: string;
  description: string;
}

export interface FitnessGoalOption {
  id: string;
  title: string;
  description: string;
  tag?: {
    text: string;
    type: "popular" | "powerlifting";
  };
}

export interface TrainingFrequencyOption {
  id: string;
  title: string;
  tag?: {
    text: string;
    type: "recommended";
  };
}

export interface WorkoutSplitOption {
  id: string;
  title: string;
  description: string;
  tag?: {
    text: string;
    type: "recommended" | "advanced";
  };
  icon?: string; // Icon name for left side (e.g., "sparkles" or emoji)
  showChevron?: boolean; // If true, show chevron instead of checkbox
  specialBackground?: boolean; // If true, use special background color
}

export const REASON_SCREEN = {
  title: "Reason",
  step: 1,
  totalSteps: 9,
  question: "Why do you want to use a fitness app?",
  options: [
    {
      id: "beginner",
      title: "I'm a beginner and want guidance",
      description: "Get started with the basics and build a strong foundation.",
    },
    {
      id: "improve",
      title: "I'm interested in improving my current training routine",
      description: "Fine-tune your workouts for better results.",
    },
    {
      id: "variation",
      title: "I'm bored of my workout plan and want more variation",
      description: "Explore new exercises and keep things fresh.",
    },
    {
      id: "personalized",
      title: "I want an optimal training plan based on my specific needs",
      description: "Receive a personalized program to hit your goals.",
    },
    {
      id: "structure",
      title:
        "I want to know what to do at the gym every time without having to think about it",
      description: "Follow a structured plan and remove guesswork.",
    },
  ] as ReasonOption[],
};

export const BODY_STATS_SCREEN = {
  title: "Body Stats",
  step: 2,
  totalSteps: 9,
  syncSection: {
    heading: "Sync Gravl with Apple Health for the best experience.",
    description:
      "To personalize workouts and calculate calories burned, sync your Apple health profile. Your data is never shared with third parties.",
    buttonText: "Sync with Apple Health",
  },
  manualSection: {
    heading: "Enter your health profile",
    description:
      "We use gender, weight and age to provide you with the most accurate personalised workouts.",
  },
  formFields: {
    gender: {
      label: "Gender",
      placeholder: "Select gender",
    },
    weight: {
      label: "Weight",
      placeholder: "",
      unit: "LB",
    },
    age: {
      label: "Age",
      placeholder: "",
    },
  },
  genderOptions: ["Male", "Female", "Other", "Prefer not to say"],
};

export const FITNESS_EXPERIENCE_SCREEN = {
  title: "Fitness Experience",
  step: 3,
  totalSteps: 9,
  question: "How experienced are you lifting weights?",
  description:
    "This will help us to recommend the right exercises and weights for you.",
  options: [
    {
      id: "no-experience",
      title: "No Experience",
      description:
        "New to the gym. Not familiar with exercises and equipment. Focus on building training foundation.",
    },
    {
      id: "beginner",
      title: "Beginner",
      description:
        "Some gym experience (<1 year). Familiar with basic exercises but still learning proper form.",
    },
    {
      id: "intermediate",
      title: "Intermediate",
      description:
        "1-2 years of weightlifting experience. Good understanding of exercises and form. Ready for advanced methods.",
    },
    {
      id: "advanced",
      title: "Advanced",
      description:
        ">3 years of consistent experience. Achieved significant strength/muscle development. Comfortable with complex exercises.",
    },
  ] as ExperienceOption[],
};

export const FITNESS_GOAL_SCREEN = {
  title: "Fitness Goal",
  step: 4,
  totalSteps: 9,
  question: "What are your top fitness goals?",
  description:
    "This will help us to recommend the right exercises and sets for you.",
  options: [
    {
      id: "build-muscle",
      title: "Build muscle and get toned",
      description:
        "Focus on muscle development and tone your body. Perform pyramid sets to improve your weights in every workout.",
      tag: {
        text: "Popular",
        type: "popular",
      },
    },
    {
      id: "general-fitness",
      title: "Enhance general fitness",
      description:
        "Improve your overall fitness by lifting consistent weights and learning new exercises.",
    },
    {
      id: "conditioning",
      title: "Improve conditioning",
      description:
        "Focus on higher reps and lower weights through fast-paced supersets to boost your overall conditioning.",
    },
    {
      id: "get-stronger",
      title: "Get stronger",
      description:
        "Focus on compound exercises. Train fewer muscles per workout and lift heavier weights in lower rep ranges.",
      tag: {
        text: "Powerlifting",
        type: "powerlifting",
      },
    },
  ] as FitnessGoalOption[],
};

export const ONE_REP_MAX_SCREEN = {
  title: "Fitness Experience",
  step: 3,
  totalSteps: 9,
  question: "Do you know your one-rep max?",
  description:
    "Add your one-rep max to get even more personalized weight recommendations. You can use our calculator to estimate it.",
  calculatorSection: {
    heading: "Calculator",
  },
  exercises: [
    {
      id: "bench-press",
      name: "Bench Press",
    },
    {
      id: "back-squat",
      name: "Back Squat",
    },
    {
      id: "deadlift",
      name: "Deadlift",
    },
  ],
};

export const ONE_REP_MAX_CALCULATOR_MODAL = {
  title: "One rep max",
  description:
    "Enter the max weight and reps you've done in a set to calculate your one-rep max.",
  inputs: {
    reps: {
      label: "Reps",
      placeholder: "-",
    },
    weight: {
      label: "Weight",
      placeholder: "-",
      unit: "lb",
    },
  },
  calculateButton: "CALCULATE",
};

// 1RM calculation percentages based on rep count
export const ONE_RM_PERCENTAGES: Record<number, number> = {
  1: 1.0,
  2: 0.97,
  3: 0.94,
  4: 0.92,
  5: 0.89,
  6: 0.86,
  7: 0.83,
  8: 0.81,
  9: 0.78,
  10: 0.75,
  11: 0.73,
  12: 0.71,
  13: 0.7,
  14: 0.68,
  15: 0.67,
  16: 0.65,
  17: 0.64,
  18: 0.63,
  19: 0.61,
  20: 0.6,
  21: 0.59,
  22: 0.58,
  23: 0.57,
  24: 0.56,
  25: 0.55,
  26: 0.54,
  27: 0.53,
  28: 0.52,
  29: 0.51,
  30: 0.5,
};

export function calculateOneRepMax(weight: number, reps: number): number {
  if (reps < 1 || reps > 30 || weight <= 0) {
    return 0;
  }
  const percentage = ONE_RM_PERCENTAGES[reps] || 0.5; // Default to 50% for reps > 30
  return Math.round(weight / percentage);
}

export const TRAINING_FREQUENCY_SCREEN = {
  title: "Training Frequency",
  step: 5,
  totalSteps: 9,
  question: "How often do you train?",
  description:
    "Setting a realistic goal will help you to stay motivated and track your progress.",
  options: [
    {
      id: "1-day",
      title: "1 day per week",
    },
    {
      id: "2-days",
      title: "2 days per week",
    },
    {
      id: "3-days",
      title: "3 days per week",
      tag: {
        text: "Recommended for you",
        type: "recommended",
      },
    },
    {
      id: "4-days",
      title: "4 days per week",
      tag: {
        text: "Recommended for you",
        type: "recommended",
      },
    },
    {
      id: "5-days",
      title: "5 days per week",
    },
    {
      id: "6-days",
      title: "6 days per week",
    },
    {
      id: "every-day",
      title: "Every day",
    },
  ] as TrainingFrequencyOption[],
};

export const WORKOUT_SPLIT_SCREEN = {
  title: "Workout Split",
  step: 6,
  totalSteps: 9,
  question: "What's your preferred workout split?",
  description:
    "Based on your training frequency, level and gender we recommend the following splits. Remember you can always change this later.",
  options: [
    {
      id: "ai-optimized",
      title: "AI-Optimized",
      description:
        "Our AI creates dynamic workouts prioritising the muscle groups with the best recovery state",
      icon: "✨",
    },
    {
      id: "push-pull-legs",
      title: "Push, Pull, Legs",
      description:
        "This structure allows you to focus on one movement pattern per day, maximizing the stimulus. It increases the intensity and volume per session for each muscle group, making it ideal for hypertrophy.",
      tag: {
        text: "Recommended for you",
        type: "recommended",
      },
    },
    {
      id: "custom",
      title: "Custom",
      description: "Create your own routine.",
      tag: {
        text: "Advanced",
        type: "advanced",
      },
      showChevron: true,
    },
    {
      id: "upper-lower",
      title: "Upper, Lower",
      description:
        "Allows balanced training with double frequency between upper and lower body. Recommended for those seeking a higher training volume with good recovery.",
      specialBackground: true,
    },
    {
      id: "push-pull-legs-full-body",
      title: "Push, Pull, Legs, Full body",
      description:
        "Blend push, pull, and leg routines with full-body sessions to maintain variety and optimize weekly volume.",
    },
    {
      id: "push-pull-legs-upper-lower",
      title: "Push, Pull, Legs, Upper, Lower",
      description:
        "Adaptation of Push, Pull, and Legs, with two additional days split between upper and lower body, increasing the frequency and weekly volume of work for all muscle groups.",
    },
    {
      id: "upper-lower-full-body",
      title: "Upper, Lower, Full body",
      description:
        "Allows balanced training with double frequency for both upper and lower body. It is important to leave at least one day of rest before the full-body day to avoid training the same muscles on consecutive days and ensure optimal recovery.",
    },
    {
      id: "full-body",
      title: "Full Body",
      description:
        "Ideal for beginners or people with limited time to train. Allows you to improve strength and endurance throughout the body without needing to train multiple days a week.",
    },
    {
      id: "bro-split",
      title: "Bro Split",
      description:
        "Classic approach for those with limited time in each session, enough to dedicate the session to a single muscle group.",
    },
    {
      id: "lower-focused-upper",
      title: "Lower Focused + Upper",
      description:
        "Ideal if you want to focus on your leg and glute muscles. Your lower body will be trained twice per week, so make sure to include at least one rest day between the two lower body sessions.",
    },
    {
      id: "push-pull-legs-upper-body",
      title: "Push, Pull, Legs, Upper body",
      description:
        "A balanced routine that emphasizes upper body development by training both push and pull muscles twice per week. Be sure to include at least one rest day between the Upper Body and Push sessions to allow for proper recovery.",
    },
  ] as WorkoutSplitOption[],
};

export const CUSTOM_SPLIT_SCREEN = {
  title: "Custom Split",
  step: 6,
  totalSteps: 9,
  question: "Custom split",
  description:
    "Create your own workout cycle by rotating between existing workout splits or creating your own. You can always change this later.",
};

export interface AddWorkoutOption {
  id: string;
  title: string;
  description: string;
  isToggle?: boolean; // If true, use toggle switch instead of checkbox
}

export const ADD_WORKOUT_MODAL = {
  title: "Add a custom workout",
  description:
    "Select one of the predefined muscle splits or create your own custom one.",
  tabs: [
    { id: "workout-split", label: "Workout split" },
    { id: "custom", label: "Custom" },
  ],
  workoutSplitOptions: [
    {
      id: "full-body",
      title: "Full body",
      description: "Train your entire body.",
    },
    {
      id: "upper-body",
      title: "Upper body",
      description: "Train chest, back, shoulders and arms.",
    },
    {
      id: "legs",
      title: "Legs",
      description: "Train hamstrings, quads, glutes and calves.",
    },
    {
      id: "push",
      title: "Push",
      description: "Train chest, shoulders and triceps.",
    },
    {
      id: "pull",
      title: "Pull",
      description: "Train back and biceps.",
    },
    {
      id: "core",
      title: "Core",
      description: "Include abs and lower back.",
      isToggle: true,
    },
  ] as AddWorkoutOption[],
  customMuscleGroups: [
    { id: "chest", name: "Chest" },
    { id: "back", name: "Back" },
    { id: "biceps", name: "Biceps" },
    { id: "glutes", name: "Glutes" },
    { id: "shoulders", name: "Shoulders" },
    { id: "triceps", name: "Triceps" },
    { id: "abs", name: "Abs" },
    { id: "lower-back", name: "Lower back" },
    { id: "quads", name: "Quads" },
    { id: "hamstrings", name: "Hamstrings" },
    { id: "calves", name: "Calves" },
    { id: "adductors", name: "Adductors" },
    { id: "abductors", name: "Abductors" },
    { id: "forearms", name: "Forearms" },
    { id: "trapezius", name: "Trapezius" },
  ],
};

export interface VarietyLevelOption {
  id: string;
  title: string;
  description: string;
}

export const VARIETY_LEVEL_SCREEN = {
  title: "Variety Level",
  step: 7,
  totalSteps: 9,
  question: "How would you like us to select your exercises?",
  description:
    "Choose how much variety you want in your workouts. You can always change this later.",
  options: [
    {
      id: "consistent",
      title: "Consistent",
      description:
        "Prioritises a few essential exercises that will be repeated throughout your workouts and allow easier progress tracking.",
    },
    {
      id: "balanced",
      title: "Balanced",
      description:
        "Provides a mix of repeated and new exercises for a well-rounded experience with moderate progress tracking.",
    },
    {
      id: "varied",
      title: "Varied",
      description:
        "Offers a lot of variety with different exercises in every workout, making progress tracking more challenging.",
    },
  ] as VarietyLevelOption[],
};

export interface TrainingPlaceOption {
  id: string;
  title: string;
  description: string;
}

export const TRAINING_PLACE_SCREEN = {
  title: "Training Place",
  step: 8,
  totalSteps: 9,
  question: "Where do you exercise?",
  description:
    "Select the equipment you have access to. You can also change this later.",
  options: [
    {
      id: "large-gym",
      title: "Large Gym",
      description:
        "Full fitness clubs such as Anytime, Fitness First, Golds, Planet Fitness, etc.",
    },
    {
      id: "small-gym",
      title: "Small Gym",
      description: "Compact gym with limited equipment",
    },
    {
      id: "garage-gym",
      title: "Garage Gym",
      description: "Barbells, squat rack, dumbbells and more.",
    },
  ] as TrainingPlaceOption[],
};

export const NOTIFICATIONS_SCREEN = {
  title: "Notifications",
  step: 9,
  totalSteps: 9,
  heading: "Enable notifications",
  description:
    "To get the full benefit of Gravl, turn on your notifications to receive:",
  notifications: [
    {
      id: "workout",
      type: "workout",
      title: "Workout",
      exercise: "Deadlift",
      nextSet: "Next: Set 2/3 - 10 reps - 80kg",
      rest: "Rest",
      timestamp: "07:00", // This will be dynamic, starting from 07:00
    },
    {
      id: "rest-over-1",
      type: "rest",
      title: "Rest time is over",
      nextSet: "Next set: Back Squat - 10 reps - 80kg",
      timestamp: "now",
    },
    {
      id: "rest-over-2",
      type: "rest",
      title: "Rest time is over",
      nextSet: "Next set: Deadlift - 8 reps - 80kg",
      timestamp: "now",
    },
    {
      id: "strength-score",
      type: "strength",
      title: "Strength Score",
      message: "Your Strength Score has increased by 4 points",
      timestamp: "now",
    },
  ],
};
