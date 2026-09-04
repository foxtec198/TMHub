import {chromium} from 'file:///C:/Users/Guilherme/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const base=new URL('.',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');
await fs.mkdir(base+'screens',{recursive:true});await fs.mkdir(base+'frames',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
await page.goto('http://127.0.0.1:5178/output/tutorial-chamados-timo/index.html');
await page.waitForFunction(()=>window.demoReady);await page.waitForTimeout(1500);
async function shot(name){await page.screenshot({path:base+'screens/'+name+'.png'});console.log(name);}
await shot('01-central');
await page.getByRole('button',{name:'Novo chamado',exact:true}).click();await page.waitForTimeout(400);await shot('02-form');
await page.getByPlaceholder('Descreva o chamado em uma frase').fill('[DEMONSTRAÇÃO] Erro ao abrir relatório');await shot('03-title');
await page.locator('span.p-dropdown-label').filter({hasText:'Selecione se necessário'}).click();await page.waitForTimeout(300);await shot('04-reason');await page.getByText('Abrir novo chamado',{exact:true}).click();
await page.getByPlaceholder('Explique o que aconteceu e o que precisa ser tratado.').fill('Registro de demonstração — cenário fictício.\n\nOnde aconteceu: na tela de relatório.\nO que tentei fazer: selecionei o período e abri o relatório.\nO que aconteceu: o relatório não foi exibido.\nO que eu esperava: visualizar os dados do período.\nMensagem do exemplo: “Não foi possível carregar os dados”.\n\nEste registro não representa uma ocorrência real.');await shot('05-description');
await page.getByRole('button',{name:'Abrir chamado',exact:true}).click();await page.waitForTimeout(700);await shot('06-confirmation');await page.waitForTimeout(3500);await shot('07-detail');
const composer=page.getByPlaceholder('Escreva uma atualização para o chamado…');
await composer.scrollIntoViewIfNeeded();await composer.fill('Complemento da demonstração: o exemplo aconteceu após selecionar o período. Não é uma ocorrência real.');await shot('08-comment');
await page.getByRole('button',{name:'Enviar',exact:true}).click();await page.waitForTimeout(500);await shot('09-sent');
await page.getByRole('button',{name:'Voltar aos chamados',exact:true}).click();await page.waitForTimeout(500);await shot('10-list');
await page.getByPlaceholder('Buscar chamado').fill('101');await shot('11-search');
await page.getByPlaceholder('Buscar chamado').fill('');await page.locator('span.p-dropdown-label').filter({hasText:'Todos os status'}).click();await page.waitForTimeout(300);await shot('12-status');
await page.keyboard.press('Escape');await page.getByRole('button',{name:'Ver todos',exact:true}).click();await shot('13-all');
if(process.argv.includes('--ui-only')){await browser.close();process.exit(0);}
await page.goto('http://127.0.0.1:5178/output/tutorial-chamados-timo/timo.html');await page.setViewportSize({width:440,height:650});await page.waitForFunction(()=>window.timoReady);
console.log(JSON.stringify(await page.evaluate(()=>window.timoInfo)));
for(const name of ['speaking','wave']){for(let i=0;i<120;i++){await page.evaluate(({name,t})=>window.renderTimo(name,t),{name,t:i/24});await page.screenshot({path:base+`frames/${name}-${String(i).padStart(4,'0')}.png`,omitBackground:true});}console.log('Rendered',name);}
await browser.close();
