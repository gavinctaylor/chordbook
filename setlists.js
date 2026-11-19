'use strict';
window.ChordbookSetlists=(()=>{
  const M=SetlistModel,byId=id=>document.getElementById(id);
  let state={version:1,lists:[],selectedId:''},store=null,ready=false,busy=false,editing=null,performance=null,drag=null,swipeStart=null;
  const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const selected=()=>state.lists.find(s=>s.id===state.selectedId)||state.lists[0];
  const announce=text=>{byId('setlist-status').textContent=text;};
  function button(text,action,label){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;if(label)b.setAttribute('aria-label',label);b.disabled=!ready||busy;b.addEventListener('click',action);return b;}
  function transaction(mode,value){return new Promise((resolve,reject)=>{
    const tx=store.transaction('library',mode),os=tx.objectStore('library');let result;
    if(mode==='readonly'){const request=os.get('setlists-v1');request.onsuccess=()=>{result=request.result;};}else os.put(value,'setlists-v1');
    tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(tx.error||Error('Storage unavailable'));
  });}
  async function mutate(change,success='Setlist saved on this device.'){
    if(!ready||busy||drag)return false;
    busy=true;render();
    try{const next=JSON.parse(JSON.stringify(state));change(next);M.validate(next);await transaction('readwrite',next);state=next;announce(success);return true;}
    catch(e){announce('Could not save this change. Your previous setlists are unchanged.');return false;}
    finally{busy=false;render();}
  }
  function currentIn(next){return next.lists.find(l=>l.id===selected()?.id);}
  function pickOptions(element,preferred){element.replaceChildren(...state.lists.map(l=>new Option(l.name,l.id)));element.value=state.lists.some(l=>l.id===preferred)?preferred:(selected()?.id||'');}
  function render(){
    const list=selected(),songs=displayedSongs();
    pickOptions(byId('setlist-select'),list?.id);pickOptions(byId('performance-setlist'),byId('performance-setlist').value);
    byId('setlist-select').disabled=!ready||busy||!list;byId('performance-setlist').disabled=!ready||busy||!list;
    byId('setlist-new').disabled=!ready||busy;
    for(const id of ['setlist-rename','setlist-delete','setlist-add'])byId(id).disabled=!ready||busy||!list||(id==='setlist-add'&&!songs.length);
    byId('setlist-empty').hidden=Boolean(list);byId('setlist-editor').hidden=!list;
    byId('setlist-title').textContent=list?.name||'';
    byId('setlist-count').textContent=list?list.items.length+' songs':'';
    byId('setlist-items').replaceChildren(...(list?.items||[]).map((item,index)=>{
      const row=document.createElement('li');row.dataset.itemId=item.id;
      const handle=button('⋮⋮',()=>{},'Drag '+item.ref.song+' to reorder');handle.className='drag-handle secondary';handle.dataset.dragId=item.id;
      const info=document.createElement('div');info.className='setlist-song-info';
      const title=document.createElement('strong');title.textContent=(index+1)+'. '+item.ref.song;
      const subtitle=document.createElement('span');subtitle.textContent=item.ref.artist+(item.ref.key?' · Key: '+item.ref.key:'');info.append(title,subtitle);
      const resolved=M.resolve(item.ref,songs);if(resolved.error){const warning=document.createElement('span');warning.className='setlist-warning';warning.textContent=resolved.error;info.append(warning);}
      const controls=document.createElement('div');controls.className='setlist-row-actions';
      const up=button('Up',()=>reorder(index,index-1),'Move '+item.ref.song+' up'),down=button('Down',()=>reorder(index,index+1),'Move '+item.ref.song+' down');up.disabled||=index===0;down.disabled||=index===list.items.length-1;
      controls.append(up,down,button('Remove',()=>mutate(next=>{const l=currentIn(next);l.items=l.items.filter(i=>i.id!==item.id);}), 'Remove '+item.ref.song+' from setlist'));
      row.append(handle,info,controls);return row;
    }));
    renderPerformanceSetup();
  }
  function reorder(from,to){mutate(next=>{const l=currentIn(next);l.items=M.move(l.items,from,to);});}
  function renderPerformanceSetup(){
    const list=state.lists.find(l=>l.id===byId('performance-setlist').value),songs=displayedSongs();
    const problems=list?.items.map(i=>({item:i,...M.resolve(i.ref,songs)})).filter(x=>x.error)||[];
    byId('performance-start').disabled=!ready||busy||!list?.items.length||problems.length>0;
    byId('performance-readiness').textContent=!list?'Create a setlist first.':!list.items.length?'Add songs to this setlist first.':problems.length?'Fix '+problems.length+' unavailable or ambiguous songs in Setlists before starting.':list.items.length+' songs ready. Swipe left for next, right for previous, or use a Left/Right pedal.';
  }
  function refresh(){if(ready&&!drag)render();}
  function openName(rename){
    if(!ready||busy)return;editing=rename?selected()?.id:null;byId('set-name-title').textContent=rename?'Rename setlist':'New setlist';byId('set-name-input').value=rename?selected().name:'';byId('set-name-error').textContent='';byId('set-name-dialog').showModal();byId('set-name-input').focus();
  }
  byId('setlist-new').addEventListener('click',()=>openName(false));
  byId('setlist-rename').addEventListener('click',()=>openName(true));
  byId('set-name-form').addEventListener('submit',async e=>{
    if(e.submitter?.value==='cancel')return;e.preventDefault();if(busy)return;
    const name=byId('set-name-input').value.trim();
    if(!name){byId('set-name-error').textContent='Enter a name.';return;}
    if(state.lists.some(l=>l.id!==editing&&M.normalize(l.name)===M.normalize(name))){byId('set-name-error').textContent='Another setlist already uses this name.';return;}
    const id=editing||uid();for(const b of byId('set-name-dialog').querySelectorAll('button'))b.disabled=true;
    const ok=await mutate(next=>{if(editing)next.lists.find(l=>l.id===editing).name=name;else next.lists.push({id,name,items:[]});next.selectedId=id;});
    for(const b of byId('set-name-dialog').querySelectorAll('button'))b.disabled=false;
    if(ok)byId('set-name-dialog').close();else byId('set-name-error').textContent='Could not save. Please try again.';
  });
  for(const id of ['set-name-dialog','set-delete-dialog'])byId(id).addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  byId('setlist-select').addEventListener('change',()=>{const id=byId('setlist-select').value;mutate(next=>{next.selectedId=id;},'Setlist selected.');});
  byId('setlist-delete').addEventListener('click',()=>{byId('set-delete-name').textContent=selected().name;byId('set-delete-dialog').showModal();});
  byId('set-delete-confirm').addEventListener('click',async e=>{
    e.preventDefault();if(busy)return;const id=selected()?.id;for(const b of byId('set-delete-dialog').querySelectorAll('button'))b.disabled=true;
    const ok=await mutate(next=>{next.lists=next.lists.filter(l=>l.id!==id);next.selectedId=next.lists[0]?.id||'';},'Setlist deleted. Your song library is unchanged.');
    for(const b of byId('set-delete-dialog').querySelectorAll('button'))b.disabled=false;if(ok)byId('set-delete-dialog').close();
  });
  function renderAdd(){
    const query=M.normalize(byId('set-song-search').value),list=selected();
    const songs=displayedSongs().filter(s=>M.normalize(s.artist+' '+s.song+' '+s.key).includes(query)).sort((a,b)=>order.compare(a.artist,b.artist)||order.compare(a.song,b.song)||order.compare(a.key||'',b.key||''));
    byId('set-song-results').replaceChildren(...songs.map(song=>{
      const row=document.createElement('div');row.className='add-song-row';const label=document.createElement('span');label.textContent=song.artist+' — '+song.song+(song.key?' · Key: '+song.key:'');
      const add=button('Add',async()=>{
        const ok=await mutate(next=>{next.lists.find(l=>l.id===list.id).items.push({id:uid(),ref:M.reference(song)});});
        if(ok)byId('set-add-status').textContent='Added '+song.song+(song.key?' in '+song.key:'')+'.';renderAdd();
      },'Add '+song.artist+' — '+song.song+(song.key?' in '+song.key:''));row.append(label,add);return row;
    }));
    byId('set-search-empty').hidden=Boolean(songs.length);
  }
  byId('setlist-add').addEventListener('click',()=>{byId('set-song-search').value='';byId('set-add-status').textContent='';renderAdd();byId('set-add-dialog').showModal();});
  byId('set-song-search').addEventListener('input',renderAdd);
  byId('set-add-close').addEventListener('click',()=>byId('set-add-dialog').close());
  // Pointer-based dragging supports touch screens; Up/Down are keyboard alternatives.
  const listElement=byId('setlist-items');
  listElement.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-drag-id]');if(!handle||busy||!ready||!e.isPrimary||e.button!==0)return;
    drag={pointer:e.pointerId,id:handle.dataset.dragId,y:e.clientY,moved:false};listElement.setPointerCapture(e.pointerId);e.preventDefault();
    handle.closest('li').classList.add('dragging');
  });
  listElement.addEventListener('pointermove',e=>{
    if(!drag||drag.pointer!==e.pointerId)return;drag.y=e.clientY;
    const moving=[...listElement.children].find(r=>r.dataset.itemId===drag.id);
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('#setlist-items > li');
    if(target&&target!==moving){const box=target.getBoundingClientRect();listElement.insertBefore(moving,e.clientY<box.top+box.height/2?target:target.nextSibling);drag.moved=true;}
    const box=listElement.getBoundingClientRect();if(e.clientY<box.top+50)listElement.scrollTop-=18;else if(e.clientY>box.bottom-50)listElement.scrollTop+=18;
  });
  function endDrag(e,cancel){
    if(!drag||drag.pointer!==e.pointerId)return;
    const moved=drag.moved,ids=[...listElement.children].map(r=>r.dataset.itemId);drag=null;
    if(listElement.hasPointerCapture(e.pointerId))listElement.releasePointerCapture(e.pointerId);
    if(!cancel&&moved)mutate(next=>{const l=currentIn(next),map=new Map(l.items.map(i=>[i.id,i]));l.items=ids.map(id=>map.get(id));});else render();
  }
  listElement.addEventListener('pointerup',e=>endDrag(e,false));listElement.addEventListener('pointercancel',e=>endDrag(e,true));listElement.addEventListener('lostpointercapture',e=>endDrag(e,true));
  function startPerformance(){
    if(!ready||busy)return;
    const list=state.lists.find(l=>l.id===byId('performance-setlist').value);if(!list?.items.length)return;
    const songs=displayedSongs(),matches=LyricsLibrary.match(lyricsLibrary?.entries||[],songs).entriesBySong;
    const queue=list.items.map(item=>{const result=M.resolve(item.ref,songs);return {...result,lyrics:result.song?matches.get(songs.indexOf(result.song)):null};});
    if(queue.some(q=>q.error)){renderPerformanceSetup();return;}
    performance={name:list.name,queue,index:0,mode:byId('performance-view').value,colours:LyricsLibrary.highlightColours(lyricsLibrary?.entries||[])};
    byId('performance-stage').hidden=false;document.body.classList.add('is-performing');byId('performance-stage').focus();renderPerformance();
    try{const request=byId('performance-stage').requestFullscreen?.();request?.catch(()=>{});}catch(e){}
  }
  function renderPerformance(){
    if(!performance)return;const {song,lyrics}=performance.queue[performance.index];
    byId('performance-title').textContent=song.song;byId('performance-artist').textContent=song.artist+(song.key?' · Key: '+song.key:'');
    byId('performance-position').textContent=performance.name+' · '+(performance.index+1)+' / '+performance.queue.length;
    const hasLyrics=Boolean(lyrics?.text),hasChords=Boolean(song.chords?.trim());let mode=performance.mode;
    if(mode==='lyrics'&&!hasLyrics&&hasChords)mode='chords';else if(mode==='chords'&&!hasChords&&hasLyrics)mode='lyrics';
    byId('performance-notice').textContent=mode!==performance.mode?'No '+performance.mode+' for this song; showing '+mode+'.':'';
    byId('performance-chords').disabled=!hasChords;byId('performance-lyrics').disabled=!hasLyrics;
    byId('performance-chords').setAttribute('aria-pressed',String(mode==='chords'));byId('performance-lyrics').setAttribute('aria-pressed',String(mode==='lyrics'));
    const content=byId('performance-content');content.className=mode==='lyrics'?'lyrics-text':'';
    if(mode==='lyrics'&&hasLyrics)LyricsLibrary.render(content,lyrics,performance.colours);else if(hasChords)formatChords(content,song.chords);else content.textContent='No content is available for this song.';
    byId('performance-reader').scrollTop=0;
    byId('performance-prev').disabled=performance.index===0;byId('performance-next').disabled=performance.index===performance.queue.length-1;
    byId('performance-next-label').textContent=performance.queue[performance.index+1]?'Next: '+performance.queue[performance.index+1].song.song:'Last song in this setlist';
    syncSizeButtons();
  }
  function navigate(delta){if(!performance)return;const next=M.step(performance.index,delta,performance.queue.length);if(next===performance.index){byId('performance-notice').textContent=delta>0?'End of setlist.':'First song in setlist.';return;}performance.index=next;renderPerformance();}
  function stop(){if(!performance)return;performance=null;swipeStart=null;document.body.classList.remove('is-performing');byId('performance-stage').hidden=true;if(document.fullscreenElement===byId('performance-stage'))document.exitFullscreen?.().catch(()=>{});byId('performance-start').focus();}
  byId('performance-start').addEventListener('click',startPerformance);byId('performance-exit').addEventListener('click',stop);
  byId('performance-setlist').addEventListener('change',renderPerformanceSetup);
  byId('performance-prev').addEventListener('click',()=>navigate(-1));byId('performance-next').addEventListener('click',()=>navigate(1));
  for(const mode of ['chords','lyrics'])byId('performance-'+mode).addEventListener('click',()=>{if(performance){performance.mode=mode;renderPerformance();}});
  function syncSizeButtons(){byId('performance-smaller').disabled=textSize<=16;byId('performance-larger').disabled=textSize>=48;}
  byId('performance-smaller').addEventListener('click',()=>{changeTextSize(-1);syncSizeButtons();});byId('performance-larger').addEventListener('click',()=>{changeTextSize(1);syncSizeButtons();});
  document.addEventListener('keydown',e=>{
    if(!performance||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
    if(e.key==='Escape'){e.preventDefault();stop();return;}
    const delta=M.keyboard(e);if(e.key==='ArrowLeft'||e.key==='ArrowRight')e.preventDefault();if(delta)navigate(delta);
  });
  const reader=byId('performance-reader');
  reader.addEventListener('pointerdown',e=>{if(performance&&e.isPrimary&&e.button===0)swipeStart={id:e.pointerId,x:e.clientX,y:e.clientY,time:Date.now()};else swipeStart=null;});
  reader.addEventListener('pointercancel',()=>{swipeStart=null;});
  reader.addEventListener('pointerup',e=>{const start=swipeStart;swipeStart=null;if(!start||start.id!==e.pointerId)return;const delta=M.swipe(e.clientX-start.x,e.clientY-start.y,Date.now()-start.time);if(delta)navigate(delta);});
  window.addEventListener('hashchange',()=>{if(performance)stop();if(drag){drag=null;}refresh();});
  (async()=>{try{store=await openDatabase();const saved=await transaction('readonly');if(saved!==undefined)state=M.validate(saved);ready=true;render();announce('Setlists saved on this device.');}catch(e){announce('Setlist storage could not be opened. Your saved data has not been changed.');render();}})();
  return {refresh};
})();
