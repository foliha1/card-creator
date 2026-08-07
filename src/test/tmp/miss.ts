import { initDailyState, matchesOn } from "@/lib/dailyEngine";
const s=initDailyState("n1");
const board=[...s.grid];
for(let r=0;r<3;r++){
  const attr=s.rolls[r].attribute;
  outer: for(let i=0;i<9;i++)for(let j=i+1;j<9;j++){
    const a=board[i],bb=board[j];
    if(a&&bb&&!matchesOn(a,bb,attr)){console.log("round",r+1,attr,"mismatch",i,j);break outer;}
  }
}
