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
