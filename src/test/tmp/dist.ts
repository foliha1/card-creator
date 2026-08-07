import { initDailyState } from "@/lib/dailyEngine";
const per=[0,1,2].map(()=>({SHAPE:0,NUMBER:0,COLOR:0} as Record<string,number>));
const tot:Record<string,number>={SHAPE:0,NUMBER:0,COLOR:0};
for(let i=0;i<200;i++){
  const d=new Date(2026,7,1+i);
  const seed=`whoop-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const s=initDailyState(seed);
  s.rolls.forEach((r,k)=>{per[k][r.attribute]++;tot[r.attribute]++;});
}
console.log("round1",per[0]);console.log("round2",per[1]);console.log("round3",per[2]);console.log("total",tot);
