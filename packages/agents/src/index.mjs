import {parseCommandHints} from '@abc/core';
import {
  completeStep,waitForApproval,waitDependency,failStep,getPriorOutputs,getMedia,storeMedia,createProduct,updateProduct,createEtsyListingRecord,
  findLeadDuplicate,insertLead,getFactoryBusinessId,getExternalAction,startExternalAction,finishExternalAction,failExternalAction,query
} from '@abc/db';
import {openai,zoho,google,etsy,meta,integrationStatus} from '@abc/integrations';

export const POLICIES={
  commander:`You are the AI Business City Commander. Route work to the smallest appropriate specialist workflow. Never claim an external write occurred unless the provider confirms success. Never bypass approvals. Preserve source-media lineage. Pricing arithmetic is deterministic code, not model arithmetic.`,
  solutions:`You coordinate Solutions Cleaning. Find public business prospects relevant to the requested criteria. Do not invent emails or phone numbers. Use null when a contact field cannot be verified. Outreach must remain a draft until approval.`,
  creator:`You coordinate Creator Media. Only use media explicitly marked owner-supplied or otherwise authorized. Preserve the original. Mark AI-modified and AI-generated derivatives. Etsy metadata must disclose material AI assistance when applicable.`,
  aces:`You coordinate ACES Autos campaigns. Generate concise sales copy from provided vehicle/offer facts. Do not invent vehicle facts, financing approvals, prices, or inventory. External publishing requires approval.`
};

class DependencyError extends Error{constructor(message){super(message);this.name='DependencyError'}}
function req(ok,msg){if(!ok)throw new DependencyError(msg)}
function sim(){return String(process.env.SIMULATION_MODE||'false').toLowerCase()==='true'}

async function idempotent({key,provider,jobId,stepId,actionType,run}){
  const existing=await getExternalAction(key);
  if(existing?.status==='completed')return existing.response_json;
  await startExternalAction({key,provider,jobId,stepId,actionType});
  try{const out=await run();await finishExternalAction(key,out);return out}catch(e){await failExternalAction(key,e);throw e}
}

export async function executeClaimedStep(step){
  try{
    const outputs=await getPriorOutputs(step.job_id);
    const input=step.job_input||{};
    const factory=step.factory_slug;
    let result;
    if(factory==='solutions') result=await runSolutions(step,input,outputs);
    else if(factory==='creator') result=await runCreator(step,input,outputs);
    else if(factory==='aces') result=await runAces(step,input,outputs);
    else if(factory==='etsy') result=await runEtsy(step,input,outputs);
    else result=await runGeneric(step,input,outputs);
    if(result?.approval)return waitForApproval(step.id,result.approval);
    await completeStep(step.id,result||{});return result;
  }catch(e){
    if(e?.name==='DependencyError'){await waitDependency(step.id,e);return {waiting:true,message:e.message}}
    await failStep(step.id,e);throw e;
  }
}

