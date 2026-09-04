import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {TicketsDashboard,TicketDetail} from '/src/pages/Tickets/index.jsx';
import {LoadingProvider} from '/src/contexts/LoadingContext.jsx';
import {ToastProvider} from '/src/contexts/ToastContext.jsx';
import connect from '/src/utils/request.js';
import 'primereact/resources/themes/saga-green/theme.css';
import '/src/index.css';
import '/src/theme/theme.css';
import './studio.css';
localStorage.setItem('role','USER');
localStorage.setItem('current_id','900001');
localStorage.setItem('permissions',JSON.stringify([{screen:'tickets',view:true,create:true,edit:true}]));
const demoUser={id:900001,nome:'Usuário demonstração',email:'demo@example.invalid'};
const stamp=new Date();
let ticket={id:101,name:'[DEMONSTRAÇÃO] Erro ao abrir relatório',observation:'Cenário fictício para o tutorial.',status:'ABERTO',created_at:stamp.toISOString(),updated_at:stamp.toISOString(),due_at:new Date(+stamp+86400000).toISOString(),reason:null,created_by:demoUser,responsible:null,comments:[]};
let created=false;
connect.defaults.adapter=async config=>{
 let data=[];const url=config.url;
 if(url==='/tickets'&&config.method==='post'){ticket={...ticket,...JSON.parse(config.data)};created=true;data=ticket;}
 else if(url==='/tickets') data=created?[ticket]:[];
 else if(url.endsWith('/comentarios')){const body=JSON.parse(config.data);data={id:1,description:body.description,created_by:demoUser,created_at:new Date().toISOString(),is_requester:true};ticket.comments.push(data);}
 else if(url==='/tickets/101') data=ticket;
 return {data:structuredClone(data),status:200,statusText:'OK',headers:{},config};
};
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/tickets']}><LoadingProvider><ToastProvider><div className="demo-shell"><header className="demo-top"><img src="/brands/main_brand_white.svg"/><span>Filiais <b>Filial demonstração ▾</b></span><strong>AMBIENTE DEMONSTRATIVO</strong></header><div className="demo-body"><aside><span>ATENDIMENTO</span><b>◈ &nbsp; Chamados</b></aside><main><Routes><Route path="/tickets" element={<TicketsDashboard/>}/><Route path="/tickets/:ticketId" element={<TicketDetail/>}/></Routes></main></div></div></ToastProvider></LoadingProvider></MemoryRouter>);
window.demoReady=true;
