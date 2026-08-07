import { initDailyState } from "@/lib/dailyEngine";
const c:Record<string,number>={SHAPE:0,NUMBER:0,COLOR:0};
for(let i=0;i<200;i++){
  const d=new Date(Date.UTC(2026,0,1)); d.setUTCDate(d.getUTCDate()+i);
  const seed="whoop-"+d.toISOString().slice(0,10);
  const s=initDailyState(seed);
  s.rolls.forEach(r=>c[r.attribute]++);
}
console.log(c);