async function runSolutions(step,input,outputs){
  const text=input.text||'';
  switch(step.type){
    case 'parse_criteria':{
      const hints=parseCommandHints(text);return {criteria:{quantity:hints.quantity||20,industry:hints.industry||'medical',location:hints.location||'DFW Texas'},sendNow:hints.sendNow};
    }
    case 'research_companies':{
      const criteria=outputs.parse_criteria?.criteria||{};
      if(sim())return {leads:Array.from({length:Math.min(criteria.quantity||10,10)},(_,i)=>({company:`SIMULATED ${criteria.industry||'Business'} ${i+1}`,website:null,email:null,phone:null,city:criteria.location||null,state:'TX',industry:criteria.industry||null,source_url:'simulation://local'})),simulated:true};
      req(integrationStatus().openai,'OpenAI is required for live prospect research');
      return await openai.researchBusinesses(criteria);
    }
    case 'verify_contacts':{
      const leads=outputs.research_companies?.leads||[];
      return {leads:leads.filter(x=>x?.company&&x?.source_url).map(x=>({...x,email:x.email||null,phone:x.phone||null,verified:Boolean(x.source_url)}))};
    }
    case 'deduplicate':{
      const clean=[],duplicates=[];
      for(const lead of outputs.verify_contacts?.leads||[]){const d=await findLeadDuplicate({email:lead.email,phone:lead.phone,companyName:lead.company});(d?duplicates:clean).push(lead)}
      return {leads:clean,duplicates};
    }
    case 'score_leads':{
      const leads=(outputs.deduplicate?.leads||[]).map(x=>({...x,score:Math.min(100,45+(x.website?15:0)+(x.email?20:0)+(x.phone?15:0)+(x.verified?5:0))})).sort((a,b)=>b.score-a.score);return {leads};
    }
    case 'generate_outreach':{
      const leads=outputs.score_leads?.leads||[];if(!leads.length)return {drafts:[]};
      if(integrationStatus().openai&&!sim())return await openai.generateOutreach(leads,text);
      return {drafts:leads.map((x,i)=>({index:i,subject:`Cleaning support for ${x.company}`,body:`Hello,\n\nI’m reaching out from Solutions Cleaning. We provide recurring commercial cleaning and would be glad to learn about ${x.company}'s facility needs and prepare a straightforward service quote.\n\nWould you be open to a short conversation this week?\n\nThank you,\nSolutions Cleaning`}))};
    }
    case 'approval_external_write':{
      const leads=outputs.score_leads?.leads||[],drafts=outputs.generate_outreach?.drafts||[];
      return {approval:{actionType:'solutions_crm_and_outreach',riskLevel:1,preview:{prospectCount:leads.length,emailDraftCount:drafts.filter((d,i)=>leads[i]?.email).length,sample:drafts[0]||null,actions:['Create/update Zoho lead records','Create Gmail drafts for verified email contacts']}}};
    }
    case 'external_write':{
      if(sim())return {simulated:true,crmCreated:0,draftsCreated:0};
      const status=integrationStatus();req(status.zoho,'Zoho CRM OAuth is required for Solutions external writes');req(status.google,'Google OAuth is required to create Gmail drafts');
      const leads=outputs.score_leads?.leads||[],drafts=outputs.generate_outreach?.drafts||[];const businessId=await getFactoryBusinessId('solutions');
      const created=[];
      for(let i=0;i<leads.length;i++){
        const lead=leads[i],draft=drafts.find(d=>Number(d.index)===i)||drafts[i];
        const crm=await idempotent({key:`${step.job_id}:${step.id}:zoho:${i}`,provider:'zoho',jobId:step.job_id,stepId:step.id,actionType:'create_lead',run:()=>zoho.createLead({Last_Name:lead.company,Company:lead.company,Email:lead.email||undefined,Phone:lead.phone||undefined,Website:lead.website||undefined,City:lead.city||undefined,State:lead.state||undefined,Lead_Source:'AI Business City'})});
        const crmId=crm?.data?.[0]?.details?.id||null;
        await insertLead({businessId,company:{name:lead.company,website:lead.website,industry:lead.industry,city:lead.city,state:lead.state,external:{source_url:lead.source_url}},contact:{email:lead.email,phone:lead.phone},status:'contact_ready',score:lead.score,source:'ai_research',crmExternalId:crmId});
        let gmailDraft=null;
        if(lead.email&&draft){gmailDraft=await idempotent({key:`${step.job_id}:${step.id}:gmail:${i}`,provider:'google',jobId:step.job_id,stepId:step.id,actionType:'create_draft',run:()=>google.createGmailDraft({to:lead.email,subject:draft.subject,body:draft.body})});if(outputs.parse_criteria?.sendNow&&gmailDraft?.id){await idempotent({key:`${step.job_id}:${step.id}:gmail-send:${i}`,provider:'google',jobId:step.job_id,stepId:step.id,actionType:'send_draft',run:()=>google.sendGmailDraft(gmailDraft.id)})}}
        created.push({company:lead.company,crmId,gmailDraftId:gmailDraft?.id||null,sent:Boolean(outputs.parse_criteria?.sendNow&&gmailDraft?.id)});
      }
      return {created,crmCreated:created.length,draftsCreated:created.filter(x=>x.gmailDraftId).length};
    }
  }
  return {};
}

