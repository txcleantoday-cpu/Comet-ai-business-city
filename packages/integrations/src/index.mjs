export * as openai from './openai.mjs';
export * as zoho from './zoho.mjs';
export * as google from './google.mjs';
export * as etsy from './etsy.mjs';
export * as retell from './retell.mjs';
export * as meta from './meta.mjs';
export {configured,required,fetchJson} from './http.mjs';

export function integrationStatus(){
  return {
    openai:Boolean(process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL),
    zoho:Boolean(process.env.ZOHO_ACCESS_TOKEN||(process.env.ZOHO_REFRESH_TOKEN&&process.env.ZOHO_CLIENT_ID&&process.env.ZOHO_CLIENT_SECRET)),
    google:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_REFRESH_TOKEN),
    etsy:Boolean(process.env.ETSY_KEYSTRING&&process.env.ETSY_SHARED_SECRET&&(process.env.ETSY_ACCESS_TOKEN||process.env.ETSY_REFRESH_TOKEN)&&process.env.ETSY_SHOP_ID),
    retell:Boolean(process.env.RETELL_API_KEY&&process.env.RETELL_FROM_NUMBER),
    meta:Boolean(process.env.META_GRAPH_VERSION&&process.env.META_ACCESS_TOKEN&&process.env.META_PAGE_ID)
  };
}
