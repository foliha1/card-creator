import { initDailyState, dailyReducer, matchesOn } from "@/lib/dailyEngine";
import { resolveDailyContext } from "@/lib/daily";
const ctx = resolveDailyContext(new URLSearchParams("debug=1&day=4"), new Date());
console.log("seed", ctx.seed, "puzzle", ctx.puzzleNumber);
let s = initDailyState(ctx.seed);
console.log("rolls", JSON.stringify(s.rolls));
for (let r = 1; r <= 3; r++) {
  const attr = s.rolls[r-1].attribute;
  const idx: number[] = [];
  outer: for (let i=0;i<9;i++) for (let j=i+1;j<9;j++) {
    const a=s.grid[i], b=s.grid[j];
    if (a&&b&&matchesOn(a,b,attr)) { idx.push(i,j); break outer; }
  }
  console.log("round",r,"attr",attr,"pair",idx);
  // advance state as if solved
  s = dailyReducer(s, {type:"ROLL_START"});
  s = dailyReducer(s, {type:"PLAY_START", at: 0});
  s = dailyReducer(s, {type:"SELECT", idx: idx[0]});
  s = dailyReducer(s, {type:"SELECT", idx: idx[1]});
  s = dailyReducer(s, {type:"RESOLVE", at: 1000});
  s = dailyReducer(s, {type:"CLEAR_MATCH"});
}
