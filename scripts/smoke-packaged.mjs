// Exercise the packaged native executable, including its real preload bridge. Never connects to a TV.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const executable=resolve(process.argv[2]);
const port=19332;
let logs='';const child=spawn(executable,[`--remote-debugging-port=${port}`],{stdio:['ignore','pipe','pipe']});
child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){
  if(child.exitCode!==null||child.signalCode)throw Error(`Native process exited: ${child.exitCode??child.signalCode}\n${logs}`);
  try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);if(r.ok){ready=true;break}}catch{}
  await delay(200);
 }
 if(!ready)throw Error('Native renderer did not start');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 const page=browser.contexts()[0].pages()[0];
 await page.getByRole('heading',{name:'Installons Muzcast sur votre TV.'}).waitFor();
 const bridge=await page.evaluate(async()=>({platform:window.cytv.platform,state:(await window.cytv.status()).state,desktop:navigator.userAgent.includes('Electron')}));
 if(bridge.platform!=='darwin'||!bridge.desktop)throw Error('Not the real native bridge');
 if(await page.getByText('Aperçu de l’interface · TV simulée, aucune installation réelle').count())throw Error('Mock running in desktop');
 await page.getByRole('button',{name:'À propos',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Fermer À propos'}).click();
 await page.locator('summary').filter({hasText:'Ma TV n’apparaît pas'}).click();
 await page.getByRole('textbox',{name:'Adresse de la TV'}).waitFor({state:'visible'});
 await delay(2000);
 if(child.exitCode!==null||child.signalCode)throw Error('Process stopped during UI check');
 await page.screenshot({path:'/tmp/muzcast-native-release.png'});
 console.log('Native startup, real bridge, About dialog and manual connection UI: PASS');
}finally{await browser?.close();child.kill('SIGTERM')}
