'use strict';
window.SetlistModel=(()=>{
  const normalize=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
  const identity=song=>JSON.stringify([normalize(song.artist),normalize(song.song),normalize(song.key)]);
  function reference(song){return {artist:song.artist,song:song.song,key:song.key||'',chords:song.chords||''};}
  function resolve(ref,songs){
    const candidates=songs.filter(s=>identity(s)===identity(ref));
    if(!candidates.length)return {error:'Not in the current library'};
    if(candidates.length===1)return {song:candidates[0]};
    const exact=candidates.filter(s=>(s.chords||'')===(ref.chords||''));
    if(exact.length)return {song:exact[0]};
    return {error:'Multiple versions share this artist, title and key. Remove and add the version again.'};
  }
  function move(items,from,to){const copy=[...items];if(from<0||from>=copy.length||to<0||to>=copy.length)return copy;copy.splice(to,0,copy.splice(from,1)[0]);return copy;}
  function step(index,delta,length){return Math.max(0,Math.min(Math.max(0,length-1),index+delta));}
  function swipe(dx,dy,elapsed){return elapsed<1400&&Math.abs(dx)>=70&&Math.abs(dx)>Math.abs(dy)*1.6?(dx<0?1:-1):0;}
  function keyboard(event){return !event.repeat&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.isComposing?(event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0):0;}
  function validate(state){
    if(!state||state.version!==1||!Array.isArray(state.lists))throw Error('The saved setlists could not be read.');
    const ids=new Set();for(const list of state.lists){
      if(!list||typeof list.id!=='string'||ids.has(list.id)||typeof list.name!=='string'||!list.name.trim()||!Array.isArray(list.items))throw Error('The saved setlists could not be read.');ids.add(list.id);
      const items=new Set();for(const item of list.items){if(!item||typeof item.id!=='string'||items.has(item.id)||!item.ref||typeof item.ref.artist!=='string'||typeof item.ref.song!=='string')throw Error('The saved setlists could not be read.');items.add(item.id);}
    }
    return state;
  }
  return {normalize,identity,reference,resolve,move,step,swipe,keyboard,validate};
})();
