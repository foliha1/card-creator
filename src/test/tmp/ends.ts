import { initDailyState, dailyReducer, pairsFor, matchesOn, type DailyState, type DailyAction } from "@/lib/dailyEngine";
const R=(s:DailyState,a:DailyAction)=>dailyReducer(s,a);
function toPlay(s:DailyState){s=R(s,{type:"START"});s=R(s,{type:"REVEAL"});s=R(s,{type:"HIDE"});s=R(s,{type:"ROLL_START"});return R(s,{type:"PLAY_START",at:0});}
function next(s:DailyState){ // HIDE->PLAY for later rounds
  s=R(s,{type:"ROLL_START"});return R(s,{type:"PLAY_START",at:0});}
function claim(s:DailyState,i:number,j:number){s=R(s,{type:"SELECT",idx:i});s=R(s,{type:"SELECT",idx:j});return R(s,{type:"RESOLVE",at:100});}
function goodPair(s:DailyState){return pairsFor(s.grid,s.rolls[s.roundIndex-1].attribute)[0];}
function badPair(s:DailyState){const attr=s.rolls[s.roundIndex-1].attribute;for(let i=0;i<9;i++)for(let j=i+1;j<9;j++){const a=s.grid[i],b=s.grid[j];if(a&&b&&!matchesOn(a,b,attr))return [i,j];}throw new Error("none");}

// ending 3: fail all
let s=toPlay(initDailyState("n1"));
for(let r=1;r<=3;r++){
  for(let k=0;k<2;k++){const [i,j]=badPair(s);s=claim(s,i,j);}
  console.log("round",r,"phase",s.phase);
  if(s.phase==="WHOOPED"){s=R(s,{type:"ROUND_END",at:200});console.log("  after ROUND_END",s.phase,s.roundIndex,s.elapsedMs);}
  if(s.phase==="HIDE") s=next(s);
}
console.log("ALLFAIL final:",s.phase,s.elapsedMs,s.failed);
