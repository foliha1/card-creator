import DailyEmailCapture from "@/components/DailyEmailCapture";
import { COLORS } from "@/lib/tokens";
const ShotEmail = () => (
  <div style={{ padding: 16, background: COLORS.orange, minHeight: "100dvh" }}>
    <DailyEmailCapture source="daily_result" />
  </div>
);
export default ShotEmail;
