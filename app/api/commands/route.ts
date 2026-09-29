import {createJobFromCommand} from '@abc/db';
import {assertOwner,jsonError} from '../../../lib/auth';
export const runtime='nodejs';
export async function POST(req:Request){try{assertOwner(req);const body=await req.json();const text=String(body.text||'').trim();if(!text)return Response.json({error:'text is required'},{status:400});const job=await createJobFromCommand({text,requestedBy:'owner'});return Response.json({commandId:job.command_id,jobId:job.id,factory:job.factory,status:job.status},{status:201})}catch(e){return jsonError(e)}}
