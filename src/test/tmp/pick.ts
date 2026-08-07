import { initDailyState } from "@/lib/dailyEngine";
for (const s of ["c1","c2","n1","n2","s1"]) {
  const st=initDailyState(s);
  console.log(s, st.rolls.map(r=>r.attribute+r.faceIndex).join(","));
}
