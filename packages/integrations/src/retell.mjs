import {fetchJson,required} from './http.mjs';
export async function createPhoneCall({toNumber,fromNumber,agentId,dynamicVariables={}}){
  const key=required('RETELL_API_KEY');
  const body={from_number:fromNumber||required('RETELL_FROM_NUMBER'),to_number:toNumber,agent_id:agentId||process.env.RETELL_AGENT_ID,retell_llm_dynamic_variables:dynamicVariables};
  if(!body.agent_id)delete body.agent_id;
  return fetchJson('https://api.retellai.com/v2/create-phone-call',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json','accept':'application/json'},body:JSON.stringify(body)});
}
