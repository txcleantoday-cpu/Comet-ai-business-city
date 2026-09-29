import pg from 'pg';
import {workflowForCommand} from '@abc/workflows';
const {Pool}=pg;
let pool;
export function db(){
  if(!pool){
    if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is not configured');
    pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:undefined,max:Number(process.env.PG_POOL_MAX||5)});
  }
  return pool;
}
export async function query(text,params=[]){return db().query(text,params)}
export async function tx(fn){const c=await db().connect();try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}

export async function appendEvent({jobId=null,factoryId=null,agentId=null,type,payload={}} ,client=db()){
  const r=await client.query(`INSERT INTO events(job_id,factory_id,agent_id,type,payload) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *`,[jobId,factoryId,agentId,type,JSON.stringify(payload)]);return r.rows[0];
}

export async function createJobFromCommand({text,requestedBy='owner',forcedFactory=null,input={}}){
  const wf=workflowForCommand(text,forcedFactory);
  return tx(async c=>{
    const business=(await c.query(`SELECT * FROM businesses WHERE slug=$1`,[wf.factory])).rows[0] || (await c.query(`SELECT * FROM businesses WHERE slug='command'`)).rows[0];
    const factory=(await c.query(`SELECT * FROM factories WHERE slug=$1`,[wf.factory])).rows[0] || (await c.query(`SELECT * FROM factories WHERE slug='command'`)).rows[0];
    const cmd=(await c.query(`INSERT INTO commands(text) VALUES($1) RETURNING *`,[text])).rows[0];
    const job=(await c.query(`INSERT INTO jobs(command_id,business_id,factory_id,type,requested_by,status,input_json) VALUES($1,$2,$3,$4,$5,'queued',$6::jsonb) RETURNING *`,[cmd.id,business?.id||null,factory?.id||null,wf.type,requestedBy,JSON.stringify({text,...input})])).rows[0];
    for(const step of wf.steps){
      const agent=(await c.query(`SELECT id FROM agents WHERE factory_id=$1 AND slug=$2 LIMIT 1`,[factory?.id||null,step.agent])).rows[0];
      await c.query(`INSERT INTO job_steps(job_id,agent_id,sequence,type,status,input_json) VALUES($1,$2,$3,$4,'queued',$5::jsonb)`,[job.id,agent?.id||null,step.sequence,step.type,JSON.stringify({risk:step.risk})]);
    }
    await appendEvent({jobId:job.id,factoryId:factory?.id,type:'job.created',payload:{text,factory:wf.factory,type:wf.type}},c);
    return {...job,factory:wf.factory,command_id:cmd.id};
  });
}

export async function createCreatorJob({sourceAssetId,notes='',collection='mixed',requestedBy='owner'}){
  const text=`Create Etsy-ready products from owned media ${sourceAssetId}`;
  return createJobFromCommand({text,requestedBy,forcedFactory:'creator',input:{sourceAssetId,notes,collection}});
}

export async function claimNextStep(workerId='worker'){
  return tx(async c=>{
    const r=await c.query(`
      SELECT js.*,j.factory_id,j.business_id,j.input_json AS job_input,j.status AS job_status,f.slug AS factory_slug,a.slug AS agent_slug
      FROM job_steps js
      JOIN jobs j ON j.id=js.job_id
      LEFT JOIN factories f ON f.id=j.factory_id
      LEFT JOIN agents a ON a.id=js.agent_id
      WHERE js.status='queued' AND j.status IN ('queued','running')
        AND NOT EXISTS (
          SELECT 1 FROM job_steps p WHERE p.job_id=js.job_id AND p.sequence<js.sequence AND p.status<>'completed'
        )
      ORDER BY j.priority DESC,j.created_at,js.sequence
      FOR UPDATE SKIP LOCKED LIMIT 1`);
    const step=r.rows[0];if(!step)return null;
    await c.query(`UPDATE job_steps SET status='running',attempt_count=attempt_count+1,started_at=COALESCE(started_at,now()),worker_id=$2 WHERE id=$1`,[step.id,workerId]);
    await c.query(`UPDATE jobs SET status='running',updated_at=now() WHERE id=$1`,[step.job_id]);
    if(step.agent_id)await c.query(`UPDATE agents SET status='working',current_job_id=$2 WHERE id=$1`,[step.agent_id,step.job_id]);
    await appendEvent({jobId:step.job_id,factoryId:step.factory_id,agentId:step.agent_id,type:'agent.started',payload:{step:step.type,workerId}},c);
    return step;
  });
}

