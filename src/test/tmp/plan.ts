import { initDailyState, pairsFor, currentRoll } from "@/lib/dailyEngine";
const s=initDailyState("n1");
let board=[...s.grid];
const plan:number[][]=[];
for(let r=0;r<3;r++){
  const attr=s.rolls[r].attribute;
  const [i,j]=pairsFor(board,attr)[0];
  plan.push([i,j]);
  board=board.map((c,k)=>(k===i||k===j?null:c));
}
console.log(JSON.stringify(plan), s.rolls.map(r=>r.attribute));
