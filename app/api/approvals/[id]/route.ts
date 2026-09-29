import {resolveApproval} from '@abc/db';
import {assertOwner,jsonError} from '../../../../lib/auth';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{assertOwner(req);const {id}=await params;const body=await req.json();return Response.json(await resolveApproval(id,body.decision))}catch(e){return jsonError(e)}}
