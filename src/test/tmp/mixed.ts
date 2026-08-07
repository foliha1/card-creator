import { initDailyState, pairsFor, matchesOn } from "@/lib/dailyEngine";
import { getDailySeed } from "@/lib/daily";
const s=initDailyState(getDailySeed());
let board=[...s.grid];
const solve:number[][]=[];
for(let r=0;r<2;r++){
  const [i,j]=pairsFor(board,s.rolls[r].attribute)[0];
  solve.push([i,j]); board=board.map((c,k)=>(k===i||k===j?null:c));
}
const attr=s.rolls[2].attribute;
let miss:number[]=[];
outer: for(let i=0;i<9;i++)for(let j=i+1;j<9;j++){const a=board[i],b=board[j];if(a&&b&&!matchesOn(a,b,attr)){miss=[i,j];break outer;}}
console.log(JSON.stringify(solve), JSON.stringify(miss), s.rolls.map(r=>r.attribute).join(","));
