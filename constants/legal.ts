import legalRelease from "./legal-release.json";

export const LEGAL_RELEASE = legalRelease as {
  status: "pending_review" | "approved";
  termsVersion: string;
  privacyVersion: string;
  lastUpdated: string;
};
export const TERMS_VERSION = LEGAL_RELEASE.termsVersion;
export const PRIVACY_VERSION = LEGAL_RELEASE.privacyVersion;
export const LEGAL_LAST_UPDATED = LEGAL_RELEASE.lastUpdated;
export const LEGAL_CONTACT_EMAIL =
  process.env.EXPO_PUBLIC_LEGAL_EMAIL?.trim() || "legal@primerep.app";

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "Using PrimeRep",
    paragraphs: [
      "You must be at least 13 years old and provide accurate account information. Keep your credentials private and use PrimeRep only for lawful personal fitness activities.",
      "PrimeRep may change or discontinue features as the product evolves. We will provide reasonable notice when a material change affects these terms.",
    ],
  },
  {
    title: "Fitness and AI guidance",
    paragraphs: [
      "Workouts, progression suggestions, and AI-generated explanations are educational fitness guidance, not medical advice. Stop exercising and seek qualified care if you feel pain, dizziness, or other concerning symptoms.",
      "You remain responsible for selecting safe weights, using proper technique, and deciding whether a workout is appropriate for you.",
    ],
  },
  {
    title: "Your account and content",
    paragraphs: [
      "You own the workout notes and other content you enter. You give PrimeRep permission to process that content only to operate and improve the service for you.",
      "You can permanently delete your account from Settings. Completed workout records and other account data are deleted as described in the Privacy Policy, while anonymized exercise-catalog contributions may remain without account ownership.",
    ],
  },
  {
    title: "Availability and acceptable use",
    paragraphs: [
      "Do not misuse the service, interfere with its operation, attempt unauthorized access, or use automated systems to exceed published limits. Offline features reduce interruption risk but do not guarantee uninterrupted availability.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      `Questions about these terms can be sent to ${LEGAL_CONTACT_EMAIL}.`,
    ],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "Information we process",
    paragraphs: [
      "PrimeRep processes account details, onboarding answers, body statistics, equipment preferences, workout plans, completed sets, notes, feedback, favorites, and notification tokens when you choose to provide them.",
      "We use this information to authenticate your account, create workouts, preserve progress, answer fitness questions, deliver requested notifications, and keep the service reliable and secure.",
    ],
  },
  {
    title: "AI features",
    paragraphs: [
      "Information needed to generate coaching explanations may be sent to an AI service provider. We limit that information to what the feature needs and do not use private workout notes as public content.",
    ],
  },
  {
    title: "Apple Health and notifications",
    paragraphs: [
      "PrimeRep does not currently connect to Apple Health. If Health access is added later, it will require an explicit permission request and this policy will be updated before collection begins.",
      "Push notifications are optional. The app stores a device push token to deliver them, and you can manage permission in system settings.",
    ],
  },
  {
    title: "Storage, sharing, and deletion",
    paragraphs: [
      "PrimeRep uses service providers for hosting, email delivery, notifications, and AI features. We do not sell personal information. We disclose information only to operate the service, comply with law, or protect users and the service.",
      "You can delete your account from Settings. Account-linked workout, profile, and notification data is then removed according to the service's deletion process.",
    ],
  },
  {
    title: "Your choices",
    paragraphs: [
      `You can update training preferences, manage notifications, change units, or delete your account in Settings. Privacy questions can be sent to ${LEGAL_CONTACT_EMAIL}.`,
    ],
  },
];
