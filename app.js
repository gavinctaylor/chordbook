'use strict';
const $=id=>document.getElementById(id);
const storageNamespace='chordbook:'+new URL('./',location.href).pathname;
const order=new Intl.Collator('en',{sensitivity:'base',numeric:true});
let library=window.STARTER_LIBRARY,db,pending=null,source=null,pendingSource=null,syncBusy=false,lyricsLibrary=null,pendingLyrics=null; 
function note(text){$('message').textContent=text;$('message').hidden=false;}
function artists(){return [...new Set(library.map(s=>s.artist))].sort(order.compare);}
function renderLibrary(preferred){
  const list=artists();$('welcome').hidden=library.length>0;$('artist').disabled=!list.length;document.querySelector('.reading-layout').hidden=!library.length;document.querySelector('.section-heading').hidden=!library.length;$('artist').replaceChildren(...list.map(name=>new Option(name,name)));
  if(list.includes(preferred))$('artist').value=preferred;
  $('library-count').textContent=`${list.length} ${list.length===1?'artist':'artists'} · ${library.length} ${library.length===1?'song':'songs'}`;
  renderSongs();
}
function formatChords(element,text){
  // Recognize section labels only at the start of a line, never chord names.
  const label='(?:pre[- ]?chorus|post[- ]?chorus|chorus|verse|bridge|intro|outro|ending|instrumental|interlude|solo|break|pre|post|ch|bg|br|cb|v|i|s|o)(?:[ \t]*[0-9]+)?';
  const section=new RegExp('^([ \t]*)('+label+'(?:[ \t]*[+&/][ \t]*'+label+')*(?:[):.]|(?=[ \t]|$)))','i');
  const lines=String(text).split('\n');
  element.replaceChildren();
  lines.forEach((line,i)=>{
    if(i)element.append(document.createTextNode('\n'));
    const match=line.match(section);
    if(!match){element.append(document.createTextNode(line));return;}
    element.append(document.createTextNode(match[1]));
    const tag=document.createElement('span');tag.className='section-label';tag.textContent=match[2];
    element.append(tag,document.createTextNode(line.slice(match[0].length)));
  });
}
function renderSongs(){
  const artist=$('artist').value;
  const lyricMatches=LyricsLibrary.match(lyricsLibrary?.entries||[],library).bySong;
  const songs=library.filter(s=>s.artist===artist).sort((a,b)=>order.compare(a.song,b.song));
  $('artist-heading').textContent=artist;$('song-count').textContent=`${songs.length} ${songs.length===1?'song':'songs'}`;
  $('songs').replaceChildren(...songs.map(s=>{
    const card=document.createElement('article'),title=document.createElement('h3'),chords=document.createElement('pre');
    title.textContent=s.song;formatChords(chords,s.chords);
    const heading=document.createElement('div');heading.className='song-heading';heading.append(title);
    if(s.key){const key=document.createElement('p');key.className='song-key';key.textContent='Key: '+s.key;heading.append(key);}
    const text=lyricMatches.get(library.indexOf(s));
    card.append(heading);
    if(text){
      const views=document.createElement('div');views.className='song-views';views.setAttribute('role','group');views.setAttribute('aria-label',s.song+' view');
      const chordButton=document.createElement('button'),lyricsButton=document.createElement('button'),lyrics=document.createElement('pre');
      chordButton.textContent='Chords';lyricsButton.textContent='Lyrics';lyrics.className='lyrics-text';lyrics.textContent=text;lyrics.hidden=true;
      [chordButton,lyricsButton].forEach(b=>{b.type='button';b.className='secondary';});
      chordButton.setAttribute('aria-pressed','true');lyricsButton.setAttribute('aria-pressed','false');
      function showLyrics(show){chords.hidden=show;lyrics.hidden=!show;chordButton.setAttribute('aria-pressed',String(!show));lyricsButton.setAttribute('aria-pressed',String(show));}
      chordButton.addEventListener('click',()=>showLyrics(false));lyricsButton.addEventListener('click',()=>showLyrics(true));
      views.append(chordButton,lyricsButton);card.append(views,chords,lyrics);
    }else{card.append(chords);if(lyricsLibrary){const missing=document.createElement('p');missing.className='lyrics-missing';missing.textContent='No lyrics matched for this song.';card.append(missing);}}
    return card;
  }));
}
function openDatabase(){return new Promise((resolve,reject)=>{
  const request=indexedDB.open(storageNamespace,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('library');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
function readSaved(){return new Promise((resolve,reject)=>{
  const request=db.transaction('library').objectStore('library').get('current');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
function saveLibrary(value){return new Promise((resolve,reject)=>{
  const tx=db.transaction('library','readwrite');tx.objectStore('library').put(value,'current');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
function updated(iso){$('updated').textContent='Imported '+new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
$('artist').addEventListener('change',renderSongs);
$('import').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{
    if(syncBusy||$('confirm').open||$('lyrics-confirm').open)return;
    if(!db)throw Error('Device storage is unavailable. Reopen the app before importing.');
    if(file.size>2*1024*1024)throw Error('Please use a CSV smaller than 2 MB.');
    pending=parseLibrary(await file.text());pendingSource=null;
    $('import-summary').textContent=`${pending.length} songs by ${new Set(pending.map(s=>s.artist)).size} artists from ${file.name}.`;
    $('confirm').showModal();renderSource();
  }catch(error){pending=null;note(error.message);}
});
$('replace').addEventListener('click',async event=>{
  event.preventDefault();if(!pending)return;
  $('replace').disabled=true;
  try{
    const value={songs:pending,source:pendingSource,lyricsLibrary,importedAt:new Date().toISOString()};
    await saveLibrary(value);
    const preferred=$('artist').value;library=value.songs;source=value.source;pending=null;pendingSource=null;renderLibrary(preferred);updated(value.importedAt);renderSource();
    $('confirm').close();note('Library saved on this device.');
    if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  }catch(error){$('confirm').close();note('The new library could not be saved. Your previous library is unchanged.');}
  finally{$('replace').disabled=false;}
});
async function offlineSetup(){
  if(!('serviceWorker' in navigator)||!window.isSecureContext){$('offline').textContent='Preview only · offline installation needs a secure web address';return;}
  try{
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    const channel=new MessageChannel();
    const ready=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Timed out')),10000);channel.port1.onmessage=e=>{clearTimeout(timeout);resolve(e.data.ready);};navigator.serviceWorker.controller.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);});
    if(!ready)throw Error('Incomplete offline copy');
    $('offline').textContent='Saved for offline use';$('offline').classList.add('ready');
    if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  }catch(error){$('offline').textContent='Offline setup incomplete · reconnect and reopen';}
}
(async()=>{
  renderLibrary();$('import').disabled=true;
  try{db=await openDatabase();const saved=await readSaved();if(saved?.songs?.length){library=saved.songs;source=saved.source||null;lyricsLibrary=saved.lyricsLibrary||null;renderLibrary();updated(saved.importedAt);}}
  catch(error){note('Saved library could not be opened. Imports are unavailable until device storage works.');}
  $('import').disabled=!db;renderSource();offlineSetup();if(SheetsConnection.configured()&&navigator.onLine)SheetsConnection.prepare().catch(()=>{});
})();

function renderSource(){
  $('google-update').textContent=source?(lyricsLibrary?'Update library':'Update from Google Sheets'):'Connect Google Sheets';
  $('google-change').hidden=!source;
  $('google-source').textContent=source?source.name+' · '+source.tab:'Connect your sheet once, then update here while online.';
  $('lyrics-connect').textContent=lyricsLibrary?'Change lyrics document':'Connect lyrics document';
  $('lyrics-update').hidden=!lyricsLibrary;
  $('lyrics-source').textContent=lyricsLibrary?lyricsLibrary.source.name+' · '+LyricsLibrary.match(lyricsLibrary.entries,library).bySong.size+' songs with lyrics · Saved '+new Date(lyricsLibrary.importedAt).toLocaleDateString():'Optional: import all lyrics from one Google Doc. Import your chords first.';
  const busy=syncBusy||$('confirm').open||$('lyrics-confirm').open;
  for(const id of ['google-update','google-change','google-signin','lyrics-connect','lyrics-update','import'])$(id).disabled=!db||busy;
  if(!library.length){$('lyrics-connect').disabled=true;$('lyrics-update').disabled=true;}
}
function chooseTab(sheets){if(!sheets.length)return Promise.reject(Error("This spreadsheet has no worksheets."));return new Promise(resolve=>{
  if(sheets.length===1){resolve(sheets[0].properties);return;}
  $('worksheet').replaceChildren(...sheets.map(s=>new Option(s.properties.title,String(s.properties.sheetId))));
  $('tabs').addEventListener('close',()=>resolve($('tabs').returnValue==='choose'?sheets.find(s=>String(s.properties.sheetId)===$('worksheet').value).properties:null),{once:true});
  $('tabs').returnValue='';$('tabs').showModal();
});}
function syncGoogle(change){
  if(syncBusy||!db||$('confirm').open||$('lyrics-confirm').open)return;
  if(!navigator.onLine){note('Connect to the internet to update. Your saved songs are still available offline.');return;}
  if(!SheetsConnection.configured()){note('Google Sheets connection is being configured for this website. You can import a CSV in the meantime.');return;}
  if(!SheetsConnection.ready()){
    note('Connecting to Google…');
    SheetsConnection.prepare().then(()=>note('Google is ready. Tap the Google Sheets button again to sign in.')).catch(e=>note(e.message));return;
  }
  syncBusy=true;renderSource();$('import').disabled=true;
  // Request permission in this user gesture, before awaiting any network work.
  const authorization=SheetsConnection.authorize();
  (async()=>{
    try{
      await authorization;let target=source;
      if(change||!target){
        const selected=await SheetsConnection.pick();if(!selected)return;
        const meta=await SheetsConnection.metadata(selected.spreadsheetId);
        const tab=await chooseTab(meta.sheets||[]);if(!tab)return;
        target={...selected,sheetId:tab.sheetId,tab:tab.title};
      }
      note('Downloading your songs…');
      const result=await SheetsConnection.download(target);
      if(change||!source){
        pending=result.songs;pendingSource=result.source;
        $('import-summary').textContent=`${pending.length} songs by ${new Set(pending.map(s=>s.artist)).size} artists from ${result.source.name} · ${result.source.tab}. Future updates will use this worksheet.`;
        $('confirm').showModal();renderSource();
      }else{
        const value={songs:result.songs,source:result.source,lyricsLibrary,importedAt:new Date().toISOString()};
        if(lyricsLibrary){
          note('Downloading your lyrics…');value.lyricsLibrary=await SheetsConnection.downloadLyrics(lyricsLibrary.source);
          previewLyrics(value);
        }else{
          await commitLibrary(value);note('Updated from Google Sheets and saved for offline use.');
        }
      }
    }catch(e){note(e.message+' Your saved library has not changed.');}
    finally{syncBusy=false;renderSource();}
  })();
}
$('google-update').addEventListener('click',()=>syncGoogle(false));
$('google-change').addEventListener('click',()=>syncGoogle(true));
window.addEventListener('online',()=>{if(SheetsConnection.configured())SheetsConnection.prepare().catch(()=>{});});

$('google-signin').addEventListener('click',()=>{
  if(syncBusy||!db||$('confirm').open||$('lyrics-confirm').open)return;
  if(!navigator.onLine){note('Connect to the internet to sign in. Your saved songs are still available.');return;}
  if(!SheetsConnection.ready()){
    note('Loading Google sign-in…');SheetsConnection.prepare().then(()=>note('Google is ready. Tap Sign in again to continue.')).catch(e=>note(e.message));return;
  }
  syncBusy=true;renderSource();$('import').disabled=true;
  SheetsConnection.authorize(true).then(()=>note('Google sign-in refreshed. Now tap '+(source?'Update from Google Sheets.':'Connect Google Sheets.'))).catch(e=>note(e.message)).finally(()=>{syncBusy=false;renderSource();});
});
window.addEventListener('pickeropened',()=>{$('picker-recovery').hidden=false;});
window.addEventListener('pickerclosed',()=>{$('picker-recovery').hidden=true;});
$('close-picker').addEventListener('click',()=>{SheetsConnection.cancelPicker();note('Google chooser closed. Use Sign in again, then retry.');});

$('reload-app').addEventListener('click',()=>location.reload());
if('serviceWorker' in navigator){
  const checkVersion=()=>{
    const controller=navigator.serviceWorker.controller;if(!controller)return;
    const channel=new MessageChannel();channel.port1.onmessage=e=>{if(e.data.version&&e.data.version!=='chordbook-public-v3')$('app-update').hidden=false;channel.port1.close();};
    controller.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);
  };
  navigator.serviceWorker.addEventListener('controllerchange',checkVersion);
}

const chordSize=$('chord-size');
function applyChordSize(value){
  const size=Math.max(16,Math.min(48,Number(value)||27));
  document.documentElement.style.setProperty('--chord-size',size+'px');
  chordSize.value=String(size);chordSize.setAttribute('aria-valuetext',size+' pixels');
  $('chord-size-value').textContent=String(size);
}
try{applyChordSize(localStorage.getItem(storageNamespace+':font-size')||27);}catch(e){applyChordSize(27);}
chordSize.addEventListener('input',()=>{applyChordSize(chordSize.value);try{localStorage.setItem(storageNamespace+':font-size',chordSize.value);}catch(e){}});


// Lyrics are stored beside the song library, preserving every document entry so
// a song added to the Sheet later can match without importing its lyrics again.
async function commitLibrary(value){
  await saveLibrary(value);
  const preferred=$('artist').value;library=value.songs;source=value.source;lyricsLibrary=value.lyricsLibrary||null;
  renderLibrary(preferred);updated(value.importedAt);renderSource();
}
function previewLyrics(value){
  const report=LyricsLibrary.match(value.lyricsLibrary.entries,value.songs);
  if(report.ambiguous.length)throw Error('Ambiguous lyrics matches: '+report.ambiguous.join('; ')+'. Use one heading per song and unique artist/song names in the Sheet.');
  if(!report.bySong.size)throw Error('No lyrics matched your song library. Use Heading 1 lines in the form Artist — Song, matching the Sheet, with lyrics beneath. Your saved library is unchanged.');
  pendingLyrics=value;
  $('lyrics-summary').textContent=value.lyricsLibrary.source.name+': '+report.bySong.size+' of '+value.songs.length+' songs have matching lyrics. All will be available offline.';
  const warnings=[...report.unmatched.map(h=>'No matching song: '+h),...report.empty.map(h=>'No lyrics under heading: '+h)];
  const old=LyricsLibrary.match(lyricsLibrary?.entries||[],value.songs).bySong;
  for(const [i] of old)if(!report.bySong.has(i))warnings.push('Saved lyrics will be removed: '+value.songs[i].artist+' — '+value.songs[i].song);
  $('lyrics-warnings').replaceChildren(...warnings.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  $('lyrics-confirm').showModal();renderSource();
}
function syncLyrics(change){
  if(syncBusy||!db||!library.length||$('confirm').open||$('lyrics-confirm').open)return;
  if(!navigator.onLine){note('Connect to the internet to update lyrics. Your saved lyrics are available offline.');return;}
  if(!SheetsConnection.configured()){note('Google connection needs its one-time setup before importing lyrics.');return;}
  if(!SheetsConnection.ready()){
    note('Connecting to Google…');SheetsConnection.prepare().then(()=>note('Google is ready. Tap the lyrics button again.')).catch(e=>note(e.message));return;
  }
  syncBusy=true;renderSource();
  const authorization=SheetsConnection.authorize();
  (async()=>{
    try{
      await authorization;
      const target=change||!lyricsLibrary?await SheetsConnection.pick('lyrics'):lyricsLibrary.source;
      if(!target)return;
      note('Downloading all lyrics…');
      const result=await SheetsConnection.downloadLyrics(target);
      const saved=await readSaved();
      previewLyrics({songs:library,source,lyricsLibrary:result,importedAt:saved?.importedAt||new Date().toISOString()});
    }catch(e){note(e.message+' Your saved library has not changed.');}
    finally{syncBusy=false;renderSource();}
  })();
}
$('lyrics-connect').addEventListener('click',()=>syncLyrics(true));
$('lyrics-update').addEventListener('click',()=>syncLyrics(false));
$('lyrics-save').addEventListener('click',async event=>{
  event.preventDefault();if(!pendingLyrics||syncBusy)return;
  syncBusy=true;const value=pendingLyrics;for(const button of $('lyrics-confirm').querySelectorAll('button'))button.disabled=true;renderSource();
  try{await commitLibrary(value);pendingLyrics=null;$('lyrics-confirm').close();note('Library and lyrics saved for offline use.');}
  catch(e){note('The update could not be saved. Your previous library is unchanged.');}
  finally{syncBusy=false;for(const button of $('lyrics-confirm').querySelectorAll('button'))button.disabled=false;renderSource();}
});
$('lyrics-confirm').addEventListener('cancel',event=>{if(syncBusy)event.preventDefault();});
$('lyrics-confirm').addEventListener('close',()=>{if(pendingLyrics)note('Update cancelled. Your saved library is unchanged.');pendingLyrics=null;renderSource();});
$('confirm').addEventListener('close',()=>{pending=null;pendingSource=null;renderSource();});