export async function completeStep(stepId,output={}){
  return tx(async c=>{
    const step=(await c.query(`SELECT js.*,j.factory_id FROM job_steps js JOIN jobs j ON j.id=js.job_id WHERE js.id=$1 FOR UPDATE`,[stepId])).rows[0];if(!step)throw new Error('Step not found');
    await c.query(`UPDATE job_steps SET status='completed',output_json=$2::jsonb,completed_at=now(),error_json=NULL WHERE id=$1`,[stepId,JSON.stringify(output)]);
    if(step.agent_id)await c.query(`UPDATE agents SET status='idle',current_job_id=NULL WHERE id=$1`,[step.agent_id]);
    const remaining=Number((await c.query(`SELECT count(*)::int AS n FROM job_steps WHERE job_id=$1 AND status<>'completed'`,[step.job_id])).rows[0].n);
    await c.query(`UPDATE jobs SET status=$2,updated_at=now() WHERE id=$1`,[step.job_id,remaining===0?'completed':'running']);
    await appendEvent({jobId:step.job_id,factoryId:step.factory_id,agentId:step.agent_id,type:remaining===0?'job.completed':'step.completed',payload:{step:step.type,output}},c);
    return {jobId:step.job_id,remaining};
  });
}

export async function waitForApproval(stepId,{actionType,riskLevel=1,preview={}}){
  return tx(async c=>{
    const step=(await c.query(`SELECT js.*,j.factory_id FROM job_steps js JOIN jobs j ON j.id=js.job_id WHERE js.id=$1 FOR UPDATE`,[stepId])).rows[0];if(!step)throw new Error('Step not found');
    const existing=(await c.query(`SELECT * FROM approvals WHERE step_id=$1 AND status='pending'`,[stepId])).rows[0];
    const approval=existing||(await c.query(`INSERT INTO approvals(job_id,step_id,action_type,risk_level,preview_json) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *`,[step.job_id,step.id,actionType,riskLevel,JSON.stringify(preview)])).rows[0];
    await c.query(`UPDATE job_steps SET status='waiting_approval',output_json=$2::jsonb WHERE id=$1`,[stepId,JSON.stringify({approvalId:approval.id})]);
    await c.query(`UPDATE jobs SET status='waiting_approval',updated_at=now() WHERE id=$1`,[step.job_id]);
    if(step.agent_id)await c.query(`UPDATE agents SET status='approval_required' WHERE id=$1`,[step.agent_id]);
    await appendEvent({jobId:step.job_id,factoryId:step.factory_id,agentId:step.agent_id,type:'approval.requested',payload:{approvalId:approval.id,actionType,riskLevel}},c);
    return approval;
  });
}

export async function waitDependency(stepId,error){
  return tx(async c=>{
    const step=(await c.query(`SELECT js.*,j.factory_id FROM job_steps js JOIN jobs j ON j.id=js.job_id WHERE js.id=$1 FOR UPDATE`,[stepId])).rows[0];
    await c.query(`UPDATE job_steps SET status='waiting_dependency',error_json=$2::jsonb WHERE id=$1`,[stepId,JSON.stringify({message:error.message||String(error)})]);
    await c.query(`UPDATE jobs SET status='waiting_dependency',updated_at=now() WHERE id=$1`,[step.job_id]);
    if(step.agent_id)await c.query(`UPDATE agents SET status='waiting' WHERE id=$1`,[step.agent_id]);
    await appendEvent({jobId:step.job_id,factoryId:step.factory_id,agentId:step.agent_id,type:'job.waiting_dependency',payload:{step:step.type,message:error.message||String(error)}},c);
  });
}

