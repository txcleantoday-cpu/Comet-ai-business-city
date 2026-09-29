import {getMedia} from '@abc/db';
import {assertOwner,jsonError} from '../../../../lib/auth';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{assertOwner(req);const {id}=await params;const asset=await getMedia(id);if(!asset||!asset.blob_data)return Response.json({error:'not found'},{status:404});return new Response(new Uint8Array(asset.blob_data),{headers:{'content-type':asset.mime_type||'application/octet-stream','cache-control':'private, max-age=3600','content-disposition':`inline; filename="${String(asset.filename||'asset').replace(/"/g,'')}"`}})}catch(e){return jsonError(e)}}
