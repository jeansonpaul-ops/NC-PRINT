// Rapport hebdomadaire NC Print : lit Firestore (REST), génère des graphiques PNG + un e-mail HTML léger.
// Sorties : report/rapport.html, report/meta.json, report/*.png
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
const PROJECT=process.env.FB_PROJECT||'luxvisual-nc-print';
const TZ='Europe/Luxembourg';
const FIXTURE=process.env.FIXTURE;
const RAW='https://raw.githubusercontent.com/jeansonpaul-ops/NC-PRINT/main/report/';

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
const TYPE_COL={'Fond perdu insuffisant':'#10489e','Traits de coupe absents / mal positionnés':'#136cc3','Contour de découpe absent / non standard':'#10679e','Image pixélisée':'#1392c3','Fichier en RVB':'#10859e','Blanc non défini':'#13b7c3','Dimensions incorrectes':'#109e98','Fichier corrompu':'#13c3a9','Mauvais format (JPG/PDF)':'#109e7a','Transparences non aplaties':'#13c384','Amalgamme / Recto Verso mal préparé':'#109e5b','Autre':'#13c35e'};
const GRA_COL={'Paul':'#10489e','Félix':'#1392c3','Manon':'#109e98','Christopher':'#109e7a','Invité (Graphiste)':'#13c35e'};
const PAL=['#10489e','#136cc3','#1392c3','#10859e','#109e98','#109e7a','#13b7c3','#13c384'];

const all=(await load()).filter(n=>n.date&&n.ref);
const now=new Date(),today=ymd(now);
const dow=(new Date(today+'T12:00:00Z').getUTCDay()+6)%7;
const monday=ymd(new Date(new Date(today+'T12:00:00Z').getTime()-dow*86400000));
const monthKey=today.slice(0,7);
const day=n=>ymd(new Date(n.date));
const okD=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'');
let start=okD(process.env.REPORT_START)?process.env.REPORT_START:monday,end=okD(process.env.REPORT_END)?process.env.REPORT_END:today;
if(start>end)[start,end]=[end,start];
const custom=start!==monday||end!==today;
const week=all.filter(n=>day(n)>=start&&day(n)<=end).sort((a,b)=>a.date.localeCompare(b.date));
const monthAll=all.filter(n=>day(n).slice(0,7)===monthKey);
const month=week;
const tl=a=>a.reduce((s,n)=>s+(n.timeLost||0),0);
const types=n=>(n.types&&n.types.length?n.types:[n.type]).filter(Boolean).map(t=>t.startsWith('Autre:')?'Autre':t);
const count=(a,fn)=>{const m={};a.forEach(n=>fn(n).forEach(k=>m[k]=(m[k]||0)+1));return Object.entries(m).sort((a,b)=>b[1]-a[1])};
const byType=count(month,types).map(([l,v])=>({l,v,c:TYPE_COL[l]||'#13c35e'}));
const byGra=count(month,n=>[n.graphiste||'Non renseigné']).map(([l,v],i)=>({l,v,c:GRA_COL[l]||PAL[i%8]}));
const tm={};month.forEach(n=>{if(n.timeLost){const g=n.graphiste||'Non renseigné';tm[g]=(tm[g]||0)+n.timeLost}});
const timeGra=Object.entries(tm).sort((a,b)=>b[1]-a[1]).map(([l,v],i)=>({l,v,c:GRA_COL[l]||PAL[i%8]}));
const byM={};all.forEach(n=>{const k=day(n).slice(0,7);byM[k]=byM[k]||{c:0,t:0};byM[k].c++;byM[k].t+=n.timeLost||0});
const months=Object.entries(byM).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
const MC=['Janv','Févr','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'];
const dmy=x=>{const[y,m,d]=x.split('-');return`${d}/${m}/${y}`};
const wk=custom?`${dmy(start)} au ${dmy(end)}`:`${dm(monday)} au ${dm(today)}`;
const LABEL=custom?'période du '+wk:'semaine du '+wk;

