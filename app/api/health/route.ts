import {integrationStatus} from '@abc/integrations';
export async function GET(){return Response.json({ok:true,phase:2,service:'ai-business-city',integrations:integrationStatus(),time:new Date().toISOString()})}