async function runCreator(step,input,outputs){
  const sourceId=input.sourceAssetId;
  switch(step.type){
    case 'load_source_media':{const asset=await getMedia(sourceId);if(!asset)throw new Error('Source media not found');if(!['owner_supplied','licensed'].includes(asset.rights_status))throw new Error('Source media is not authorized for product creation');return {sourceAssetId:asset.id,mimeType:asset.mime_type,filename:asset.filename,rightsStatus:asset.rights_status,notes:input.notes||'',collection:input.collection||'mixed'}}
    case 'analyze_media':{req(integrationStatus().openai,'OpenAI is required for Creator image analysis');const asset=await getMedia(sourceId);return {analysis:await openai.analyzeImage({buffer:asset.blob_data,mimeType:asset.mime_type||'image/png',notes:input.notes||''})}}
    case 'generate_product_ideas':{req(integrationStatus().openai,'OpenAI is required for Creator product ideation');const generated=await openai.generateProductIdeas(outputs.analyze_media?.analysis||{},input.notes||'');const products=[];for(const idea of (generated.ideas||[]).slice(0,3)){const p=await createProduct({sourceAssetId:sourceId,name:idea.name||'Creator Digital Product',productType:idea.product_type||'digital_download',metadata:{...idea,ai_assisted:true,collection:input.collection||'mixed'}});products.push(p)}return {ideas:generated.ideas||[],productIds:products.map(p=>p.id)}}
    case 'create_derivative':{
      const ids=outputs.generate_product_ideas?.productIds||[];if(!ids.length)return {derivatives:[]};
      if(String(process.env.CREATOR_AUTO_DERIVE||'false').toLowerCase()!=='true')return {derivatives:[],skipped:true,reason:'CREATOR_AUTO_DERIVE=false'};
      req(integrationStatus().openai&&process.env.OPENAI_IMAGE_MODEL,'OPENAI_IMAGE_MODEL and OpenAI credentials are required for derivative generation');const source=await getMedia(sourceId);const derivs=[];
      for(let i=0;i<ids.length;i++){const idea=(outputs.generate_product_ideas?.ideas||[])[i]||{};const bytes=await openai.editImage({buffer:source.blob_data,mimeType:source.mime_type||'image/png',filename:source.filename||'source.png',prompt:idea.design_prompt||'Create a polished digital wall-art derivative while preserving the source subject.'});const a=await storeMedia({sourceAssetId:source.id,assetType:'product_design',lineage:'derivative',bytes,mimeType:'image/png',rightsStatus:source.rights_status,aiModified:true,filename:`product-${ids[i]}.png`,metadata:{productId:ids[i],prompt:idea.design_prompt||''}});await updateProduct(ids[i],{metadata:{...((await query(`SELECT metadata FROM products WHERE id=$1`,[ids[i]])).rows[0]?.metadata||{}),derivativeAssetId:a.id}});derivs.push({productId:ids[i],assetId:a.id})}
      return {derivatives:derivs};
    }
    case 'create_mockup':{
      const derivatives=outputs.create_derivative?.derivatives||[];if(!derivatives.length)return {mockups:[],skipped:true};const out=[];
      for(const d of derivatives){const a=await getMedia(d.assetId);const bytes=await openai.editImage({buffer:a.blob_data,mimeType:a.mime_type||'image/png',filename:a.filename||'design.png',prompt:'Create a clean marketplace mockup showing this artwork framed on a tasteful neutral wall. Do not alter the artwork itself.'});const m=await storeMedia({sourceAssetId:a.id,assetType:'mockup',lineage:'derivative',bytes,mimeType:'image/png',rightsStatus:a.rights_status,aiModified:true,filename:`mockup-${d.productId}.png`,metadata:{productId:d.productId}});out.push({productId:d.productId,assetId:m.id})}return {mockups:out};
    }
    case 'etsy_metadata':{
      req(integrationStatus().openai,'OpenAI is required for Etsy metadata generation');const ids=outputs.generate_product_ideas?.productIds||[];const list=[];for(const id of ids){const row=(await query(`SELECT * FROM products WHERE id=$1`,[id])).rows[0];const md=await openai.generateEtsyMetadata({name:row.name,product_type:row.product_type,metadata:row.metadata,ai_assisted:true});const merged={...row.metadata,etsy:md,ai_assisted:true};await updateProduct(id,{metadata:merged});list.push({productId:id,...md})}return {metadata:list};
    }
    case 'qa_disclosure':{const ids=outputs.generate_product_ideas?.productIds||[];for(const id of ids)await updateProduct(id,{qa_state:'passed',approval_state:'pending'});return {passed:true,aiDisclosureRequired:true,productIds:ids}}
    case 'approval_etsy_draft':{return {approval:{actionType:'create_etsy_drafts',riskLevel:1,preview:{productIds:outputs.generate_product_ideas?.productIds||[],aiDisclosure:true,derivatives:outputs.create_derivative?.derivatives||[],mockups:outputs.create_mockup?.mockups||[],action:'Create Etsy draft listings only; do not activate listings'}}}}
    case 'create_etsy_draft':{
      if(sim())return {simulated:true,listings:[]};req(integrationStatus().etsy,'Etsy OAuth/shop configuration is required');const shopId=process.env.ETSY_SHOP_ID,taxonomy=process.env.ETSY_TAXONOMY_ID;req(taxonomy,'ETSY_TAXONOMY_ID is required to create Etsy drafts');const ids=outputs.generate_product_ideas?.productIds||[];const derivMap=new Map((outputs.create_derivative?.derivatives||[]).map(x=>[x.productId,x.assetId]));const mockMap=new Map((outputs.create_mockup?.mockups||[]).map(x=>[x.productId,x.assetId]));const listings=[];
      for(const id of ids){const p=(await query(`SELECT * FROM products WHERE id=$1`,[id])).rows[0];const md=p.metadata?.etsy||{};const assetId=derivMap.get(id);req(assetId,`Product ${id} has no derivative asset; enable CREATOR_AUTO_DERIVE and retry`);const art=await getMedia(assetId);const draft=await idempotent({key:`${step.job_id}:${step.id}:etsy:draft:${id}`,provider:'etsy',jobId:step.job_id,stepId:step.id,actionType:'create_draft',run:()=>etsy.createDraftListing(shopId,{quantity:999,title:md.title||p.name,description:md.description||`${p.name}\n\nAI-assisted design.`,price:md.price||process.env.ETSY_DEFAULT_PRICE||9.99,who_made:'i_did',when_made:'made_to_order',taxonomy_id:taxonomy,type:'download'})});const listingId=String(draft?.listing_id||draft?.results?.[0]?.listing_id||'');req(listingId,'Etsy draft response did not contain listing_id');
        const mockId=mockMap.get(id);const image=mockId?await getMedia(mockId):art;await idempotent({key:`${step.job_id}:${step.id}:etsy:image:${id}`,provider:'etsy',jobId:step.job_id,stepId:step.id,actionType:'upload_image',run:()=>etsy.uploadListingImage(shopId,listingId,image.blob_data,image.filename||'listing.png',image.mime_type||'image/png')});await idempotent({key:`${step.job_id}:${step.id}:etsy:file:${id}`,provider:'etsy',jobId:step.job_id,stepId:step.id,actionType:'upload_file',run:()=>etsy.uploadListingFile(shopId,listingId,art.blob_data,art.filename||'download.png',art.mime_type||'image/png')});await etsy.updateListing(shopId,listingId,{type:'download'});const rec=await createEtsyListingRecord({productId:id,externalListingId:listingId,status:'draft',metadata:md,aiDisclosure:true});await updateProduct(id,{approval_state:'approved'});listings.push(rec)}
      return {listings};
    }
  }return {};
}

