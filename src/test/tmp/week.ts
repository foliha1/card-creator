import { initDailyState } from "@/lib/dailyEngine";
for(let i=1;i<=14;i++){
  const seed=`whoop-2026-08-${String(i).padStart(2,"0")}`;
  console.log(seed, initDailyState(seed).rolls.map(r=>r.attribute+r.faceIndex).join(" "));
}
