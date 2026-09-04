import {chromium} from 'file:///C:/Users/Guilherme/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5178/output/tutorial-chamados-timo/timo.html');
 const info=await page.evaluate(async()=>{
  const video=document.createElement('video');video.muted=true;video.src='/output/tutorial-chamados-timo/TMHub-Chamados-com-Timo-FullHD.mp4';document.body.replaceChildren(video);
  await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(new Error('Video load error'));});
  video.currentTime=100;await video.play();
  await new Promise(resolve=>video.requestVideoFrameCallback(resolve));
  return {duration:video.duration,width:video.videoWidth,height:video.videoHeight,currentTime:video.currentTime,readyState:video.readyState,error:video.error?.message??null};
 });
 console.log(JSON.stringify(info));
 if(info.width!==1920||info.height!==1080||info.currentTime<100||info.error)process.exitCode=1;
} finally {await browser.close();}
