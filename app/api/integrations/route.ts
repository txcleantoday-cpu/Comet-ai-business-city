import {integrationStatus} from '@abc/integrations';
import {assertOwner,jsonError} from '../../../lib/auth';
export async function GET(req:Request){try{assertOwner(req);return Response.json(integrationStatus())}catch(e){return jsonError(e)}}
