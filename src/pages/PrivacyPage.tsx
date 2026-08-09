import React from "react";
import LegalPage, {
  LegalList,
  LegalSection,
  LegalText,
  MailLink,
} from "@/components/LegalPage";

const UPDATED = "9 August 2026";

const PrivacyPage: React.FC = () => (
  <LegalPage
    title="Privacy"
    metaTitle="Privacy Policy — WHOOP! WHOOP! Daily"
    metaDescription="What WHOOP! WHOOP! Daily collects: an email only if you give it, a random visitor ID for your streak, and anonymous gameplay events. No ads, no cross-site tracking."
    path="/privacy"
    updated={UPDATED}
  >
    <LegalText>
      WHOOP! WHOOP! Daily is a free daily memory game. This page describes exactly what the game
      collects and why. There is no account to create, and you can play without giving us anything.
    </LegalText>

    <LegalSection heading="Your email address">
      <LegalText>
        We collect an email address only when you type one in and submit it, and only so we can send
        you the daily puzzle reminder. It is stored in our own database and also sent to
        ActiveCampaign, the email provider we use to send the reminder on our behalf.
      </LegalText>
      <LegalText>
        We do not send anything other than the daily puzzle email. You can unsubscribe at any time
        using the link in any email we send, or by writing to <MailLink />.
      </LegalText>
    </LegalSection>

    <LegalSection heading="Your visitor ID">
      <LegalText>
        When you first play, the game stores a random visitor ID in your browser. It is used to
        remember your streak, your stats, and that you have already played today. It is not tied to
        your name or to any other identifier, and it is not shared with anyone.
      </LegalText>
      <LegalText>
        If you give us an email address, we link it to that visitor ID so your streak can follow you
        to another device. Clearing your browser storage removes the ID; your streak can be restored
        by entering the same email again.
      </LegalText>
    </LegalSection>

    <LegalSection heading="Gameplay events">
      <LegalText>
        We record anonymous events about how the game is played: rounds solved, misses, peeks,
        shares, and where a visit came from (the referring site or a campaign tag in the link). We
        use this to see which puzzles are too hard or too easy and to improve the game. These events
        carry the random visitor ID, never a name or an email.
      </LegalText>
    </LegalSection>

    <LegalSection heading="What we do not do">
      <LegalList
        items={[
          "No advertising, and no ad networks.",
          "No tracking of you across other websites.",
          "No selling or renting of your data to anyone.",
          "No third-party analytics or advertising trackers in the game.",
        ]}
      />
    </LegalSection>

    <LegalSection heading="Unsubscribing and deletion">
      <LegalText>
        To stop the emails, use the unsubscribe link in any email, or write to <MailLink />. To have
        your email address and your stored results deleted, write to <MailLink /> from the address
        you signed up with and ask for deletion. We will remove your address from our database and
        from ActiveCampaign, along with the results tied to it.
      </LegalText>
    </LegalSection>

    <LegalSection heading="Children">
      <LegalText>
        The game is suitable for all ages, but we ask that anyone under 13 does not submit an email
        address without a parent or guardian's involvement.
      </LegalText>
    </LegalSection>

    <LegalSection heading="Changes">
      <LegalText>
        If what we collect changes, we will update this page and the date at the top of it.
      </LegalText>
    </LegalSection>

    <LegalSection heading="Contact">
      <LegalText>
        Questions about any of this: <MailLink />.
      </LegalText>
    </LegalSection>
  </LegalPage>
);

export default PrivacyPage;
