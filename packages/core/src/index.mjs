export const FACTORY_IDS = ['solutions','aces','creator','etsy','media','assets','command','analytics'];

export function calculateQuote(input){
  const x = {
    visitsPerMonth:Number(input.visitsPerMonth),
    hoursPerVisit:Number(input.hoursPerVisit),
    teamSize:Number(input.teamSize),
    loadedHourlyRate:Number(input.loadedHourlyRate),
    supplies:Number(input.supplies||0),
    travel:Number(input.travel||0),
    overhead:Number(input.overhead||0),
    targetMargin:Number(input.targetMargin)
  };
  for(const [k,v] of Object.entries(x)) if(!Number.isFinite(v) || v < 0) throw new Error(`${k} must be a non-negative number`);
  if(x.targetMargin<=0 || x.targetMargin>=1) throw new Error('targetMargin must be between 0 and 1');
  const laborHours=x.visitsPerMonth*x.hoursPerVisit*x.teamSize;
  const laborCost=laborHours*x.loadedHourlyRate;
  const monthlyCost=laborCost+x.supplies+x.travel+x.overhead;
  const recommendedPrice=monthlyCost/(1-x.targetMargin);
  return {
    laborHours:round2(laborHours),
    laborCost:round2(laborCost),
    monthlyCost:round2(monthlyCost),
    recommendedPrice:round2(recommendedPrice),
    grossProfit:round2(recommendedPrice-monthlyCost),
    grossMargin:x.targetMargin
  };
}

export function routeFactory(text=''){
  const t=String(text).toLowerCase();
  if(/clean|medical|dental|office|facility|quote|janitorial|lead/.test(t)) return 'solutions';
  if(/aces|car|vehicle|dealer|down payment|auto/.test(t)) return 'aces';
  if(/photo|picture|portrait|creator|wall art|wallpaper/.test(t)) return 'creator';
  if(/etsy|listing|shop/.test(t)) return 'etsy';
  if(/video|reel|thumbnail|media|content/.test(t)) return 'media';
  if(/asset|pack|icon|template|digital pack/.test(t)) return 'assets';
  return 'command';
}

export function parseCommandHints(text=''){
  const t=String(text);
  const lower=t.toLowerCase();
  const quantity=Number((t.match(/\b(\d{1,4})\b/)||[])[1]||0) || undefined;
  const knownIndustries=['medical','dental','office','roofing','real estate','dealership','apartment','property management','tax','fencing','construction'];
  const industry=knownIndustries.find(x=>lower.includes(x));
  const locationMatch=t.match(/(?:in|around|near)\s+([A-Za-z][A-Za-z .'-]{2,50})(?:\s+and|\.|,|$)/i);
  const location=locationMatch?.[1]?.trim();
  return {quantity,industry,location,sendNow:/\b(send|publish|call)\b/i.test(t)};
}

export function safeJsonParse(text){
  if(typeof text!=='string') return text;
  const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate=(fenced?.[1]||text).trim();
  try{return JSON.parse(candidate)}catch{}
  const first=Math.min(...['{','['].map(c=>{const i=candidate.indexOf(c);return i<0?Infinity:i}));
  const last=Math.max(candidate.lastIndexOf('}'),candidate.lastIndexOf(']'));
  if(Number.isFinite(first)&&last>first){try{return JSON.parse(candidate.slice(first,last+1))}catch{}}
  throw new Error('Model output was not valid JSON');
}

export function round2(n){return Math.round((Number(n)+Number.EPSILON)*100)/100}
export function nowIso(){return new Date().toISOString()}
export function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
