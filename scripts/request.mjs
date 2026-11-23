// Demande d'envoi déposée par le bouton de l'app (Firestore nc_print_cmd/rapport)
// usage : node scripts/request.mjs check | done
import fs from 'node:fs';
const P=process.env.FB_PROJECT||'luxvisual-nc-print';
const U=`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents/nc_print_cmd/rapport`;
const mode=process.argv[2];
if(mode==='check'){
  const r=await fetch(U);
  let pending=false;
  if(r.ok){const d=await r.json();pending=d.fields?.status?.stringValue==='demande'}
  else if(r.status!==404)console.error('Firestore',r.status);
  console.log('pending='+pending);
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`pending=${pending}\n`);
}else if(mode==='done'||mode==='fail'){
  let res={ok:0,errors:[]};try{res=JSON.parse(fs.readFileSync('report/send-result.json','utf8'))}catch{}
  const st=mode==='done'?'envoye':'erreur';
  const err=(res.errors||[]).join(' | ').slice(0,400)||(mode==='fail'?'envoi impossible':'');
  const r=await fetch(U+'?updateMask.fieldPaths=status&updateMask.fieldPaths=sentAt&updateMask.fieldPaths=error',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:{status:{stringValue:st},sentAt:{stringValue:new Date().toISOString()},error:{stringValue:err}}})});
  console.log(st,r.status);if(!r.ok)process.exit(1);
}
