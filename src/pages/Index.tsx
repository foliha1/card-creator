import { Helmet } from "react-helmet-async";
import DesktopShell from "@/components/DesktopShell";

const Index = () => {
  const url = "https://whoop-whoop.lovable.app/";
  const title = "WHOOP! WHOOP! — A Memory Card Game by Oleeha & Co";
  const description =
    "A competitive memory card game where matching rules change every round. Play online or pre-order the physical game from Oleeha & Co.";
  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Game",
          name: "WHOOP! WHOOP!",
          description,
          url,
          genre: "Memory Card Game",
          numberOfPlayers: "2-6",
          audience: { "@type": "PeopleAudience", suggestedMinAge: 7 },
          publisher: { "@type": "Organization", name: "Oleeha & Co" },
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "WHOOP! WHOOP!",
          url,
        })}</script>
      </Helmet>
      <DesktopShell />
    </>
  );
};

export default Index;