export async function failStep(stepId,error){
  return tx(async c=>{
    const step=(await c.query(`SELECT js.*,j.factory_id FROM job_steps js JOIN jobs j ON j.id=js.job_id WHERE js.id=$1 FOR UPDATE`,[stepId])).rows[0];
    await c.query(`UPDATE job_steps SET status='failed',error_json=$2::jsonb,completed_at=now() WHERE id=$1`,[stepId,JSON.stringify({message:error.message||String(error),stack:process.env.NODE_ENV==='production'?undefined:error.stack})]);
    await c.query(`UPDATE jobs SET status='failed',updated_at=now() WHERE id=$1`,[step.job_id]);
    if(step.agent_id)await c.query(`UPDATE agents SET status='error',current_job_id=NULL WHERE id=$1`,[step.agent_id]);
    await appendEvent({jobId:step.job_id,factoryId:step.factory_id,agentId:step.agent_id,type:'job.failed',payload:{step:step.type,message:error.message||String(error)}},c);
  });
}

export async function resolveApproval(id,decision,reviewedBy=null){
  if(!['approved','rejected'].includes(decision))throw new Error('Invalid decision');
  return tx(async c=>{
    const a=(await c.query(`SELECT a.*,j.factory_id FROM approvals a JOIN jobs j ON j.id=a.job_id WHERE a.id=$1 FOR UPDATE`,[id])).rows[0];if(!a)throw new Error('Approval not found');if(a.status!=='pending')return a;
    await c.query(`UPDATE approvals SET status=$2,reviewed_at=now(),reviewed_by=$3 WHERE id=$1`,[id,decision,reviewedBy]);
    await c.query(`UPDATE job_steps SET status=$2,completed_at=CASE WHEN $2='completed' THEN now() ELSE completed_at END WHERE id=$1`,[a.step_id,decision==='approved'?'completed':'rejected']);
    await c.query(`UPDATE jobs SET status=$2,updated_at=now() WHERE id=$1`,[a.job_id,decision==='approved'?'running':'rejected']);
    await c.query(`UPDATE agents SET status='idle',current_job_id=NULL WHERE id=(SELECT agent_id FROM job_steps WHERE id=$1)`,[a.step_id]);
    await appendEvent({jobId:a.job_id,factoryId:a.factory_id,type:decision==='approved'?'approval.approved':'approval.rejected',payload:{approvalId:id}},c);
    return {...a,status:decision};
  });
}

export async function retryJob(id){
  return tx(async c=>{
    const step=(await c.query(`SELECT * FROM job_steps WHERE job_id=$1 AND status IN ('failed','waiting_dependency') ORDER BY sequence LIMIT 1 FOR UPDATE`,[id])).rows[0];
    if(!step)throw new Error('No failed or waiting dependency step found');
    await c.query(`UPDATE job_steps SET status='queued',error_json=NULL,worker_id=NULL WHERE id=$1`,[step.id]);
    await c.query(`UPDATE jobs SET status='queued',updated_at=now() WHERE id=$1`,[id]);
    if(step.agent_id)await c.query(`UPDATE agents SET status='idle',current_job_id=NULL WHERE id=$1`,[step.agent_id]);
    await appendEvent({jobId:id,type:'job.retried',payload:{step:step.type}},c);return step;
  });
}

export async function getPriorOutputs(jobId){const r=await query(`SELECT type,output_json,status FROM job_steps WHERE job_id=$1 AND status='completed' ORDER BY sequence`,[jobId]);return Object.fromEntries(r.rows.map(x=>[x.type,x.output_json]))}
export async function getJob(id){const j=(await query(`SELECT j.*,f.slug factory_slug FROM jobs j LEFT JOIN factories f ON f.id=j.factory_id WHERE j.id=$1`,[id])).rows[0];if(!j)return null;const steps=(await query(`SELECT js.*,a.name agent_name,a.slug agent_slug FROM job_steps js LEFT JOIN agents a ON a.id=js.agent_id WHERE js.job_id=$1 ORDER BY sequence`,[id])).rows;return {...j,steps}}

