// Local, read-only PostgREST-shaped fixture for browser QA. Uses the actual SQL migration.
// No production credentials, no outbound connections, and no writable HTTP routes.
import http from 'node:http';
import { createPricingFixture } from './lib/pricing-fixture.mjs';
const db = await createPricingFixture();
const rows = async (sql, args=[]) => (await db.query(sql,args)).rows;
const server = http.createServer(async (req,res) => {
 res.setHeader('Content-Type','application/json');
 res.setHeader('Access-Control-Allow-Origin','*');
 const url=new URL(req.url,'http://127.0.0.1:54329');
 try {
  if(req.method!=='GET') {res.statusCode=405;res.end(JSON.stringify({message:'Read-only local fixture'}));return;}
  const table=url.pathname.replace('/rest/v1/','');
  let data;
  if(table==='products') {
   data=await rows(`select p.*,coalesce((select jsonb_agg(to_jsonb(v)) from public.product_variants v where v.product_id=p.id),'[]') as product_variants,
    coalesce((select jsonb_agg(to_jsonb(i)) from public.product_images i where i.product_id=p.id),'[]') as product_images
    from public.products p where p.status='active' and p.is_visible and p.deleted_at is null order by sort_order`);
  } else if(table==='product_variants') {
   data=await rows(`select v.*,to_jsonb(p)||jsonb_build_object('product_images',coalesce((select jsonb_agg(to_jsonb(i)) from public.product_images i where i.product_id=p.id),'[]')) as products
    from public.product_variants v join public.products p on p.id=v.product_id where v.id=$1 and v.status='active'`,[url.searchParams.get('id')?.replace('eq.','')]);
  } else if(table==='inventory') {
   data=await rows('select * from public.inventory');
   const filter=url.searchParams.get('variant_id');
   if(filter?.startsWith('eq.')) data=data.filter(r=>r.variant_id===filter.slice(3));
  } else if(table==='app_settings') data=await rows('select key,value from public.app_settings');
  else if(table==='coupons') data=await rows('select * from public.coupons where code=$1',[url.searchParams.get('code')?.replace('eq.','')]);
  else if(table==='collaborators') data=await rows("select * from public.collaborators where id=$1 and status='active'",[url.searchParams.get('id')?.replace('eq.','')]);
  else if(table==='admin_users') data=[];
  else {res.statusCode=404;res.end(JSON.stringify({message:'Fixture route not implemented'}));return;}
  if(req.headers.accept?.includes('application/vnd.pgrst.object+json')) data=data[0] || null;
  res.end(JSON.stringify(data));
 } catch(e) {res.statusCode=500;res.end(JSON.stringify({message:e.message}));}
});
server.listen(54329,'127.0.0.1',()=>console.log('Read-only SQL pricing fixture: http://127.0.0.1:54329'));
async function close(){server.close();await db.close();process.exit(0);}
process.on('SIGTERM',close);process.on('SIGINT',close);
