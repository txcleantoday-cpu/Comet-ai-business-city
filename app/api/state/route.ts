import {listState} from '@abc/db';
import {integrationStatus} from '@abc/integrations';
import {assertOwner,jsonError} from '../../../lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){try{assertOwner(req);return Response.json({...await listState(),readiness:integrationStatus(),serverTime:new Date().toISOString()})}catch(e){return jsonError(e)}}