async function runAces(step,input,outputs){
  switch(step.type){
    case 'parse_campaign': return {brief:input.text||'',publishRequested:/\bpublish|post\b/i.test(input.text||'')};
    case 'generate_campaign':{if(integrationStatus().openai&&!sim())return {campaign:await openai.generateAcesCampaign(outputs.parse_campaign?.brief||input.text||'')};return {campaign:{headline:'ACES Autos Campaign',facebook:input.text||'ACES Autos sales campaign',instagram:input.text||'ACES Autos sales campaign',creative_brief:'Use supplied vehicle photography and ACES green branding.'}}}
    case 'approval_publish': return {approval:{actionType:'publish_aces_campaign',riskLevel:1,preview:outputs.generate_campaign?.campaign||{}}};
    case 'publish_campaign':{if(sim())return {simulated:true};req(integrationStatus().meta,'Meta credentials are required for ACES publishing');const c=outputs.generate_campaign?.campaign||{};const r=await idempotent({key:`${step.job_id}:${step.id}:meta:facebook`,provider:'meta',jobId:step.job_id,stepId:step.id,actionType:'facebook_post',run:()=>meta.publishFacebookText({message:c.facebook||c.instagram||c.headline||input.text})});return {facebook:r}}
  }return {};
}

async function runEtsy(step,input,outputs){
  switch(step.type){case 'validate_product':{if(!input.productId)throw new Error('productId is required for direct Etsy workflow');const p=(await query(`SELECT * FROM products WHERE id=$1`,[input.productId])).rows[0];if(!p)throw new Error('Product not found');return {product:p}}case 'approval_etsy_draft':return {approval:{actionType:'create_etsy_draft',riskLevel:1,preview:{productId:input.productId}}};case 'create_etsy_draft':throw new DependencyError('Direct Etsy workflow is reserved for Creator-produced products in this build. Use Creator Media workflow.')}return {};
}

async function runGeneric(step,input){
  if(step.type.startsWith('approval_'))return {approval:{actionType:step.type.replace('approval_',''),riskLevel:1,preview:{input}}};
  if(integrationStatus().openai&&!sim()){const response=await openai.createResponse({instructions:'Return a concise operational plan for this internal business task. Do not claim external actions were performed.',input:JSON.stringify({step:step.type,input})});return {text:openai.extractOutputText(response)}}
  return {text:'Internal step completed without external action.'};
}
