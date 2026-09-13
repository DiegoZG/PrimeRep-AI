import { LegalDocumentScreen } from "@/components/legal-document-screen";
import { LEGAL_LAST_UPDATED, TERMS_SECTIONS, TERMS_VERSION } from "@/constants/legal";

export default function TermsScreen() {
  return <LegalDocumentScreen title="Terms of Service" version={TERMS_VERSION} lastUpdated={LEGAL_LAST_UPDATED} sections={TERMS_SECTIONS} testID="legal-terms-screen" />;
}
