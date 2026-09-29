export function assertOwner(req:Request){
  const expected=process.env.APP_OWNER_TOKEN;
  if(!expected)return;
  const supplied=req.headers.get('x-owner-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(supplied!==expected){const e:any=new Error('Unauthorized');e.status=401;throw e}
}
export function jsonError(e:any){return Response.json({error:e?.message||String(e)},{status:e?.status||500})}
