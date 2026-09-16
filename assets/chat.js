/* Bubble layout and interaction adapted from sire-chat; no persistent transcripts. */
(function(){
'use strict';
const form=document.getElementById('askForm');if(!form)return;
const input=document.getElementById('q'),thread=document.getElementById('thread'),voice=document.getElementById('voiceBtn');
const history=[];let asking=false;
const encoder=new TextEncoder();
function historyContent(text){let out='',bytes=0;for(const char of text){const size=encoder.encode(char).length;if(bytes+size>3000)break;out+=char;bytes+=size}return out}
// Deployment writes the public API URL here; no credential belongs in this file.
const endpoint='https://nd-4f385fbf915449f88e3805712d0e98b4.ecs.us-west-2.on.aws/api/ask';
const bookingOrigin=new URL(endpoint).origin;
const bookingSlotsURL=bookingOrigin+'/api/booking/slots';
const bookingURL=bookingOrigin+'/api/booking';
const DISCOVERY_URL='https://cal.com/david-ndungu/discovery';
function render(text){
 const fragment=document.createDocumentFragment(),pattern=/\[([^\]]+)\]\(([^)\s]+)\)/g;
 let offset=0,match;
 function plain(value){value.split('\n').forEach((line,i)=>{if(i)fragment.append(document.createElement('br'));fragment.append(document.createTextNode(line))})}
 while((match=pattern.exec(text))){plain(text.slice(offset,match.index));
  let url;try{url=new URL(match[2])}catch{}
  if(url&&url.protocol==='https:'&&['ndungu.dev','www.ndungu.dev','cal.com','ajent.social','github.com','kazi.sire.run','sire.run'].includes(url.hostname)){
   const link=document.createElement('a');link.href=url.href;link.textContent=match[1];
   // The discovery link opens an inline scheduler on a plain click; the real href still works for
   // opening in a new tab, and is the fallback if the booking API is unreachable or unconfigured.
   if(url.href===DISCOVERY_URL){link.addEventListener('click',e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();openBooking()}})}
   else{link.target='_blank';link.rel='noopener noreferrer'}
   fragment.append(link);
  }else plain(match[1]);offset=pattern.lastIndex;
 }plain(text.slice(offset));return fragment;
}
function bubble(role,text){const row=document.createElement('div');row.className='msg '+role;const body=document.createElement('div');body.className='bubble';if(text!=null)body.append(render(text));row.append(body);thread.append(row);thread.scrollTop=thread.scrollHeight;return body}
function error(body,message,q){body.textContent=message+' ';const retry=document.createElement('button');retry.type='button';retry.className='retry';retry.textContent='Try again';retry.onclick=()=>{if(!asking){body.parentElement.remove();ask(q,false)}};body.append(retry)}
const visitorTZ=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch{return 'UTC'}})();
function isoDate(d){return d.toISOString().slice(0,10)}
async function fetchTimed(url,opts,ms){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...opts,signal:controller.signal})}finally{clearTimeout(timeout)}}
function bookingFallback(panel,message){panel.textContent='';const p=document.createElement('p');p.className='booking-status';p.textContent=message+' ';const a=document.createElement('a');a.href=DISCOVERY_URL;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open the booking page';p.append(a);panel.append(p)}
function openBooking(){const body=bubble('ai');body.classList.add('booking-bubble');const panel=document.createElement('div');panel.className='booking';body.append(panel);thread.scrollTop=thread.scrollHeight;loadSlots(panel)}
async function loadSlots(panel,notice){
 panel.textContent='';const status=document.createElement('p');status.className='booking-status';status.textContent=(notice?notice+' ':'')+'Loading available times…';panel.append(status);
 const start=new Date(),end=new Date(start.getTime()+14*24*60*60*1000);
 const q=new URLSearchParams({start:isoDate(start),end:isoDate(end),timeZone:visitorTZ});
 try{
  const res=await fetchTimed(bookingSlotsURL+'?'+q,{},15000);
  if(!res.ok)throw new Error(res.status===503?'Live booking isn’t available right now.':'Could not load available times.');
  const data=await res.json();
  renderSlots(panel,data&&data.slots||{});
 }catch(err){bookingFallback(panel,err.name==='AbortError'?'That took too long.':err.message)}
}
function renderSlots(panel,slots){
 const dates=Object.keys(slots).filter(d=>slots[d]&&slots[d].length).sort();
 panel.textContent='';
 if(!dates.length){bookingFallback(panel,'No times are open in the next two weeks.');return}
 const status=document.createElement('p');status.className='booking-status';status.textContent='Pick a time ('+visitorTZ+'):';panel.append(status);
 const list=document.createElement('div');list.className='booking-days';panel.append(list);
 dates.forEach(date=>{
  const group=document.createElement('div');group.className='booking-day';
  const label=document.createElement('div');label.className='booking-day-label';
  label.textContent=new Date(date+'T00:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  group.append(label);
  const row=document.createElement('div');row.className='booking-slots';
  slots[date].forEach(slot=>{
   const btn=document.createElement('button');btn.type='button';btn.className='booking-slot';
   btn.textContent=new Date(slot.start).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
   btn.onclick=()=>renderBookingForm(panel,slot);
   row.append(btn);
  });
  group.append(row);list.append(group);
 });
}
function renderBookingForm(panel,slot){
 panel.textContent='';
 const when=new Date(slot.start).toLocaleString(undefined,{weekday:'long',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 const status=document.createElement('p');status.className='booking-status';status.textContent='Confirm for '+when+':';panel.append(status);
 const form=document.createElement('form');form.className='booking-form';
 const name=document.createElement('input');name.type='text';name.placeholder='Your name';name.required=true;name.maxLength=200;name.autocomplete='name';name.setAttribute('aria-label','Your name');
 const email=document.createElement('input');email.type='email';email.placeholder='Your email';email.required=true;email.autocomplete='email';email.setAttribute('aria-label','Your email');
 const submit=document.createElement('button');submit.type='submit';submit.textContent='Confirm booking';
 const back=document.createElement('button');back.type='button';back.textContent='Choose another time';back.className='retry';back.onclick=()=>loadSlots(panel);
 form.append(name,email,submit,back);panel.append(form);
 name.focus();
 form.addEventListener('submit',async e=>{
  e.preventDefault();submit.disabled=true;back.disabled=true;submit.textContent='Booking…';
  try{
   const res=await fetchTimed(bookingURL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.value.trim(),email:email.value.trim(),start:slot.start,timeZone:visitorTZ})},20000);
   if(res.status===409){loadSlots(panel,'That time was just taken.');return}
   if(!res.ok)throw new Error('Booking could not be completed.');
   panel.textContent='';const ok=document.createElement('p');ok.className='booking-status';ok.textContent='Booked for '+when+'. Check your email for details.';panel.append(ok);
  }catch(err){bookingFallback(panel,err.name==='AbortError'?'That took too long.':err.message)}
 });
}
async function ask(q,addUser=true){
 if(asking)return;asking=true;input.value='';input.disabled=true;voice.disabled=true;form.setAttribute('aria-busy','true');
 if(addUser)bubble('user',q);const pending=bubble('ai','···');pending.classList.add('pending-dots');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),52000);
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,history:history.slice(-8)}),signal:controller.signal});
  if(!response.ok){const messages={429:'The chat has reached its hourly limit. Please try later or book a call below.',503:'The assistant is unavailable right now. You can book a call below.',502:'The AI service could not answer just now.'};throw new Error(messages[response.status]||'Your message could not be sent.')}
  const data=await response.json();if(typeof data.answer!=='string'||!data.answer.trim())throw new Error('The assistant returned an empty answer.');
  pending.replaceChildren(render(data.answer));history.push({role:'user',content:q},{role:'assistant',content:historyContent(data.answer)});if(history.length>8)history.splice(0,history.length-8);
 }catch(err){error(pending,err.name==='AbortError'?'The assistant took too long to respond.':err instanceof TypeError?'The chat could not be reached.':err.message,q)}
 finally{clearTimeout(timeout);pending.classList.remove('pending-dots');input.disabled=false;voice.disabled=false;asking=false;form.removeAttribute('aria-busy');thread.scrollTop=thread.scrollHeight;input.focus({preventScroll:true})}
}
form.addEventListener('submit',e=>{e.preventDefault();const q=input.value.trim();if(q&&q.length<=1000)ask(q)});
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(Recognition){const recognition=new Recognition();recognition.lang='en-US';recognition.interimResults=false;voice.hidden=false;
 voice.onclick=()=>{if(voice.getAttribute('aria-pressed')==='true'){recognition.stop();return}try{recognition.start()}catch{}};
 recognition.onstart=()=>{voice.classList.add('listening');voice.setAttribute('aria-pressed','true')};
 recognition.onend=()=>{voice.classList.remove('listening');voice.setAttribute('aria-pressed','false')};
 recognition.onresult=e=>{input.value=e.results[0][0].transcript.slice(0,1000);input.focus()};
 recognition.onerror=()=>{document.getElementById('chat-status').textContent='Voice input is unavailable. Please type your message. Messages go to OpenRouter and its model provider.'};
}
})();
