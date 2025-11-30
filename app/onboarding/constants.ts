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
