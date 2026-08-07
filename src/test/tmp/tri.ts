import { initDailyState, pairsFor, rollsAreSolvable } from "@/lib/dailyEngine";
import { createRng } from "@/lib/rng";
import { createDeck } from "@/cardData";
let allSame=0, attempts=0;
const tri:Record<string,number>={};
const perRound=[0,1,2].map(()=>({SHAPE:0,NUMBER:0,COLOR:0} as any));
for(let i=0;i<200;i++){
  const d=new Date(2026,7,1+i);
  const seed=`whoop-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const s=initDailyState(seed);
  const k=s.rolls.map(r=>r.attribute).join("-");
  tri[k]=(tri[k]||0)+1;
  if(new Set(s.rolls.map(r=>r.attribute)).size===1) allSame++;
  s.rolls.forEach((r,n)=>perRound[n][r.attribute]++);
  // how many candidate triples get rejected
  const rng=createRng(seed); const grid=createDeck(rng).slice(0,9);
  let tries=0; 
  for(;tries<500;tries++){
    const cand=[0,1,2].map(()=>({attribute:(["SHAPE","NUMBER","COLOR"] as any)[Math.floor(rng()*3)],faceIndex:(Math.floor(rng()*2)) as 0|1}));
    if(rollsAreSolvable(grid,cand as any)) break;
  }
  attempts+=tries+1;
}
console.log("all-same triples:",allSame,"/200  (chance-expected ~22)");
console.log("avg candidate draws per seed:", (attempts/200).toFixed(2));
console.log(Object.entries(tri).sort((a,b)=>b[1]-a[1]).slice(0,12));
