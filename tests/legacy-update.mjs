import { createRequire } from 'node:module';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import assert from 'node:assert/strict';
import { createFeed } from '../scripts/electron-feed.mjs';
const require=createRequire(import.meta.url);
const {NsisUpdater}=require('electron-updater');
const {HttpExecutor,configureRequestUrl,configureRequestOptions}=require('builder-util-runtime');

// Solo il trasporto è Node: parsing, selezione versione, cache e checksum sono
// quelli dell'electron-updater 6.8.9 realmente distribuito nella Suite 1.7.10.
class NodeTransport extends HttpExecutor {
  createRequest(options,cb){return (options.protocol==='http:'?httpRequest:httpsRequest)(options,cb);}
  download(url,destination,options){return options.cancellationToken.createPromise((resolve,reject,onCancel)=>{
    const request={headers:options.headers};configureRequestUrl(url,request);configureRequestOptions(request);
    this.doDownload(request,{destination,options,onCancel,responseHandler:null,callback:e=>e?reject(e):resolve(destination)},0);
  });}
}
const temp=await mkdtemp(join(tmpdir(),'daprod-legacy-update-'));
let server;
try{
  const installer=process.argv[2];
  assert.ok(installer,'Indica il percorso dell’installer reale');
  const manifest=join(temp,'latest.yml');const expected=await createFeed(installer,manifest);
  const data=await readFile(installer);
  const remote=process.argv.includes('--github');
  if(!remote){server=createServer(async(req,res)=>{
    if(req.url.startsWith('/latest.yml')){res.setHeader('Content-Type','text/yaml');res.end(await readFile(manifest));}
    else if(decodeURIComponent(req.url.split('?')[0])==='/'+basename(installer)){res.setHeader('Content-Length',data.length);res.end(data);}
    else{res.statusCode=404;res.end();}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));}
  const config=join(temp,'app-update.yml');await writeFile(config,'provider: github\nowner: cammo22\nrepo: DaProdSuite\nupdaterCacheDirName: legacy-smoke\n');
  const app={version:'1.7.10',name:'DaProd Suite',isPackaged:true,appUpdateConfigPath:config,userDataPath:temp,baseCachePath:temp,whenReady:async()=>{},onQuit:()=>{},quit:()=>{},relaunch:()=>{}};
  const updater=new NsisUpdater(undefined,app);updater.httpExecutor=new NodeTransport();updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.disableDifferentialDownload=true;
  updater.logger={info:()=>{},warn:()=>{},error:console.error,debug:()=>{}};
  updater.setFeedURL(remote?{provider:'github',owner:'cammo22',repo:'DaProdSuite'}:{provider:'generic',url:`http://127.0.0.1:${server.address().port}/`});
  const update=await updater.checkForUpdates();assert.equal(update.updateInfo.version,expected.version);
  assert.equal(update.updateInfo.files[0].sha512,expected.sha512);
  const [downloaded]=await updater.downloadUpdate();assert.deepEqual(await readFile(downloaded),data);
  let invocation;updater.spawnLog=async(file,args)=>{invocation={file,args};};
  assert.equal(updater.doInstall({isSilent:false,isForceRunAfter:false,isAdminRightsRequired:false}),true);
  assert.deepEqual(invocation.args,['--updated']);
  assert.equal(invocation.file,downloaded);
  console.log(`OK: updater Suite 1.7.10 → ${expected.version}; feed ${remote?'GitHub DaProdSuite con redirect':'locale'}, download e SHA-512 verificati; installer richiamato con --updated.`);
}finally{if(server)await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
