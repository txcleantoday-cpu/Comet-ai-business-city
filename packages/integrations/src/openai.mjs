import {fetchJson,required} from './http.mjs';
import {safeJsonParse} from '@abc/core';

function key(){return required('OPENAI_API_KEY')}
function model(){return required('OPENAI_MODEL')}
function headers(){return {authorization:`Bearer ${key()}`,'content-type':'application/json'}}

export async function createResponse({instructions,input,tools,reasoning}){
  const body={model:model(),instructions,input};
  if(tools?.length) body.tools=tools;
  if(reasoning) body.reasoning=reasoning;
  return fetchJson('https://api.openai.com/v1/responses',{method:'POST',headers:headers(),body:JSON.stringify(body)},120000);
}

export function extractOutputText(response){
  if(typeof response?.output_text==='string') return response.output_text;
  const out=[];
  for(const item of response?.output||[]){
    for(const c of item?.content||[]){
      if(typeof c?.text==='string') out.push(c.text);
      else if(typeof c?.text?.value==='string') out.push(c.text.value);
    }
  }
  return out.join('\n').trim();
}

export async function generateJson({instructions,prompt,web=false}){
  const response=await createResponse({instructions,input:prompt,tools:web?[{type:'web_search'}]:undefined});
  return safeJsonParse(extractOutputText(response));
}

export async function researchBusinesses(criteria){
  return generateJson({
    web:true,
    instructions:`Research public business prospects. Return JSON only: {"leads":[{"company":"","website":null,"email":null,"phone":null,"city":null,"state":null,"industry":null,"source_url":""}]}. Never invent contact details. Use null when not verified. Prefer official websites and public business pages.`,
    prompt:`Find up to ${criteria.quantity||20} businesses matching: industry=${criteria.industry||'commercial'}; location=${criteria.location||'DFW Texas'}. This is for business-to-business cleaning-service prospecting. Return public business contact information only.`
  });
}

export async function generateOutreach(leads,brief){
  return generateJson({
    instructions:`Write concise B2B cleaning outreach. Return JSON only: {"drafts":[{"index":0,"subject":"","body":""}]}. Do not claim prior contact or facts not provided. Keep each email under 130 words and ask for a short facility-cleaning conversation.`,
    prompt:JSON.stringify({brief,leads:leads.map((x,i)=>({index:i,company:x.company,industry:x.industry,city:x.city}))})
  });
}

export async function generateAcesCampaign(brief){
  return generateJson({
    instructions:`Create dealership social campaign copy from only the facts supplied. Return JSON only: {"headline":"","facebook":"","instagram":"","creative_brief":""}. Do not promise approval or invent vehicle facts.`,
    prompt:brief
  });
}

export async function analyzeImage({buffer,mimeType,notes=''}){
  const dataUrl=`data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
  const response=await createResponse({
    instructions:`Analyze owner-supplied media for product creation. Return JSON only with subject, visual_style, safe_product_uses (array), risks (array), and suggested_collections (array). Do not identify a real person by name unless provided in the notes.`,
    input:[{role:'user',content:[{type:'input_text',text:`Notes: ${notes||'none'}`},{type:'input_image',image_url:dataUrl}]}]
  });
  return safeJsonParse(extractOutputText(response));
}

export async function generateProductIdeas(analysis,notes=''){
  return generateJson({
    instructions:`Create sellable digital-product concepts from an authorized image. Return JSON only: {"ideas":[{"name":"","product_type":"digital_download","design_prompt":"","mockup_prompt":"","etsy_angle":"","suggested_price":9.99}]}. Avoid trademarks or unsupported claims.`,
    prompt:JSON.stringify({analysis,notes})
  });
}

export async function generateEtsyMetadata(product){
  return generateJson({
    instructions:`Prepare Etsy metadata for an AI-assisted digital product. Return JSON only: {"title":"","description":"","tags":[],"price":9.99}. Keep tags concise. Description must disclose that AI tools assisted in creating or modifying the design when ai_assisted=true.`,
    prompt:JSON.stringify(product)
  });
}

export async function editImage({buffer,mimeType,prompt,filename='source.png'}){
  const imageModel=required('OPENAI_IMAGE_MODEL');
  const form=new FormData();
  form.append('model',imageModel);
  form.append('prompt',prompt);
  form.append('image',new Blob([buffer],{type:mimeType}),filename);
  const response=await fetchJson('https://api.openai.com/v1/images/edits',{method:'POST',headers:{authorization:`Bearer ${key()}`},body:form},180000);
  const item=response?.data?.[0];
  if(item?.b64_json) return Buffer.from(item.b64_json,'base64');
  if(item?.url){const r=await fetch(item.url);if(!r.ok)throw new Error(`Image download failed: ${r.status}`);return Buffer.from(await r.arrayBuffer())}
  throw new Error('Image edit response did not include image bytes');
}
