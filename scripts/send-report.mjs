// Envoi du rapport via Resend (clé dans le secret GitHub RESEND_API_KEY), un mail par destinataire
import fs from 'node:fs';
const key=process.env.RESEND_API_KEY;
if(!key){console.error('RESEND_API_KEY absent : envoi impossible.');fs.writeFileSync('report/send-result.json',JSON.stringify({ok:0,errors:['clé RESEND_API_KEY absente']}));process.exit(1)}
let to=(process.env.REPORT_TO||'').split(',').map(s=>s.trim()).filter(Boolean);
if(!to.length){
  try{const r=await fetch('https://firestore.googleapis.com/v1/projects/'+(process.env.FB_PROJECT||'luxvisual-nc-print')+'/databases/(default)/documents/nc_print_cmd/config');
    if(r.ok){const d=await r.json();to=(d.fields?.to?.arrayValue?.values||[]).map(v=>v.stringValue).filter(Boolean)}}catch(e){console.error('config destinataires',e.message)}
}
if(!to.length)to=['pao@luxvisual.lu'];
console.log('Destinataires :',to.join(', '));
const from=process.env.REPORT_FROM||'NC Print <onboarding@resend.dev>';
const meta=JSON.parse(fs.readFileSync('report/meta.json','utf8'));
const html=fs.readFileSync('report/rapport.html','utf8');
const subject=(process.env.REPORT_TEST==='true'?'[TEST] ':'')+meta.subject;
let ok=0;const errs=[];
for(const dest of to){
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[dest],subject,html,text:meta.text})});
  const body=await r.text();console.log(dest,r.status,body);
  if(r.ok)ok++;else{let m=body;try{m=JSON.parse(body).message||body}catch{}errs.push(dest+' : '+m)}
}
fs.writeFileSync('report/send-result.json',JSON.stringify({ok,errors:errs}));
if(!ok)process.exit(1);
