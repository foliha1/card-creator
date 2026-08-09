import React from "react";
import LegalPage, { LegalSection, LegalText, MailLink } from "@/components/LegalPage";

const UPDATED = "9 August 2026";

const TermsPage: React.FC = () => (
  <LegalPage
    title="Terms"
    metaTitle="Terms of Use — WHOOP! WHOOP! Daily"
    metaDescription="WHOOP! WHOOP! Daily is free to play and provided as is. We may change or stop it at any time. Questions: hello@whoop-whoop.com."
    path="/terms"
    updated={UPDATED}
  >
    <LegalSection heading="The game is free">
      <LegalText>
        WHOOP! WHOOP! Daily is free to play. There is nothing to buy, and no account is required.
      </LegalText>
    </LegalSection>

    <LegalSection heading="Provided as is">
      <LegalText>
        The game is provided as is, without warranties of any kind. We do our best to keep it working
        and accurate, but we cannot promise it will always be available or free of faults, and we are
        not liable for any loss arising from using it.
      </LegalText>
    </LegalSection>

    <LegalSection heading="We may change or stop it">
      <LegalText>
        We may change how the game works, or stop offering it, at any time and without notice. Puzzle
        history, streaks and stats may be reset as part of that.
      </LegalText>
    </LegalSection>

    <LegalSection heading="The game itself">
      <LegalText>
        The name, artwork, sounds and code are ours. Please do not copy or republish them without
        asking. Sharing your result is very much encouraged.
      </LegalText>
    </LegalSection>

    <LegalSection heading="Get in touch">
      <LegalText>
        Anything at all, including licensing: <MailLink />.
      </LegalText>
    </LegalSection>
  </LegalPage>
);

export default TermsPage;
