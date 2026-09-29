import {claimNextStep} from '@abc/db';
import {executeClaimedStep} from '@abc/agents';
import {assertOwner,jsonError} from '../../../../lib/auth';
export const runtime='nodejs';export const maxDuration=120;
export async function POST(req:Request){try{const cron=req.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`;if(!cron)assertOwner(req);const results=[];for(let i=0;i<Number(process.env.WEB_WORKER_BATCH||6);i++){const step=await claimNextStep('web-tick');if(!step)break;results.push({stepId:step.id,type:step.type,result:await executeClaimedStep(step)});const last=results.at(-1)?.result as any;if(last?.waiting||last?.status==='waiting_approval')break}return Response.json({processed:results.length,results})}catch(e){return jsonError(e)}}
