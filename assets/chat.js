/* Saved conversations use private recovery tokens; no credential belongs in source. */
(function(){
'use strict';
const form=document.getElementById('askForm');if(!form)return;
const input=document.getElementById('q'),thread=document.getElementById('thread'),voice=document.getElementById('voiceBtn');
const status=document.getElementById('chat-status'),select=document.getElementById('chat-history'),newButton=document.getElementById('chat-new'),deleteButton=document.getElementById('chat-delete');
const endpoint='https://nd-4f385fbf915449f88e3805712d0e98b4.ecs.us-west-2.on.aws/api/ask';
const conversationURL=endpoint.replace(/\/ask$/,'/conversation'),storageKey='ndungu-chat-v1';
const greeting='I’m David’s AI assistant. What are you using coding agents for, and what still takes too much of your time?';
let asking=false,unanswered=false,persistent=true,chats=[],token='';
function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')}
function save(deleted=''){try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored&&Array.isArray(stored.chats)){const known=new Map(stored.chats.filter(c=>c&&/^[a-f0-9]{64}$/.test(c.token)&&typeof c.title==='string').map(c=>[c.token,c]));for(const c of chats)known.set(c.token,c);known.delete(deleted);chats=Array.from(known.values())}localStorage.setItem(storageKey,JSON.stringify({current:token,chats}));persistent=true}catch{persistent=false}}
function notice(){status.textContent=persistent?'Saved for your next visit in this browser. David can review this conversation.':'David can review this conversation, but this browser cannot save its recovery key. Keep this page open to continue.'}
function options(){save();select.replaceChildren();for(const c of chats){const option=document.createElement('option');option.value=c.token;option.textContent=c.title;select.append(option)}select.value=token}
function busy(value){asking=value;input.disabled=value||unanswered;voice.disabled=value||unanswered;form.querySelector('[type="submit"]').disabled=value||unanswered;select.disabled=value;newButton.disabled=value;deleteButton.disabled=value;form.setAttribute('aria-busy',String(value))}
function render(text){
 const fragment=document.createDocumentFragment(),pattern=/\[([^\]]+)\]\(([^)\s]+)\)/g;let offset=0,match;
 function plain(value){value.split('\n').forEach((line,i)=>{if(i)fragment.append(document.createElement('br'));fragment.append(document.createTextNode(line))})}
 while((match=pattern.exec(text))){plain(text.slice(offset,match.index));let url;try{url=new URL(match[2])}catch{}
  if(url&&url.protocol==='https:'&&['ndungu.dev','www.ndungu.dev','cal.com','ajent.social','github.com','kazi.sire.run','sire.run'].includes(url.hostname)){const link=document.createElement('a');link.href=url.href;link.textContent=match[1];link.target='_blank';link.rel='noopener noreferrer';fragment.append(link)}else plain(match[1]);offset=pattern.lastIndex;
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
 notice();
 }catch(err){unanswered=true;thread.replaceChildren();const body=bubble('ai','');retry(body,errorText(err),restore);status.textContent='Your saved conversation has not been cleared.'}
 finally{busy(false)}
}
function fresh(){token=randomToken();chats.push({token,title:'New conversation'});unanswered=false;thread.replaceChildren();bubble('ai',greeting);options();busy(false);notice()}
try{const stored=JSON.parse(localStorage.getItem(storageKey)||'null');if(stored&&Array.isArray(stored.chats)){chats=stored.chats.filter(c=>c&&/^[a-f0-9]{64}$/.test(c.token)&&typeof c.title==='string');token=chats.some(c=>c.token===stored.current)?stored.current:''}}catch{persistent=false}
newButton.onclick=()=>{if(!asking)fresh()};
select.onchange=()=>{if(asking)return;token=select.value;save();restore()};
deleteButton.onclick=async()=>{if(asking||!confirm('Delete this conversation from saved chats and David’s transcript archive?'))return;busy(true);try{await request(conversationURL,{method:'DELETE'});chats=chats.filter(c=>c.token!==token);save(token);fresh();status.textContent='Conversation deleted. Start a new chat when you’re ready.'}catch(err){status.textContent=errorText(err)}finally{busy(false)}};
form.addEventListener('submit',e=>{e.preventDefault();const q=input.value.trim();if(!unanswered&&q&&Array.from(q).length<=1000)ask(q)});
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(Recognition){const recognition=new Recognition();recognition.lang='en-US';recognition.interimResults=false;voice.hidden=false;voice.onclick=()=>{if(voice.getAttribute('aria-pressed')==='true'){recognition.stop();return}try{recognition.start()}catch{}};recognition.onstart=()=>{voice.classList.add('listening');voice.setAttribute('aria-pressed','true')};recognition.onend=()=>{voice.classList.remove('listening');voice.setAttribute('aria-pressed','false')};recognition.onresult=e=>{input.value=e.results[0][0].transcript.slice(0,1000);input.focus()};recognition.onerror=()=>{status.textContent='Voice input is unavailable. Please type your message.'}}
if(token){options();restore()}else fresh();
})();
