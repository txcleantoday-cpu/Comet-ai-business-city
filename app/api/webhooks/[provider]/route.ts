import crypto from 'node:crypto';
import {recordWebhook} from '@abc/db';
import {jsonError} from '../../../../lib/auth';
export const runtime='nodejs';
function providerSecret(provider:string){return process.env[`WEBHOOK_SECRET_${provider.toUpperCase()}`]||''}
export async function POST(req:Request,{params}:{params:Promise<{provider:string}>}){try{const {provider}=await params;const raw=await req.text();const secret=providerSecret(provider);if(secret){const supplied=req.headers.get('x-webhook-secret')||'';if(!crypto.timingSafeEqual(Buffer.from(supplied.padEnd(secret.length)),Buffer.from(secret.padEnd(supplied.length))))return Response.json({error:'invalid webhook signature/secret'},{status:401})}const payload=raw?JSON.parse(raw):{};const externalId=String(payload.id||payload.call_id||payload.event_id||req.headers.get('x-event-id')||crypto.createHash('sha256').update(raw).digest('hex'));return Response.json(await recordWebhook({provider,externalId,payload}))}catch(e){return jsonError(e)}}
