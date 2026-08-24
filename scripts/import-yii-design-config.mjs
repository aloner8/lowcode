import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
const { Pool } = pg;
const coreUrl = process.env.CORE_DATABASE_URL || 'postgresql://lowcode_admin:lowcode_dev_password@localhost:35432/lowcode_core';
const slug = process.argv[2] || 'plateform-obt';
const db = new Pool({ connectionString: coreUrl });
await db.query(await fs.readFile(path.resolve('docker/postgres/migrations/006_create_platform_design_configs.sql'), 'utf8'));
const platform = await db.query('SELECT id FROM public.platforms WHERE platform_slug=$1', [slug]);
if (!platform.rowCount) throw new Error(`Platform not found: ${slug}`);
const platformId = platform.rows[0].id;
const configs = [
  ['backend','application',{ id:'app-backend',timeZone:'Asia/Bangkok',modules:['admin','administrator','ckeditorRoxyFileman','cms','ebook','forum','smartreport','booking','dogcat','gridview'],theme:'yang-new',authManager:'yii\\rbac\\PhpManager',accessControl:'mdm\\admin\\components\\AccessControl',allowActions:['site/login','site/index','site/error','site/line','site/auth','debug/*','site/logout','site/profile'],authClient:{line:{clientId:'2011153046',clientSecretRef:'secret://line/backend'}}},'backend/config/main.php'],
  ['frontend','application',{ id:'yang-frontend',timeZone:'Asia/Bangkok',modules:['smartreport','booking','dogcat'],theme:'yang-new',prettyUrl:true,routes:{portal:'site/portal',dashboard:'site/portal',login:'site/login',logout:'site/logout',profile:'site/profile'},authClient:{line:{clientId:'2011153046',clientSecretRef:'secret://line/frontend'}}},'frontend/config/main.php'],
  ['rbac','policy',{ manager:'yii\\rbac\\PhpManager',roles:{cms:['pms_cms'],administrator:['pms_administrator'],forum:['pms_forum']},permissions:{pms_cms:['/cms/*'],pms_administrator:['/administrator/*'],pms_forum:['/forum/*']},assignments:{'1':['administrator','cms','forum']}},'backend/rbac/items.php + assignments.php'],
  ['menu','backend',{ root:'backend',items:[{label:'แผงควบคุม',url:'/site/index',permission:null},{label:'จัดการเนื้อหาเว็บไซต์',url:'#',permission:'cms'},{label:'ระบบแจ้งเหตุอัจฉริยะ',url:'/smartreport/default/executive',permission:'smartreport'},{label:'ระบบจองคิวออนไลน์',url:'/booking/default/index',permission:'queue'},{label:'ระบบกระดานข่าว',url:'/forum/thread/index',permission:'forum'},{label:'ผู้ดูแลระบบ',url:'#',permission:'administrator'}]},'backend/themes/yang-new/views/layouts/_menu.php'],
];
for (const [scope,key,value,source] of configs) await db.query(`INSERT INTO public.platform_design_configs(platform_id,scope,config_key,config_value,source_path)
 VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT(platform_id,scope,config_key) DO UPDATE SET config_value=excluded.config_value,source_path=excluded.source_path,version=platform_design_configs.version+1,updated_at=now()`,[platformId,scope,key,JSON.stringify(value),source]);
await db.end();
process.stdout.write(JSON.stringify({ platform:slug, imported:configs.map(([scope,key])=>`${scope}.${key}`) },null,2));
