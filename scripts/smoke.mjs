import {chromium} from '../source/scripts/web/node_modules/playwright/index.mjs';
import {composeDriver} from '../source/scripts/web/ui-interaction.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const base=new URL(process.env.SITE_URL);
if(base.origin!=='https://ohyooo.github.io'||base.pathname!=='/livephoto-web/')throw Error('Unexpected Pages URL');
const manifest=JSON.parse((await readFile('web-ui-package-evidence.json','utf8')).replace(/^\uFEFF/,''));
for(const entry of manifest.files){
  const response=await fetch(new URL(entry.path,base));
  if(!response.ok)throw Error('Online asset HTTP '+response.status+': '+entry.path);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Online hash mismatch: '+entry.path);
  if(entry.path.endsWith('.wasm')&&!response.headers.get('content-type')?.startsWith('application/wasm'))throw Error('Incorrect Wasm MIME');
}
await mkdir('.checks',{recursive:true});await mkdir('ci-output',{recursive:true});
const ffmpeg=process.env.LIVEPHOTO_FFMPEG;
if(!ffmpeg)throw Error('Missing synthetic fixture generator');
const generate=args=>execFileSync(ffmpeg,['-nostdin','-n','-hide_banner','-loglevel','error',...args],{timeout:60000});
generate(['-f','lavfi','-i','color=c=blue:s=64x64','-frames:v','1','-threads','1','-update','1','.checks/cover.jpg']);
generate(['-f','lavfi','-i','testsrc2=size=64x64:rate=25','-t','2','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',
  '-bf','0','-g','25','-use_editlist','0','-map_metadata','-1','-metadata:s:v','encoder=','-fflags','+bitexact','-flags:v','+bitexact','-write_btrt','0','.checks/video.mp4']);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800},acceptDownloads:true});
page.setDefaultTimeout(180000);
const errors=[];page.on('pageerror',error=>errors.push(String(error)));
try{
  const response=await page.goto(base.href);
  if(!response?.ok())throw Error('Pages entry unavailable');
  await page.waitForFunction(()=>document.documentElement.dataset.livephotoRuntime==='kotlin-wasm-compose');
  await page.locator('canvas').first().waitFor({state:'visible'});
  await page.keyboard.press('Tab');
  const driver=composeDriver(page,{width:1280,height:800});
  await driver.choose('选择图片','.checks/cover.jpg');
  await driver.choose('选择视频','.checks/video.mp4');
  await page.getByText('名称：video.mp4').or(page.getByLabel('名称：video.mp4')).first().waitFor({state:'attached'});
  const pending=page.waitForEvent('download');pending.catch(()=>{});
  await driver.click('生成动态照片');
  const download=await pending;
  if(await download.failure())throw Error('Pages download failed');
  const carrier=await readFile(await download.path()),video=await readFile('.checks/video.mp4');
  if(!download.suggestedFilename().endsWith('.jpg')||carrier[0]!==255||carrier[1]!==216||
    carrier.length<=video.length||!carrier.subarray(-video.length).equals(video))throw Error('Synthetic photo did not retain the video bytes');
  await page.getByText(/已生成并发起浏览器下载/).or(page.getByLabel(/已生成并发起浏览器下载/)).first().waitFor({state:'attached'});
  if(errors.length)throw Error('Pages application errors: '+errors.join(';'));
  await page.screenshot({path:'ci-output/pages-smoke.png'});
  await writeFile('ci-output/pages-smoke.json',JSON.stringify({success:true,url:base.href,source:manifest.commit,run:manifest.run,
    browser:browser.version(),assets:manifest.files.length,videoSha256:createHash('sha256').update(video).digest('hex')},null,2));
  console.log('PAGES_SMOKE=SUCCESS: all online hashes, Kotlin/Wasm UI, Worker and actual synthetic download');
}catch(error){await page.screenshot({path:'ci-output/pages-smoke-failure.png'});throw error;}
finally{await browser.close();}
