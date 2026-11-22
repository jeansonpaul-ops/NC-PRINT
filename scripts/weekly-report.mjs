// Génère le rapport hebdomadaire NC Print (HTML e-mail) depuis Firestore (REST, règles ouvertes).
// Sortie : report/rapport.html + report/meta.json
import fs from 'node:fs';
const PROJECT=process.env.FB_PROJECT||'luxvisual-nc-print';
const TZ='Europe/Luxembourg';
const FIXTURE=process.env.FIXTURE; // JSON de test (tableau de NC) au lieu de Firestore

const val=v=>{if(!v)return null;if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;
  if('booleanValue'in v)return v.booleanValue;if('timestampValue'in v)return v.timestampValue;if('nullValue'in v)return null;
  if('arrayValue'in v)return(v.arrayValue.values||[]).map(val);if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,val(x)]));return null};
async function load(){
  if(FIXTURE)return JSON.parse(fs.readFileSync(FIXTURE,'utf8'));
  let out=[],tok='';
  do{
    const u=`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/nc_print?pageSize=300${tok?'&pageToken='+encodeURIComponent(tok):''}`;
    const r=await fetch(u);if(!r.ok)throw new Error('Firestore HTTP '+r.status+' '+(await r.text()).slice(0,200));
    const j=await r.json();(j.documents||[]).forEach(d=>out.push(Object.fromEntries(Object.entries(d.fields||{}).map(([k,x])=>[k,val(x)]))));
    tok=j.nextPageToken||'';
  }while(tok);
  return out;
}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const parts=d=>Object.fromEntries(new Intl.DateTimeFormat('fr-FR',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
const ymd=d=>{const p=parts(d);return`${p.year}-${p.month}-${p.day}`};
const dm=s=>{const[y,m,d]=s.split('-');return`${d}/${m}`};
const MOIS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const fmtMin=m=>m>=60?`${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')}`:`${m} min`;
const BLUE='#0066cc',TEAL='#0f8b8d',GREEN='#1e9e6a',INK='#14181f',MUTE='#5f6877',LINE='#e3e6eb';
const COLORS=['#10489e','#136cc3','#1392c3','#10859e','#109e98','#109e7a','#13b7c3','#13c384'];

const all=(await load()).filter(n=>n.date&&n.ref);
const now=new Date(),today=ymd(now);
// lundi de la semaine courante (fuseau Luxembourg)
const dow=(new Date(today+'T12:00:00Z').getUTCDay()+6)%7;
const monday=ymd(new Date(new Date(today+'T12:00:00Z').getTime()-dow*86400000));
const monthKey=today.slice(0,7);
const day=n=>ymd(new Date(n.date));
const week=all.filter(n=>day(n)>=monday&&day(n)<=today).sort((a,b)=>a.date.localeCompare(b.date));
const month=all.filter(n=>day(n).slice(0,7)===monthKey);
const tl=a=>a.reduce((s,n)=>s+(n.timeLost||0),0);
const types=n=>(n.types&&n.types.length?n.types:[n.type]).filter(Boolean).map(t=>t.startsWith('Autre:')?'Autre':t);

function bars(title,entries,fmt){
  const total=entries.reduce((s,e)=>s+e[1],0),mx=Math.max(1,...entries.map(e=>e[1]));
  if(!entries.length)return`<h3 style="font-size:16px;margin:24px 0 8px;color:${INK}">${esc(title)}</h3><p style="color:${MUTE};font-size:14px;margin:0">Aucune donnée.</p>`;
  return`<h3 style="font-size:16px;margin:24px 0 8px;color:${INK}">${esc(title)}</h3><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">`+
  entries.map(([l,v],i)=>{const pct=total?Math.round(v/total*100):0,w=Math.max(2,Math.round(v/mx*100));
    return`<tr><td style="padding:4px 8px 4px 0;font-size:13px;color:${INK};width:38%">${esc(l)}</td><td style="padding:4px 0"><div style="background:#f1f3f6;border-radius:3px"><div style="width:${w}%;background:${COLORS[i%8]};height:14px;border-radius:3px"></div></div></td><td style="padding:4px 0 4px 8px;font-size:12px;color:${MUTE};white-space:nowrap;text-align:right;width:22%">${fmt?fmt(v):v} · ${pct}%</td></tr>`}).join('')+'</table>';
}
const count=(a,fn)=>{const m={};a.forEach(n=>fn(n).forEach(k=>m[k]=(m[k]||0)+1));return Object.entries(m).sort((a,b)=>b[1]-a[1])};
const byType=count(month,types);
const byGra=count(month,n=>[n.graphiste||'Non renseigné']);
const tm={};month.forEach(n=>{if(n.timeLost){const g=n.graphiste||'Non renseigné';tm[g]=(tm[g]||0)+n.timeLost}});
const timeGra=Object.entries(tm).sort((a,b)=>b[1]-a[1]);
const byM={};all.forEach(n=>{const k=day(n).slice(0,7);byM[k]=byM[k]||{c:0,t:0};byM[k].c++;byM[k].t+=n.timeLost||0});
const months=Object.entries(byM).sort((a,b)=>b[0].localeCompare(a[0]));
const th=`padding:8px;text-align:left;font-size:12px;color:${MUTE};background:#f1f3f6;border-bottom:1px solid ${LINE}`,td=`padding:8px;font-size:13px;color:${INK};border-bottom:1px solid ${LINE};vertical-align:top`;
const kpi=(v,l,c)=>`<td style="padding:0 24px 0 0"><div style="font-size:28px;color:${c};font-weight:bold">${v}</div><div style="font-size:12px;color:${MUTE}">${l}</div></td>`;
const wk=`${dm(monday)} au ${dm(today)}`;
const wRows=week.length?week.map(n=>`<tr><td style="${td};font-family:monospace;white-space:nowrap">${esc(n.ref)}</td><td style="${td};white-space:nowrap">${dm(day(n))}</td><td style="${td}">${esc(n.job||'—')}</td><td style="${td}">${esc(n.client||'—')}</td><td style="${td}">${esc(n.graphiste||'—')}</td><td style="${td}">${esc((n.types&&n.types.length?n.types:[n.type]).join(', '))}${n.gravite?` <b style="color:${n.gravite==='Critique'?'#b3261e':n.gravite==='Majeure'?'#a85a00':GREEN}">· ${esc(n.gravite)}</b>`:''}</td><td style="${td};white-space:nowrap;text-align:right">${n.timeLost||0} min</td></tr>`).join('')
  :`<tr><td colspan="7" style="${td};color:${MUTE}">Aucune non-conformité cette semaine.</td></tr>`;
const html=`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border:1px solid ${LINE}">
<tr><td style="background:${BLUE};background-image:linear-gradient(135deg,#0a4fa8,${BLUE} 40%,${TEAL});padding:24px;color:#fff"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.8">LuxVisual · Production</div><div style="font-size:24px;margin-top:4px">NC Print — semaine du ${wk}</div><div style="font-size:14px;opacity:.85;margin-top:4px">${MOIS[+monthKey.slice(5)-1]} ${monthKey.slice(0,4)}</div></td></tr>
<tr><td style="padding:24px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${kpi(week.length,'NC cette semaine',BLUE)}${kpi(fmtMin(tl(week)),'temps perdu',TEAL)}${kpi(week.length?Math.round(tl(week)/week.length)+' min':'—','par NC',GREEN)}</tr></table>
<h3 style="font-size:16px;margin:24px 0 8px;color:${INK}">Non-conformités de la semaine</h3>
<div style="overflow-x:auto"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${LINE}"><tr><th style="${th}">Réf.</th><th style="${th}">Date</th><th style="${th}">Job</th><th style="${th}">Client</th><th style="${th}">Graphiste</th><th style="${th}">Type(s)</th><th style="${th};text-align:right">Temps</th></tr>${wRows}</table></div>
<h2 style="font-size:18px;margin:32px 0 0;color:${TEAL};border-top:1px solid ${LINE};padding-top:24px">Cumul du mois — ${month.length} NC · ${fmtMin(tl(month))}</h2>
${bars('Par type de NC',byType)}${bars('Par graphiste',byGra)}${bars('Temps perdu par graphiste',timeGra,fmtMin)}
<h3 style="font-size:16px;margin:24px 0 8px;color:${INK}">Récapitulatif mensuel</h3>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${LINE}"><tr><th style="${th}">Mois</th><th style="${th};text-align:right">NC</th><th style="${th};text-align:right">Temps perdu</th><th style="${th};text-align:right">Moy./NC</th></tr>
${months.map(([k,v])=>`<tr><td style="${td}">${MOIS[+k.slice(5)-1]} ${k.slice(0,4)}</td><td style="${td};text-align:right"><b>${v.c}</b></td><td style="${td};text-align:right">${fmtMin(v.t)}</td><td style="${td};text-align:right">${v.c?Math.round(v.t/v.c):0} min</td></tr>`).join('')}</table>
<p style="font-size:12px;color:${MUTE};margin:24px 0 0">Rapport généré automatiquement par NC Print.</p>
</td></tr></table></td></tr></table></body></html>`;
// Compactage : classes CSS (balise <style>) à la place des styles inline répétés
let out=html;
const rep=(str,cls)=>{out=out.split(`style="${str};`).join(`class="${cls}" style="`).split(`style="${str}"`).join(`class="${cls}"`)};
rep(th,'th');rep(td,'d');
const bar1=`padding:4px 8px 4px 0;font-size:13px;color:${INK};width:38%`,bar2='padding:4px 0',bar3=`padding:4px 0 4px 8px;font-size:12px;color:${MUTE};white-space:nowrap;text-align:right;width:22%`;
rep(bar1,'b1');rep(bar2,'b2');rep(bar3,'b3');
const css=`<style>.th{${th}}.d{${td}}.b1{${bar1}}.b2{${bar2}}.b3{${bar3}}</style>`;
out=out.replace('</head>',css+'</head>').replace(/\n/g,'');
fs.mkdirSync('report',{recursive:true});
fs.writeFileSync('report/rapport.html',out);
fs.writeFileSync('report/meta.json',JSON.stringify({generatedAt:now.toISOString(),subject:`NC Print — rapport hebdomadaire — semaine du ${wk}`,weekNC:week.length,monthNC:month.length,totalNC:all.length,text:`NC Print — semaine du ${wk} : ${week.length} NC, ${fmtMin(tl(week))} perdues. Mois en cours : ${month.length} NC, ${fmtMin(tl(month))}.`},null,2));
console.log('OK',week.length,'NC semaine,',month.length,'mois,',all.length,'total');
