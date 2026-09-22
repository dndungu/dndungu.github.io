/* Saved conversations use private recovery tokens; no credential belongs in source. */
(function(){
'use strict';
const form=document.getElementById('askForm');if(!form)return;
const input=document.getElementById('q'),thread=document.getElementById('thread'),voice=document.getElementById('voiceBtn');
const status=document.getElementById('chat-status'),select=document.getElementById('chat-history'),newButton=document.getElementById('chat-new'),deleteButton=document.getElementById('chat-delete');
const endpoint='https://nd-4f385fbf915449f88e3805712d0e98b4.ecs.us-west-2.on.aws/api/ask';
const conversationURL=endpoint.replace(/\/ask$/,'/conversation'),storageKey='ndungu-chat-v1';
const greeting='I’m David’s AI assistant. What are you using coding agents for, and what still takes too much of your time?';
let asking=false,unanswered=false,persistent=true,chats=[],token='',booking=null,bookingCard=null;
function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')}
function save(deleted=''){try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored&&Array.isArray(stored.chats)){const known=new Map(stored.chats.filter(c=>c&&/^[a-f0-9]{64}$/.test(c.token)&&typeof c.title==='string').map(c=>[c.token,c]));for(const c of chats)known.set(c.token,c);known.delete(deleted);chats=Array.from(known.values())}localStorage.setItem(storageKey,JSON.stringify({current:token,chats}));persistent=true}catch{persistent=false}}
function notice(){status.textContent=persistent?'Saved for your next visit in this browser. David can review this conversation.':'David can review this conversation, but this browser cannot save its recovery key. Keep this page open to continue.'}
function options(){save();select.replaceChildren();for(const c of chats){const option=document.createElement('option');option.value=c.token;option.textContent=c.title;select.append(option)}select.value=token}
function busy(value){asking=value;input.disabled=value||unanswered;voice.disabled=value||unanswered;form.querySelector('[type="submit"]').disabled=value||unanswered;select.disabled=value;newButton.disabled=value;deleteButton.disabled=value;document.querySelectorAll('[data-book-call]').forEach(b=>b.disabled=value||unanswered);form.setAttribute('aria-busy',String(value))}
function render(text){
 const fragment=document.createDocumentFragment(),pattern=/\[([^\]]+)\]\(([^)\s]+)\)/g;let offset=0,match;
 function plain(value){value.split('\n').forEach((line,i)=>{if(i)fragment.append(document.createElement('br'));fragment.append(document.createTextNode(line))})}
 while((match=pattern.exec(text))){plain(text.slice(offset,match.index));let url;try{url=new URL(match[2])}catch{}
  if(url&&url.href==='https://cal.com/david-ndungu/discovery'){const button=document.createElement('button');button.type='button';button.className='retry';button.dataset.bookCall='';button.textContent=match[1];button.onclick=openBooking;fragment.append(button)}else if(url&&url.protocol==='https:'&&['ndungu.dev','www.ndungu.dev','cal.com','ajent.social','github.com','kazi.sire.run','sire.run'].includes(url.hostname)){const link=document.createElement('a');link.href=url.href;link.textContent=match[1];link.target='_blank';link.rel='noopener noreferrer';fragment.append(link)}else plain(match[1]);offset=pattern.lastIndex;
 }plain(text.slice(offset));return fragment;
}
function bubble(role,text){const row=document.createElement('div');row.className='msg '+role;const body=document.createElement('div');body.className='bubble';body.append(render(text));row.append(body);thread.append(row);thread.scrollTop=thread.scrollHeight;return body}
function retry(body,message,action){body.textContent=message+' ';const button=document.createElement('button');button.type='button';button.className='retry';button.textContent='Try again';button.onclick=()=>{if(!asking)action()};body.append(button)}
async function request(url,init={}){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),70000);try{const response=await fetch(url,{...init,headers:{'Content-Type':'application/json','X-Conversation-Token':token},signal:controller.signal,cache:'no-store'});if(!response.ok){const messages={409:'This conversation has another reply in progress. Wait a moment, then retry.',413:'This conversation is full. Start a new chat to continue.',429:'The chat has reached its hourly limit. Please try later or book a call below.',503:'The assistant or saved chats are unavailable. Please try again.',502:'The AI service could not answer just now.'};throw new Error(messages[response.status]||'Your request could not be completed.')}return response.status===204?null:response.json()}finally{clearTimeout(timeout)}}
function errorText(err){return err.name==='AbortError'?'The request took too long. Your message may already be saved.':err instanceof TypeError?'The chat could not be reached.':err.message}
async function ask(q,id=crypto.randomUUID(),addUser=true){
 if(asking)return;busy(true);input.value='';if(addUser)bubble('user',q);const pending=bubble('ai','···');pending.classList.add('pending-dots');
 const entry=chats.find(c=>c.token===token);if(entry&&entry.title==='New conversation'){entry.title=q.slice(0,80);options()}
 try{const data=await request(endpoint,{method:'POST',body:JSON.stringify({message:q,requestId:id})});if(typeof data.answer!=='string'||!data.answer.trim())throw new Error('The assistant returned an empty answer.');pending.replaceChildren(render(data.answer));unanswered=false;notice()}
 catch(err){unanswered=true;retry(pending,errorText(err),()=>{pending.parentElement.remove();ask(q,id,false)})}
 finally{pending.classList.remove('pending-dots');busy(false);thread.scrollTop=thread.scrollHeight;if(!unanswered)input.focus({preventScroll:true})}
}
async function restore(){
 if(asking)return;unanswered=false;busy(true);status.textContent='Loading saved conversation…';
 try{const data=await request(conversationURL);if(!Array.isArray(data.turns))throw new Error('The saved conversation could not be read.');thread.replaceChildren();if(!data.turns.length)bubble('ai',greeting);
 for(const turn of data.turns){bubble('user',turn.question);if(turn.completedAt)bubble('ai',turn.answer);else{unanswered=true;const pending=bubble('ai','');retry(pending,'This message is saved but has no completed reply yet.',()=>{pending.parentElement.remove();ask(turn.question,turn.id,false)})}}
 booking=data.booking||null;bookingCard=null;if(booking)showBooking(booking);notice();
 }catch(err){unanswered=true;thread.replaceChildren();const body=bubble('ai','');retry(body,errorText(err),restore);status.textContent='Your saved conversation has not been cleared.'}
 finally{busy(false)}
}
function fresh(){token=randomToken();chats.push({token,title:'New conversation'});unanswered=false;booking=null;bookingCard=null;thread.replaceChildren();bubble('ai',greeting);options();busy(false);notice()}
try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored&&Array.isArray(stored.chats)){chats=stored.chats.filter(c=>c&&/^[a-f0-9]{64}$/.test(c.token)&&typeof c.title==='string');token=chats.some(c=>c.token===stored.current)?stored.current:''}}catch{persistent=false}
newButton.onclick=()=>{if(!asking)fresh()};
select.onchange=()=>{if(asking)return;token=select.value;save();restore()};
deleteButton.onclick=async()=>{if(asking||!confirm('Delete this conversation from saved chats and David’s transcript archive? This does not cancel a Cal.com booking.'))return;busy(true);try{await request(conversationURL,{method:'DELETE'});chats=chats.filter(c=>c.token!==token);save(token);fresh();status.textContent='Conversation deleted. Start a new chat when you’re ready.'}catch(err){status.textContent=errorText(err)}finally{busy(false)}};
form.addEventListener('submit',e=>{e.preventDefault();if(bookingCard&&bookingCard.contains(e.submitter||document.activeElement))return;const q=input.value.trim();if(!unanswered&&q&&Array.from(q).length<=1000)ask(q)});

