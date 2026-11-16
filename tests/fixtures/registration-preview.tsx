import React from 'react'
import { createRoot } from 'react-dom/client'
import { PartnerRegistration } from '../../src/features/admin/PartnerRegistration'
import { StaffRegistration } from '../../src/features/admin/StaffRegistration'
import '../../src/styles.css'
import '../../src/redesign.css'
const api={savePartner:async()=>{if(sessionStorage.getItem('fail')==='partner')throw Error('Falha simulada');return 'partner-id'},command:async()=>{if(sessionStorage.getItem('fail')==='staff')throw Error('Falha simulada');return {}}}
function Preview(){const[who,setWho]=React.useState('user-a');return <main><button onClick={()=>setWho(who==='user-a'?'user-b':'user-a')}>Trocar usuário</button><button onClick={()=>window.dispatchEvent(new Event('rkmed:internal-navigation'))}>Navegar</button><PartnerRegistration key={'p'+who} api={api as any} actorId={who} online onSuccess={async()=>{document.body.dataset.partnerSuccess='yes'}}/><StaffRegistration key={'s'+who} api={api as any} actorId={who} online partners={[]} onSuccess={()=>{document.body.dataset.staffSuccess='yes'}} /></main>}
createRoot(document.getElementById('root')!).render(<Preview />)
