import {retryJob} from '@abc/db';
import {assertOwner,jsonError} from '../../../../../lib/auth';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{assertOwner(req);const {id}=await params;return Response.json(await retryJob(id))}catch(e){return jsonError(e)}}
