// Envoi du rapport via Resend (clé dans le secret GitHub RESEND_API_KEY)
import fs from 'node:fs';
const key=process.env.RESEND_API_KEY;
if(!key){console.error('RESEND_API_KEY absent : envoi ignoré.');process.exit(0)}
const to=(process.env.REPORT_TO||'pao@luxvisual.lu').split(',').map(s=>s.trim()).filter(Boolean);
const from=process.env.REPORT_FROM||'NC Print <onboarding@resend.dev>';
const meta=JSON.parse(fs.readFileSync('report/meta.json','utf8'));
const html=fs.readFileSync('report/rapport.html','utf8');
const subject=(process.env.REPORT_TEST==='true'?'[TEST] ':'')+meta.subject;
const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to,subject,html,text:meta.text})});
const body=await r.text();
console.log(r.status,body);
if(!r.ok)process.exit(1);
