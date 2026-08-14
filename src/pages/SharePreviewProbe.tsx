import React from "react";
import DailySharePreview from "@/components/DailySharePreview";

const SharePreviewProbe: React.FC = () => (
  <DailySharePreview
    imageUrl={null}
    puzzleNumber={4}
    imageTheme="light"
    onSetTheme={() => undefined}
    mobile
    onSend={() => undefined}
    onInvite={() => undefined}
    onClose={() => undefined}
  />
);

export default SharePreviewProbe;
