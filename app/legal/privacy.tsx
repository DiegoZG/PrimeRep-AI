import { LegalDocumentScreen } from "@/components/legal-document-screen";
import { PRIVACY_LAST_UPDATED, PRIVACY_SECTIONS, PRIVACY_VERSION } from "@/constants/legal";

export default function PrivacyScreen() {
  return <LegalDocumentScreen title="Privacy Policy" version={PRIVACY_VERSION} lastUpdated={PRIVACY_LAST_UPDATED} sections={PRIVACY_SECTIONS} testID="legal-privacy-screen" draftNotice="Privacy policy approved and published. Apple Health release checks are still pending." />;
}