export async function listState(){
  const [jobs,approvals,events,agents,factories,products,integrations]=await Promise.all([
    query(`SELECT j.id,j.type,j.status,j.input_json,j.created_at,j.updated_at,f.slug factory_slug,(SELECT count(*) FROM job_steps s WHERE s.job_id=j.id AND s.status='completed')::int completed_steps,(SELECT count(*) FROM job_steps s WHERE s.job_id=j.id)::int total_steps FROM jobs j LEFT JOIN factories f ON f.id=j.factory_id ORDER BY j.created_at DESC LIMIT 100`),
    query(`SELECT a.*,f.slug factory_slug FROM approvals a JOIN jobs j ON j.id=a.job_id LEFT JOIN factories f ON f.id=j.factory_id ORDER BY requested_at DESC LIMIT 100`),
    query(`SELECT e.*,f.slug factory_slug,a.name agent_name FROM events e LEFT JOIN factories f ON f.id=e.factory_id LEFT JOIN agents a ON a.id=e.agent_id ORDER BY created_at DESC LIMIT 150`),
    query(`SELECT a.id,a.slug,a.name,a.role,a.status,a.current_job_id,f.slug factory_slug FROM agents a LEFT JOIN factories f ON f.id=a.factory_id ORDER BY f.slug,a.name`),
    query(`SELECT id,slug,name,theme,map_config FROM factories ORDER BY name`),
    query(`SELECT p.*,m.asset_type source_type FROM products p LEFT JOIN media_assets m ON m.id=p.source_asset_id ORDER BY p.created_at DESC LIMIT 50`),
    query(`SELECT * FROM integration_state ORDER BY provider`)
  ]);
  return {jobs:jobs.rows,approvals:approvals.rows,events:events.rows,agents:agents.rows,factories:factories.rows,products:products.rows,integrations:integrations.rows};
}

