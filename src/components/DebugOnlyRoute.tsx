import React from "react";
import { Helmet } from "react-helmet-async";
import { resolveDailyContext } from "@/lib/daily";
import NotFound from "@/pages/NotFound";

/**
 * Hides an unfinished route in production. Without `?debug=1` the route renders
 * the existing 404 page; with it, the real component renders untouched (plus a
 * noindex, so a crawler that somehow reaches the debug URL never keeps it).
 * The components themselves are unchanged — this is purely a routing gate.
 */
const DebugOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { debug } = resolveDailyContext();
  if (!debug) return <NotFound />;
  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {children}
    </>
  );
};

export default DebugOnlyRoute;
