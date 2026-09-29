import {listVehicles,createVehicle} from '@abc/db';
import {assertOwner,jsonError} from '../../../lib/auth';
export const runtime='nodejs';
export async function GET(req:Request){try{assertOwner(req);return Response.json({vehicles:await listVehicles()})}catch(e){return jsonError(e)}}
export async function POST(req:Request){try{assertOwner(req);const body=await req.json();if(!body.make||!body.model)return Response.json({error:'make and model are required'},{status:400});return Response.json(await createVehicle(body),{status:201})}catch(e){return jsonError(e)}}
