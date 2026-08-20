import { createDeck } from "../../cardData";
import { createRng } from "../../lib/rng";
import { pickRoll } from "../../lib/rolls";
import { rollsAreSolvable, DAILY_ROLL_ATTRS, DAILY_SLOTS, DAILY_ROUNDS } from "../../lib/dailyEngine";
function gen(seed:string){const rng=createRng(seed);const deck=createDeck(rng);
 for(let deal=0;deal<5;deal++){const board=deck.slice(deal*DAILY_SLOTS,deal*DAILY_SLOTS+DAILY_SLOTS);
  for(let a=0;a<500;a++){const c:any[]=[];
   for(let r=0;r<DAILY_ROUNDS;r++){let roll=pickRoll(DAILY_ROLL_ATTRS,rng);
    for(let i=0;i<2;i++){if(r===0||roll.attribute!==c[r-1].attribute)break;roll=pickRoll(DAILY_ROLL_ATTRS,rng);}
    if(r===DAILY_ROUNDS-1&&c[0].attribute===c[1].attribute){for(let g=0;g<50;g++){if(roll.attribute!==c[r-1].attribute)break;roll=pickRoll(DAILY_ROLL_ATTRS,rng);}}
    c.push(roll);}
   if(rollsAreSolvable(board,c))return{attempts:a+1,deals:deal+1};}}
 return{attempts:-1,deals:-1};}
let multi=0,redeal=0;
for(let i=0;i<5000;i++){const d=new Date(Date.UTC(2026,7,11+i));const r=gen(`whoop-${d.toISOString().slice(0,10)}`);
 if(r.attempts>1)multi++;if(r.deals>1)redeal++;}
console.log({daysNeedingMoreThanOneAttempt:multi,daysNeedingRedeal:redeal});
