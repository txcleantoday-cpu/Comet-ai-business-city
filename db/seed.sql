INSERT INTO businesses(slug,name) VALUES
('solutions','Solutions Cleaning'),('aces','ACES Autos'),('creator','Creator Media'),('etsy','Etsy Publishing'),('media','Media Factory'),('assets','Asset Forge'),('command','Command Tower'),('analytics','Analytics Center')
ON CONFLICT(slug) DO UPDATE SET name=excluded.name;

INSERT INTO factories(business_id,slug,name,theme,map_config)
SELECT b.id,x.slug,x.name,x.theme::jsonb,x.map::jsonb FROM businesses b JOIN (VALUES
('solutions','Solutions Cleaning','{"accent":"#b56cff"}','{"x":90,"y":90,"w":320,"h":220}'),
('aces','ACES Autos','{"accent":"#79ff9d"}','{"x":790,"y":90,"w":320,"h":220}'),
('creator','Creator Media Factory','{"accent":"#53d8fb"}','{"x":90,"y":410,"w":300,"h":210}'),
('etsy','Etsy Publishing','{"accent":"#ffc857"}','{"x":450,"y":410,"w":300,"h":210}'),
('media','Media Factory','{"accent":"#ff7bbd"}','{"x":810,"y":410,"w":300,"h":210}'),
('assets','Asset Forge','{"accent":"#8ea1ff"}','{"x":450,"y":700,"w":300,"h":210}'),
('command','Command Tower','{"accent":"#79ff9d"}','{"x":450,"y":90,"w":300,"h":240}'),
('analytics','Analytics Center','{"accent":"#63f5cf"}','{"x":790,"y":700,"w":300,"h":210}')
) AS x(slug,name,theme,map) ON b.slug=x.slug
ON CONFLICT(slug) DO UPDATE SET name=excluded.name,theme=excluded.theme,map_config=excluded.map_config;

WITH A(factory_slug,slug,name,role) AS (VALUES
('solutions','solutions_manager','Maya','Factory Manager'),('solutions','lead_scout','Alex','Lead Scout'),('solutions','research_agent','Nora','Business Researcher'),('solutions','crm_clerk','Nina','CRM Clerk'),('solutions','qualifier','Quinn','Lead Qualifier'),('solutions','outreach_rep','Jordan','Outreach Rep'),('solutions','estimator','Sam','Estimator'),('solutions','approval_controller','Gate-S','Approval Controller'),
('aces','aces_manager','Marcus','Sales Director'),('aces','inventory_agent','Drew','Inventory Agent'),('aces','offer_agent','Owen','Offer Agent'),('aces','copywriter','Nova','Copywriter'),('aces','creative_agent','Frame-A','Creative Agent'),('aces','social_agent','Social-A','Social Agent'),('aces','approval_controller','Gate-A','Approval Controller'),
('creator','photo_librarian','Lena','Photo Librarian'),('creator','design_agent','Pixel','Design Agent'),('creator','mockup_agent','Milo','Mockup Agent'),('creator','seo_agent','Scout','SEO Agent'),('creator','qa_agent','Vera','QA Agent'),('creator','listing_agent','Eli','Listing Agent'),('creator','approval_controller','Gate-C','Approval Controller'),
('etsy','listing_agent','June','Listing Agent'),('etsy','approval_controller','Gate-E','Approval Controller'),
('media','media_manager','Remy','Media Manager'),('media','producer','Hook','Producer'),('media','approval_controller','Gate-M','Approval Controller'),
('assets','asset_manager','Forge','Asset Manager'),('assets','asset_builder','Mesh','Asset Builder'),('assets','approval_controller','Gate-F','Approval Controller'),
('command','commander','Atlas','Commander'),('command','approval_controller','Gate','Approval Controller'),('command','auditor','Trace','Run Auditor'),
('analytics','analyst','Delta','Business Analyst')
)
INSERT INTO agents(business_id,factory_id,slug,name,role)
SELECT f.business_id,f.id,a.slug,a.name,a.role FROM A a JOIN factories f ON f.slug=a.factory_slug
ON CONFLICT(factory_id,slug) DO UPDATE SET name=excluded.name,role=excluded.role;

INSERT INTO integration_state(provider,status) VALUES
('openai','disconnected'),('zoho','disconnected'),('google','disconnected'),('etsy','disconnected'),('retell','disconnected'),('meta','disconnected')
ON CONFLICT(provider) DO NOTHING;