export async function storeMedia({ownerId=null,sourceAssetId=null,assetType,lineage='original',bytes,mimeType,width=null,height=null,rightsStatus='owner_supplied',aiModified=false,aiGenerated=false,filename='',metadata={}}){
  const checksum=(await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');
  const r=await query(`INSERT INTO media_assets(owner_id,source_asset_id,asset_type,lineage,storage_url,mime_type,width,height,checksum,rights_status,ai_modified,ai_generated,filename,metadata,blob_data) VALUES($1,$2,$3,$4,'db://media',$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14) RETURNING *`,[ownerId,sourceAssetId,assetType,lineage,mimeType,width,height,checksum,rightsStatus,aiModified,aiGenerated,filename,JSON.stringify(metadata),Buffer.from(bytes)]);return r.rows[0];
}
export async function getMedia(id){return (await query(`SELECT * FROM media_assets WHERE id=$1`,[id])).rows[0]||null}
export async function createProduct({sourceAssetId,name,productType='digital_download',metadata={},qaState='pending',approvalState='pending'}){return (await query(`INSERT INTO products(source_asset_id,name,product_type,metadata,qa_state,approval_state) VALUES($1,$2,$3,$4::jsonb,$5,$6) RETURNING *`,[sourceAssetId,name,productType,JSON.stringify(metadata),qaState,approvalState])).rows[0]}
export async function updateProduct(id,patch){const sets=[],vals=[];let n=1;for(const[k,v]of Object.entries(patch)){sets.push(`${k}=$${n++}${k==='metadata'?'::jsonb':''}`);vals.push(k==='metadata'?JSON.stringify(v):v)}if(!sets.length)return null;vals.push(id);return (await query(`UPDATE products SET ${sets.join(',')} WHERE id=$${n} RETURNING *`,vals)).rows[0]}
export async function createEtsyListingRecord({productId,externalListingId=null,status='draft',metadata={},aiDisclosure=true}){return (await query(`INSERT INTO etsy_listings(product_id,external_listing_id,status,metadata,ai_disclosure) VALUES($1,$2,$3,$4::jsonb,$5) RETURNING *`,[productId,externalListingId,status,JSON.stringify(metadata),aiDisclosure])).rows[0]}
export async function insertLead({businessId,company,contact,status='qualified',score=0,source='agent',crmExternalId=null}){
  return tx(async c=>{const co=(await c.query(`INSERT INTO companies(name,website,industry,city,state,external_json) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,[company.name,company.website||null,company.industry||null,company.city||null,company.state||null,JSON.stringify(company.external||{})])).rows[0];const ct=(await c.query(`INSERT INTO contacts(company_id,name,email,phone,title) VALUES($1,$2,$3,$4,$5) RETURNING *`,[co.id,contact?.name||null,contact?.email||null,contact?.phone||null,contact?.title||null])).rows[0];return (await c.query(`INSERT INTO leads(business_id,company_id,contact_id,status,score,source,crm_external_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[businessId,co.id,ct.id,status,score,source,crmExternalId])).rows[0]})
}
export async function findLeadDuplicate({email,phone,companyName}){const r=await query(`SELECT l.id,c.name,ct.email,ct.phone FROM leads l JOIN companies c ON c.id=l.company_id LEFT JOIN contacts ct ON ct.id=l.contact_id WHERE ($1::text IS NOT NULL AND lower(ct.email)=lower($1)) OR ($2::text IS NOT NULL AND regexp_replace(ct.phone,'\\D','','g')=regexp_replace($2,'\\D','','g')) OR lower(c.name)=lower($3) LIMIT 1`,[email||null,phone||null,companyName]);return r.rows[0]||null}
export async function integrationUpsert(provider,status,metadata={}){return (await query(`INSERT INTO integration_state(provider,status,metadata,updated_at) VALUES($1,$2,$3::jsonb,now()) ON CONFLICT(provider) DO UPDATE SET status=excluded.status,metadata=excluded.metadata,updated_at=now() RETURNING *`,[provider,status,JSON.stringify(metadata)])).rows[0]}

export async function getExternalAction(key){return (await query(`SELECT * FROM external_actions WHERE idempotency_key=$1`,[key])).rows[0]||null}
export async function startExternalAction({key,provider,jobId,stepId,actionType}){return (await query(`INSERT INTO external_actions(idempotency_key,provider,job_id,step_id,action_type,status) VALUES($1,$2,$3,$4,$5,'started') ON CONFLICT(idempotency_key) DO UPDATE SET updated_at=now() RETURNING *`,[key,provider,jobId,stepId,actionType])).rows[0]}
export async function finishExternalAction(key,response){return (await query(`UPDATE external_actions SET status='completed',response_json=$2::jsonb,error_json=NULL,updated_at=now() WHERE idempotency_key=$1 RETURNING *`,[key,JSON.stringify(response||{})])).rows[0]}
export async function failExternalAction(key,error){return (await query(`UPDATE external_actions SET status='failed',error_json=$2::jsonb,updated_at=now() WHERE idempotency_key=$1 RETURNING *`,[key,JSON.stringify({message:error.message||String(error)})])).rows[0]}
export async function getFactoryBusinessId(slug){return (await query(`SELECT business_id FROM factories WHERE slug=$1`,[slug])).rows[0]?.business_id||null}

export async function listVehicles(){return (await query(`SELECT * FROM vehicles ORDER BY status,year DESC,make,model`)).rows}
export async function createVehicle(v){return (await query(`INSERT INTO vehicles(stock_number,year,make,model,trim,vin,mileage,asking_price,offer_down_payment,status,photos,campaign_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12) RETURNING *`,[v.stockNumber||null,v.year||null,v.make||null,v.model||null,v.trim||null,v.vin||null,v.mileage||null,v.askingPrice||null,v.offerDownPayment||null,v.status||'available',JSON.stringify(v.photos||[]),v.campaignStatus||null])).rows[0]}
export async function createCampaignRecord({businessId,vehicleId=null,type='social',status='draft',brief={},external={}}){return (await query(`INSERT INTO campaigns(business_id,vehicle_id,type,status,brief,external_json) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb) RETURNING *`,[businessId,vehicleId,type,status,JSON.stringify(brief),JSON.stringify(external)])).rows[0]}
export async function recordWebhook({provider,externalId,payload}){return tx(async c=>{const existing=(await c.query(`SELECT * FROM webhook_events WHERE provider=$1 AND external_id=$2`,[provider,externalId])).rows[0];if(existing)return {duplicate:true,event:existing};const ev=(await c.query(`INSERT INTO webhook_events(provider,external_id,payload) VALUES($1,$2,$3::jsonb) RETURNING *`,[provider,externalId,JSON.stringify(payload)])).rows[0];return {duplicate:false,event:ev}})}