// ───────── Graphiques SVG → PNG
const FF="font-family=\"DM Sans, DejaVu Sans, sans-serif\"";
const t=(x,y,s,o={})=>`<text x="${x}" y="${y}" ${FF} font-size="${o.size||14}" font-weight="${o.w||400}" fill="${o.fill||INK}" text-anchor="${o.a||'start'}">${esc(s)}</text>`;
const cut=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
function svgWrap(w,h,body){return`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>${body}</svg>`}
function banner(){
  const w=1280,h=240;
  return`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a4fa8"/><stop offset=".4" stop-color="#0066cc"/><stop offset="1" stop-color="#0f8b8d"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>
  ${[60,104,152,204].map(r=>`<circle cx="1140" cy="40" r="${r}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/>`).join('')}
  <path d="M30 48V28h20M1250 192v20h-20M30 192v20h20" stroke="#fff" stroke-opacity=".4" stroke-width="2" fill="none"/>
  <text x="60" y="78" ${FF} font-size="24" font-weight="500" fill="#fff" fill-opacity=".8" letter-spacing="3">LUXVISUAL · PRODUCTION</text>
  <text x="60" y="150" ${FF} font-size="60" font-weight="700" fill="#fff">NC Print — ${custom?wk:'semaine du '+wk}</text>
  <text x="60" y="200" ${FF} font-size="28" fill="#fff" fill-opacity=".88">${week.length} non-conformité${week.length>1?'s':''} · ${fmtMin(tl(week))} perdues</text></svg>`;
}
function donut(entries,center){
  const w=640,h=Math.max(260,40+entries.length*30),total=entries.reduce((s,e)=>s+e.v,0),cx=130,cy=h/2,r=84,sw=44;
  let a=-Math.PI/2,body='';
  entries.forEach(e=>{const a1=a+e.v/total*2*Math.PI,x0=cx+r*Math.cos(a),y0=cy+r*Math.sin(a),x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
    body+=entries.length===1?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${e.c}" stroke-width="${sw}"/>`:`<path d="M${x0} ${y0} A${r} ${r} 0 ${a1-a>Math.PI?1:0} 1 ${x1} ${y1}" fill="none" stroke="${e.c}" stroke-width="${sw}"/>`;a=a1});
  body+=t(cx,cy+8,String(center),{size:30,w:700,a:'middle'})+t(cx,cy+30,'NC',{size:14,fill:MUTE,a:'middle'});
  const y0=(h-entries.length*30)/2+8;
  entries.forEach((e,i)=>{const y=y0+i*30;body+=`<rect x="270" y="${y}" width="14" height="14" rx="3" fill="${e.c}"/>`+t(294,y+12,cut(e.l,36),{size:14})+t(626,y+12,`${e.v} · ${Math.round(e.v/total*100)}%`,{size:14,w:700,a:'end'})});
  return svgWrap(w,h,body);
}
function hbars(entries,fmt){
  const w=640,row=40,h=entries.length*row+16,total=entries.reduce((s,e)=>s+e.v,0),mx=Math.max(1,...entries.map(e=>e.v));
  let body='';
  entries.forEach((e,i)=>{const y=8+i*row,bw=Math.max(4,Math.round(e.v/mx*300));
    body+=t(8,y+25,cut(e.l,20),{size:14})+`<rect x="170" y="${y+8}" width="300" height="20" rx="4" fill="#f1f3f6"/><rect x="170" y="${y+8}" width="${bw}" height="20" rx="4" fill="${e.c}"/>`+t(632,y+25,`${fmt?fmt(e.v):e.v} · ${total?Math.round(e.v/total*100):0}%`,{size:14,w:700,a:'end'})});
  return svgWrap(w,h,body);
}
function cols(ms){
  const w=640,h=280,base=230,top=40,mx=Math.max(1,...ms.map(m=>m[1].c)),bw=56,gap=(w-60-ms.length*bw)/(ms.length-1||1);
  let body=`<line x1="30" y1="${base}" x2="610" y2="${base}" stroke="${LINE}" stroke-width="2"/>`;
  ms.forEach(([k,v],i)=>{const x=30+i*(bw+gap),bh=Math.max(4,Math.round(v.c/mx*(base-top))),cur=k===monthKey;
    body+=`<rect x="${x}" y="${base-bh}" width="${bw}" height="${bh}" rx="5" fill="${cur?BLUE:'#9fc4e8'}"/>`+t(x+bw/2,base-bh-24,String(v.c),{size:16,w:700,a:'middle'})+t(x+bw/2,base-bh-8,fmtMin(v.t),{size:12,fill:MUTE,a:'middle'})+t(x+bw/2,base+22,MC[+k.slice(5)-1]+' '+k.slice(2,4),{size:13,fill:MUTE,a:'middle'})});
  return svgWrap(w,h,body);
}
const fontOpts={fontFiles:['scripts/fonts/DMSans.ttf','scripts/fonts/DejaVuSans.ttf','scripts/fonts/DejaVuSans-Bold.ttf'],loadSystemFonts:false,defaultFontFamily:'DM Sans'};
function png(name,svg,width){fs.writeFileSync(`report/${name}.png`,new Resvg(svg,{fitTo:{mode:'width',value:width},font:fontOpts}).render().asPng())}
fs.mkdirSync('report',{recursive:true});
png('banner',banner(),1280);
const hasMonth=month.length>0;
if(hasMonth){png('types',donut(byType,month.length),1280);png('graphistes',hbars(byGra),1280);if(timeGra.length)png('temps',hbars(timeGra,fmtMin),1280)}
png('mois',cols(months),1280);

