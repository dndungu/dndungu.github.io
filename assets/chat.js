/* Bubble layout and interaction adapted from sire-chat; no persistent transcripts. */
(function(){
'use strict';
const form=document.getElementById('askForm');if(!form)return;
const input=document.getElementById('q'),thread=document.getElementById('thread'),voice=document.getElementById('voiceBtn');
const history=[];let asking=false;
// Deployment writes the public API URL here; no credential belongs in this file.
const endpoint='https://nd-4f385fbf915449f88e3805712d0e98b4.ecs.us-west-2.on.aws/api/ask';
function render(text){
 const fragment=document.createDocumentFragment(),pattern=/\[([^\]]+)\]\(([^)\s]+)\)/g;
 let offset=0,match;
 function plain(value){value.split('\n').forEach((line,i)=>{if(i)fragment.append(document.createElement('br'));fragment.append(document.createTextNode(line))})}
 while((match=pattern.exec(text))){plain(text.slice(offset,match.index));
  let url;try{url=new URL(match[2])}catch{}
  if(url&&url.protocol==='https:'&&['ndungu.dev','www.ndungu.dev','cal.com','ajent.social','github.com','kazi.sire.run','sire.run'].includes(url.hostname)){
   const link=document.createElement('a');link.href=url.href;link.textContent=match[1];link.target='_blank';link.rel='noopener noreferrer';fragment.append(link);
  }else plain(match[1]);offset=pattern.lastIndex;
 }plain(text.slice(offset));return fragment;
}
function bubble(role,text){const row=document.createElement('div');row.className='msg '+role;const body=document.createElement('div');body.className='bubble';body.append(render(text));row.append(body);thread.append(row);thread.scrollTop=thread.scrollHeight;return body}
function error(body,message,q){body.textContent=message+' ';const retry=document.createElement('button');retry.type='button';retry.className='retry';retry.textContent='Try again';retry.onclick=()=>{if(!asking){body.parentElement.remove();ask(q,false)}};body.append(retry)}
async function ask(q,addUser=true){
 if(asking)return;asking=true;input.value='';input.disabled=true;voice.disabled=true;form.setAttribute('aria-busy','true');
 if(addUser)bubble('user',q);const pending=bubble('ai','···');pending.classList.add('pending-dots');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),52000);
 try{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,history:history.slice(-8)}),signal:controller.signal});
  if(!response.ok){const messages={429:'The chat has reached its hourly limit. Please try later or book a call below.',503:'The assistant is unavailable right now. You can book a call below.',502:'The AI service could not answer just now.'};throw new Error(messages[response.status]||'Your message could not be sent.')}
  const data=await response.json();if(typeof data.answer!=='string'||!data.answer.trim())throw new Error('The assistant returned an empty answer.');
  pending.replaceChildren(render(data.answer));history.push({role:'user',content:q},{role:'assistant',content:data.answer.slice(0,3000)});if(history.length>8)history.splice(0,history.length-8);
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
