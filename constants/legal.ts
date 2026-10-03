import legalRelease from "./legal-release.json";

export const LEGAL_RELEASE = legalRelease as {
  status: "pending_review" | "approved";
  termsVersion: string;
  privacyVersion: string;
  lastUpdated: string;
  privacyLastUpdated: string;
};
export const TERMS_VERSION = LEGAL_RELEASE.termsVersion;
export const PRIVACY_VERSION = LEGAL_RELEASE.privacyVersion;
export const LEGAL_LAST_UPDATED = LEGAL_RELEASE.lastUpdated;
export const PRIVACY_LAST_UPDATED = LEGAL_RELEASE.privacyLastUpdated;
export const LEGAL_CONTACT_EMAIL =
  process.env.EXPO_PUBLIC_LEGAL_EMAIL?.trim() || "diego.zegarra78@gmail.com";

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
      "PrimeRep processes the account details, onboarding answers, body statistics, equipment preferences, workout plans, completed sets, notes, feedback, favorites, and notification tokens you provide or generate while using the app. We use this information to run your account, create and save workouts, show progress, answer fitness questions, deliver requested notifications, and keep the service reliable and secure.",
    ],
  },
  {
    title: "AI features",
    paragraphs: [
      "Information needed for certain coaching explanations may be sent to an AI service provider. We limit what is sent to what that feature needs. Apple Health steps and sleep summaries are not sent to the AI provider. Guidance based on those summaries is rules-based and does not automatically change your workout plan.",
    ],
  },
  {
    title: "Apple Health",
    paragraphs: [
      "If you choose to connect Apple Health and grant access, PrimeRep can read steps and sleep information. PrimeRep calculates daily step totals and minutes asleep and stores those daily summaries with their date and time zone—not individual Health samples. The first import covers up to 30 days; stored summaries are intended to be retained within a rolling 90-day window. Missing Health information is not treated as a zero value.",
      "You can separately choose whether PrimeRep uses those summaries for optional Coach context and whether it saves newly completed PrimeRep workouts to Apple Health. Workout export includes the workout’s time, title, type, and PrimeRep identifier; it does not export your notes, individual sets, or invented calorie values. PrimeRep does not automatically export workouts you completed before opting in.",
      "You can turn these choices off or disconnect in Settings. Disconnecting removes that source’s stored summaries and related Health-based Coach items from PrimeRep and stops future syncing. It does not delete workouts already saved in Apple Health; you manage those records in Apple Health. You can also change or revoke Health permissions in iOS settings.",
    ],
  },
  {
    title: "Notifications, storage, and sharing",
    paragraphs: [
      "Push notifications are optional. PrimeRep stores a device token when needed to deliver them. We use service providers for hosting, email, notifications, and applicable AI features. We do not sell personal information. We disclose information only to operate the service, comply with law, or protect users and the service.",
    ],
  },
  {
    title: "Your choices and deletion",
    paragraphs: [
      `You can manage Health connections, notifications, and training preferences; download your data; or delete your account in Settings. Account deletion removes PrimeRep’s account-linked data, including stored Health connections and summaries, through the service’s deletion process. It cannot remove records previously written to Apple Health. Privacy questions can be sent to ${LEGAL_CONTACT_EMAIL}.`,
    ],
  },
];
