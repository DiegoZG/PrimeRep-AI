export const SUPPORT_EMAIL = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "").trim();
export const SUPPORT_AVAILABLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(SUPPORT_EMAIL) && !/\.(example|invalid|test)$/i.test(SUPPORT_EMAIL);

export const SUPPORT_FAQS = [
  { id: "workouts", title: "How do I correct a workout?", body: "During a workout, use Edit or Remove beside a saved set. After finishing, open Profile → Workout History, choose the workout, and edit its sets. Removing a set also offers Undo." },
  { id: "programs", title: "How do programs and replacements work?", body: "Explore contains repeating weekly programs. Choose your training days and review equipment replacements before activating. Replacements use the equipment you selected in Settings. Completed workouts and a workout already in progress stay intact." },
  { id: "coach", title: "What do Coach recommendations mean?", body: "Coach uses your recorded workouts and preferences to suggest your next steps. Review a suggestion before applying it. Weight targets use your selected units and available equipment weights; you can update both in Settings." },
  { id: "password", title: "How do I reset my password?", body: "On Login, tap Forgot password and enter your account email. If an account exists, you’ll receive a link that expires after 30 minutes. A successful reset signs out your existing sessions." },
  { id: "profile", title: "Can I change my name, photo, or body statistics?", body: "Open Profile → Edit Profile. You can change your name, select a private photo, and update or clear optional body statistics. Tap Save to apply changes. Your account email cannot be changed here." },
  { id: "export", title: "What is included in my data download?", body: "Settings → Download my data creates a ZIP with your stored account data, completed-workout CSV files, and profile photo if present. It includes information stored by the service when the archive is created. Changes that are only on your device are not included yet." },
  { id: "delete", title: "How do I delete my account?", body: "Open Settings → Delete Account and confirm the deletion. Download your data first if you want a copy. Account deletion cannot be undone." },
];

export function supportMailto(email: string, report: boolean, diagnostics?: { version: string; platform: string; os: string }) {
  const subject = report ? "PrimeRep problem report" : "PrimeRep support request";
  const body = `${report ? "What happened?\n\nWhat did you expect?\n\nSteps to reproduce:\n" : "How can we help?\n"}${diagnostics ? `\nApp version: ${diagnostics.version}\nPlatform: ${diagnostics.platform}\nOS version: ${diagnostics.os}\n` : ""}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
