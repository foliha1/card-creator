import { initDailyState, rollsAreSolvable, DAILY_ROUNDS } from "../../lib/dailyEngine";
const seq = (s:string)=>initDailyState(s).rolls.map(r=>r.attribute);
function day(i:number){const d=new Date(Date.UTC(2026,7,11+i));return `whoop-${d.toISOString().slice(0,10)}`}
let out:string[]=[];
for(let i=0;i<51;i++){const s=day(i);const q=seq(s);out.push(`${s} ${q.join("-")}${q[0]===q[1]||q[1]===q[2]?"  <REPEAT>":""}`)}
console.log(out.join("\n"));
let rep=0,trip=0,two=0,three=0,fail=0;const first:Record<string,number>={};
for(let i=0;i<5000;i++){const s=day(i);const st=initDailyState(s);const q=st.rolls.map(r=>r.attribute);
 if(q[0]===q[1]||q[1]===q[2])rep++; if(q[0]===q[1]&&q[1]===q[2])trip++;
 const d=new Set(q).size; if(d===2)two++; if(d===3)three++;
 first[q[0]]=(first[q[0]]??0)+1;
 if(!rollsAreSolvable(st.grid,st.rolls))fail++;}
console.log({rounds:DAILY_ROUNDS,repeatPct:(rep/5000*100).toFixed(2),triples:trip,twoDistinct:two,threeDistinct:three,solvableFailures:fail,first});
let det=true;for(let i=0;i<200;i++){const s=day(i);const a=initDailyState(s),b=initDailyState(s);
 if(JSON.stringify(a.grid.map(c=>c?.id))!==JSON.stringify(b.grid.map(c=>c?.id))||JSON.stringify(a.rolls)!==JSON.stringify(b.rolls))det=false;}
console.log({deterministic200:det});