// ───────── E-mail HTML (léger, tables + attributs compatibles Outlook)
const v=Date.now();
const img=(n,alt)=>`<img src="${RAW}${n}.png?v=${v}" width="592" alt="${esc(alt)}" style="display:block;width:100%;max-width:592px;height:auto;border:0">`;
const h3=s=>`<p style="font-size:16px;font-weight:bold;color:${INK};margin:28px 0 8px">${esc(s)}</p>`;
const th=`padding:8px;text-align:left;font-size:12px;color:${MUTE};background:#f1f3f6;border-bottom:1px solid ${LINE}`,td=`padding:6px 8px;font-size:12px;color:${INK};border-bottom:1px solid ${LINE};vertical-align:top`;
const kpi=(val,l,c)=>`<td style="padding:0 28px 0 0"><div style="font-size:30px;font-weight:bold;color:${c}">${val}</div><div style="font-size:12px;color:${MUTE}">${l}</div></td>`;
const sev=g=>g?` <span style="color:${g==='Critique'?'#b3261e':g==='Majeure'?'#a85a00':GREEN};font-weight:bold">· ${esc(g)}</span>`:'';
const rows=week.length?week.map(n=>`<tr><td style="${td};white-space:nowrap">${dm(day(n))}</td><td style="${td}">${esc(n.client||'—')}<br><span style="color:${MUTE};font-size:12px">${esc(n.job||'')}</span></td><td style="${td}">${esc(n.graphiste||'—')}</td><td style="${td}">${esc((n.types&&n.types.length?n.types:[n.type]).join(' + '))}${sev(n.gravite)}</td><td style="${td};white-space:nowrap;text-align:right"><b>${n.timeLost||0}</b> min</td></tr>`).join('')
  :`<tr><td colspan="5" style="${td};color:${MUTE}">Aucune non-conformité cette semaine.</td></tr>`;
const html=`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f7f9"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:640px;width:100%;border:1px solid ${LINE}">
<tr><td bgcolor="#0066cc" style="background:#0066cc;font-size:0;line-height:0"><img src="${RAW}banner.png?v=${v}" width="640" alt="NC Print — ${LABEL}" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:24px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${kpi(week.length,custom?'NC sur la période':'NC cette semaine',BLUE)}${kpi(fmtMin(tl(week)),'temps perdu',TEAL)}${kpi(week.length?Math.round(tl(week)/week.length)+' min':'—','par NC',GREEN)}</tr></table>
<p style="font-size:13px;color:${MUTE};margin:14px 0 0">Cumul de ${MOIS[+monthKey.slice(5)-1].toLowerCase()} : <b style="color:${TEAL}">${monthAll.length} NC · ${fmtMin(tl(monthAll))}</b></p>
${hasMonth?h3('Répartition par type de NC')+img('types','NC par type')+h3('NC par graphiste')+img('graphistes','NC par graphiste')+(timeGra.length?h3('Temps perdu par graphiste')+img('temps','Temps perdu par graphiste'):''):''}
${h3('Évolution sur 6 mois (nombre de NC et temps perdu)')}${img('mois','NC par mois')}
${h3('Détail des non-conformités ('+week.length+')')}
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${LINE}"><tr><th style="${th}">Date</th><th style="${th}">Client / job</th><th style="${th}">Graphiste</th><th style="${th}">Type(s)</th><th style="${th};text-align:right">Temps</th></tr>${rows}</table>
<p style="font-size:12px;color:${MUTE};margin:28px 0 0">Rapport généré automatiquement par NC Print. Si les graphiques ne s'affichent pas, autorisez l'affichage des images.</p>
</td></tr></table></td></tr></table></body></html>`;
fs.writeFileSync('report/rapport.html',html.replace(/\n/g,''));
fs.writeFileSync('report/meta.json',JSON.stringify({generatedAt:now.toISOString(),subject:`NC Print — rapport ${custom?'':'hebdomadaire — '}${LABEL}`,weekNC:week.length,monthNC:monthAll.length,totalNC:all.length,text:`NC Print — ${LABEL} : ${week.length} NC, ${fmtMin(tl(week))} perdues. Mois en cours : ${monthAll.length} NC, ${fmtMin(tl(monthAll))}.`},null,2));
console.log('OK',week.length,'NC semaine,',month.length,'mois,',all.length,'total');
