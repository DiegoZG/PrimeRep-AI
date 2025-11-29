export interface ReasonOption {
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
