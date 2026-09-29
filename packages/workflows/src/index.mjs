import {routeFactory} from '@abc/core';

export const WORKFLOWS={
  solutions:{type:'lead_generation',steps:[
    ['parse_criteria','solutions_manager',0],
    ['research_companies','lead_scout',0],
    ['verify_contacts','research_agent',0],
    ['deduplicate','crm_clerk',0],
    ['score_leads','qualifier',0],
    ['generate_outreach','outreach_rep',0],
    ['approval_external_write','approval_controller',1],
    ['external_write','outreach_rep',1]
  ]},
  aces:{type:'campaign_generation',steps:[
    ['parse_campaign','aces_manager',0],
    ['generate_campaign','copywriter',0],
    ['approval_publish','approval_controller',1],
    ['publish_campaign','social_agent',1]
  ]},
  creator:{type:'creator_to_etsy',steps:[
    ['load_source_media','photo_librarian',0],
    ['analyze_media','photo_librarian',0],
    ['generate_product_ideas','design_agent',0],
    ['create_derivative','design_agent',0],
    ['create_mockup','mockup_agent',0],
    ['etsy_metadata','seo_agent',0],
    ['qa_disclosure','qa_agent',0],
    ['approval_etsy_draft','approval_controller',1],
    ['create_etsy_draft','listing_agent',1]
  ]},
  etsy:{type:'etsy_listing',steps:[
    ['validate_product','listing_agent',0],
    ['approval_etsy_draft','approval_controller',1],
    ['create_etsy_draft','listing_agent',1]
  ]},
  media:{type:'media_job',steps:[
    ['parse_media_request','media_manager',0],
    ['generate_media_plan','producer',0],
    ['approval_publish','approval_controller',1]
  ]},
  assets:{type:'asset_job',steps:[
    ['parse_asset_request','asset_manager',0],
    ['generate_asset_plan','asset_builder',0],
    ['approval_marketplace','approval_controller',1]
  ]},
  command:{type:'command_routing',steps:[['interpret_command','commander',0]]}
};

export function workflowForCommand(text,forcedFactory){
  const factory=forcedFactory||routeFactory(text);
  const workflow=WORKFLOWS[factory]||WORKFLOWS.command;
  return {factory,...workflow,steps:workflow.steps.map(([type,agent,risk],i)=>({sequence:i+1,type,agent,risk}))};
}