const bookingEndpoint=endpoint.replace(/\/ask$/,'/booking');
function element(tag,text,parent){const node=document.createElement(tag);if(text)node.textContent=text;if(parent)parent.append(node);return node}
function bookingButton(parent,text,action){const b=element('button',text,parent);b.type='button';b.onclick=()=>{if(!asking)action()};return b}
function card(title){
 if(bookingCard)bookingCard.parentElement.remove();
 bookingCard=bubble('ai','');bookingCard.classList.add('booking-card');
 const h=element('h3',title,bookingCard);h.tabIndex=-1;h.focus({preventScroll:true});
 return bookingCard;
}
function when(start,zone){return new Intl.DateTimeFormat(undefined,{dateStyle:'full',timeStyle:'short',timeZone:zone}).format(new Date(start))+' · '+zone}
function bookingFallback(parent){const p=element('p','',parent),a=element('a','Open Cal.com',p);a.href='https://cal.com/david-ndungu/discovery';a.target='_blank';a.rel='noopener noreferrer'}
async function bookingRequest(body){
 const res=await request(bookingEndpoint,{method:'POST',body:JSON.stringify(body)});
 if(!res||typeof res.status!=='string')throw new Error('The booking response could not be read.');
 booking=res;const entry=chats.find(c=>c.token===token);if(entry&&entry.title==='New conversation'){entry.title='Discovery call';options()}
 return res;
}
async function refreshBooking(){
 if(asking)return;busy(true);
 try{const data=await request(conversationURL);booking=data.booking||null;if(booking)showBooking(booking);else{const c=card('Booking status unavailable');element('p','Check your email for a Cal.com invitation before booking again.',c);bookingFallback(c)}}
 catch(err){status.textContent=errorText(err)}finally{busy(false)}
}
function showBooking(b){
 const titles={draft:'Review your discovery call',confirmed:'Your call is booked',pending:'Booking requested',failed:'That booking was not completed',unknown:'Check your booking status',submitting:'Checking your booking'};
 const c=card(titles[b.status]||'Check your booking status');
 element('p',when(b.start,b.timeZone)+' · '+b.duration+' minutes',c);
 element('p',b.name+' · '+b.email,c);
 if(b.status==='draft'){
  element('p','Confirming creates the appointment with Cal.com and sends calendar invitations. Your name, email, selected time and booking status are saved with this conversation for you and David to review.',c);
  bookingButton(c,'Confirm booking',()=>confirmBooking(b));
  bookingButton(c,'Change details or time',()=>chooseTime(b));
 }else if(b.status==='confirmed'||b.status==='pending'){
  element('p',b.status==='confirmed'?'Cal.com confirmed your appointment. Check your invitation email for joining, cancellation and rescheduling links.':'Cal.com received your request; it is awaiting approval. Check your email for updates.',c);
  if(b.status==='confirmed'&&b.meetingUrl){try{const u=new URL(b.meetingUrl);if(u.protocol==='https:'){const a=element('a','Join meeting',c);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer'}}catch{}}
  element('p','Reference: '+b.uid,c);
 }else if(b.status==='failed'){
  element('p','The time may have become unavailable, or Cal.com could not accept these details. Choose another time or check your details before trying again.',c);
  bookingButton(c,'Choose another time',()=>chooseTime(b));bookingFallback(c);
 }else{
  element('p','We cannot yet confirm the outcome. Check your email for a Cal.com invitation or contact David before making another booking. This chat will not submit the appointment again.',c);
  bookingButton(c,'Refresh booking status',refreshBooking);
  const a=element('a','Contact David',c);a.href='https://ndungu.dev/contact/';a.target='_blank';a.rel='noopener noreferrer';
 }
 thread.scrollTop=thread.scrollHeight;
}
async function confirmBooking(b){
 if(asking)return;busy(true);bookingCard.querySelectorAll('button').forEach(x=>x.disabled=true);
 try{showBooking(await bookingRequest({action:'confirm',id:b.id,confirmed:true}))}
 catch(err){const c=card('Check before trying again');element('p',errorText(err)+' Check the saved booking status before confirming again.',c);bookingButton(c,'Check saved booking',refreshBooking)}
 finally{busy(false)}
}
function localDate(zone,date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
function field(parent,label,type,value=''){const wrap=element('label',label,parent),input=element('input','',wrap);input.type=type;input.value=value;input.required=true;return input}
async function openBooking(){if(asking||unanswered)return;if(booking)showBooking(booking);else chooseTime()}
function chooseTime(previous=null){
 const c=card('Book a discovery call');element('p','Choose a time to talk with David. Times are shown in your selected time zone.',c);
 const zoneLabel=element('label','Time zone',c),zone=element('select','',zoneLabel);
 let zoneName=previous?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 const zones=Array.from(new Set([zoneName,'UTC',...(Intl.supportedValuesOf?Intl.supportedValuesOf('timeZone'):['America/Los_Angeles','America/New_York','Europe/London','Africa/Nairobi','Asia/Tokyo'])]));
 for(const name of zones){const opt=element('option',name,zone);opt.value=name}zone.value=zoneName;
 const date=field(c,'Week starting','date',localDate(zoneName));date.min=date.value;
 const results=element('div','',c);results.className='booking-times';results.setAttribute('aria-live','polite');
 const load=bookingButton(c,'Find available times',loadTimes);
 zone.onchange=()=>{date.min=localDate(zone.value);if(date.value<date.min)date.value=date.min;results.replaceChildren()};date.onchange=()=>results.replaceChildren();
 bookingFallback(c);
 async function loadTimes(){
  if(!date.reportValidity())return;
  busy(true);load.disabled=true;date.disabled=true;zone.disabled=true;results.textContent='Checking availability…';
  try{
   const data=await request(bookingEndpoint+'/availability?'+new URLSearchParams({start:date.value,timeZone:zone.value}));
   if(!Array.isArray(data.slots))throw new Error('Available times could not be read.');results.replaceChildren();
   if(!data.slots.length)element('p','No times available that week. Try a different date.',results);
   let lastDay='';
   for(const start of data.slots){const day=localDate(zone.value,new Date(start));if(day!==lastDay){element('h4',new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric',timeZone:zone.value}).format(new Date(start)),results);lastDay=day}
    const b=bookingButton(results,new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit',timeZone:zone.value}).format(new Date(start)),()=>details(start,zone.value,data.duration,previous));b.setAttribute('aria-label',when(start,zone.value));
   }
  }catch(err){results.textContent=errorText(err)+' You can also book on Cal.com.'}
  finally{busy(false);load.disabled=false;date.disabled=false;zone.disabled=false;thread.scrollTop=Math.max(0,c.parentElement.offsetTop-thread.offsetTop)}
 }
 loadTimes();
}
function details(start,zone,duration,previous){
 const c=card('Your booking details');element('p',when(start,zone)+' · '+duration+' minutes',c);
 const name=field(c,'Name','text',previous?.name||'');name.maxLength=120;name.autocomplete='name';
 const email=field(c,'Email for your invitation','email',previous?.email||'');email.maxLength=254;email.autocomplete='email';
 element('p','These details are saved with this chat. Cal.com receives them only when you confirm. Booking fields are not sent to the AI model.',c);
 const message=element('p','',c);message.setAttribute('role','status');
 const draftID=crypto.randomUUID();
 const review=bookingButton(c,'Review booking',async()=>{
  if(!name.reportValidity()||!email.reportValidity())return;busy(true);c.querySelectorAll('button,input').forEach(x=>x.disabled=true);
  try{showBooking(await bookingRequest({action:'draft',id:draftID,start,timeZone:zone,name:name.value,email:email.value}))}
  catch(err){message.textContent=errorText(err)}finally{busy(false);c.querySelectorAll('button,input').forEach(x=>x.disabled=false)}
 });
 bookingButton(c,'Back to available times',()=>chooseTime({name:name.value,email:email.value,timeZone:zone}));
 c.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();review.click()}});
 name.focus({preventScroll:true});thread.scrollTop=thread.scrollHeight;
}
document.querySelectorAll('[data-book-call]').forEach(b=>b.onclick=openBooking);
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(Recognition){const recognition=new Recognition();recognition.lang='en-US';recognition.interimResults=false;voice.hidden=false;voice.onclick=()=>{if(voice.getAttribute('aria-pressed')==='true'){recognition.stop();return}try{recognition.start()}catch{}};recognition.onstart=()=>{voice.classList.add('listening');voice.setAttribute('aria-pressed','true')};recognition.onend=()=>{voice.classList.remove('listening');voice.setAttribute('aria-pressed','false')};recognition.onresult=e=>{input.value=e.results[0][0].transcript.slice(0,1000);input.focus()};recognition.onerror=()=>{status.textContent='Voice input is unavailable. Please type your message.'}}
if(token){options();restore()}else fresh();
})();
