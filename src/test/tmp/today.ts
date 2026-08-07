import { initDailyState, matchesOn, pairsFor } from "@/lib/dailyEngine";
import { getDailySeed } from "@/lib/daily";
const seed=getDailySeed();
const s=initDailyState(seed);
const board=[...s.grid];
const miss:number[][]=[];
for(let r=0;r<3;r++){
  const attr=s.rolls[r].attribute;
  outer: for(let i=0;i<9;i++)for(let j=i+1;j<9;j++){
    const a=board[i],bb=board[j];
    if(a&&bb&&!matchesOn(a,bb,attr)){miss.push([i,j]);break outer;}
  }
}
console.log(seed, s.rolls.map(r=>r.attribute).join(","), JSON.stringify(miss));
