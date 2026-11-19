'use strict';
// Google Doc text is always rendered as text, never interpreted as HTML.
window.LyricsLibrary=(()=>{
  function normalize(text){return String(text).normalize('NFKC').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim().toLocaleLowerCase('en');}
  function aliases(song){return [' - ',' | ',': '].map(join=>normalize(song.artist+join+song.song));}
  function parseDocument(doc){
    const entries=[];let current=null,headingCount=0;
    function finish(){if(current){
      const raw=current.runs.map(r=>r.text).join(''),start=raw.length-raw.trimStart().length,end=raw.trimEnd().length;
      let offset=0;current.runs=current.runs.flatMap(run=>{const from=Math.max(0,start-offset),to=Math.min(run.text.length,end-offset);offset+=run.text.length;return to>from?[{text:run.text.slice(from,to),highlight:run.highlight}]:[];});
      current.text=raw.trim();entries.push(current);current=null;
    }}
    function content(items){for(const item of items||[]){
      if(item.paragraph){
        const p=item.paragraph,text=(p.elements||[]).map(e=>e.textRun?.content||'').join('');
        if(p.paragraphStyle?.namedStyleType==='HEADING_1'){
          finish();const heading=text.trim();if(heading){headingCount++;current={heading,runs:[]};}
        }else if(current)for(const element of p.elements||[]){
          const run=element.textRun;if(!run)continue;
          const rgb=run.textStyle?.backgroundColor?.color?.rgbColor;
          const highlight=rgb?'#'+['red','green','blue'].map(k=>Math.round(Math.max(0,Math.min(1,Number(rgb[k])||0))*255).toString(16).padStart(2,'0')).join(''):null;
          const value=String(run.content||'').replace(/\r/g,'');
          const last=current.runs[current.runs.length-1];
          if(last&&last.highlight===highlight)last.text+=value;else current.runs.push({text:value,highlight});
        }
      }else if(item.table){for(const row of item.table.tableRows||[])for(const cell of row.tableCells||[])content(cell.content);}
      // Tables of contents and repeating page headers are deliberately excluded.
    }}
    function tab(t){finish();content(t.documentTab?.body?.content);finish();for(const child of t.childTabs||[])tab(child);}
    if(doc.tabs?.length)doc.tabs.forEach(tab);else{content(doc.body?.content);finish();}
    if(!headingCount)throw Error('No Heading 1 song headings were found. In Word or Google Docs, use Heading 1 for each Artist — Song title in the document body, not the page header.');
    const seen=new Set();for(const entry of entries){const key=normalize(entry.heading);if(seen.has(key))throw Error('Duplicate lyrics heading: “'+entry.heading+'”. Give each song one Heading 1.');seen.add(key);}
    return entries;
  }
  function match(entries,songs){
    const index=new Map();songs.forEach((song,i)=>{for(const a of aliases(song)){const ids=index.get(a)||new Set();ids.add(i);index.set(a,ids);}});
    const bySong=new Map(),entriesBySong=new Map(),unmatched=[],empty=[],ambiguous=[],used=new Set();
    for(const entry of entries||[]){
      const ids=index.get(normalize(entry.heading));
      if(!ids?.size){unmatched.push(entry.heading);continue;}
      // Different keys of the same artist/song share one lyrics entry.
      const identities=new Set([...ids].map(id=>JSON.stringify([normalize(songs[id].artist),normalize(songs[id].song)])));
      if(identities.size!==1){ambiguous.push(entry.heading);continue;}
      if([...ids].some(id=>used.has(id))){for(const id of ids){bySong.delete(id);entriesBySong.delete(id);}ambiguous.push(entry.heading);continue;}
      for(const id of ids)used.add(id);
      if(!entry.text.trim()){empty.push(entry.heading);continue;}
      for(const id of ids){bySong.set(id,entry.text);entriesBySong.set(id,entry);}
    }
    return {bySong,entriesBySong,unmatched,empty,ambiguous};
  }
  function catalog(songs,entries){
    const result=[...songs],known=new Set(songs.flatMap(aliases));
    for(const entry of entries||[]){
      if(!entry.text.trim()||known.has(normalize(entry.heading)))continue;
      // Prefer explicit separators, keeping hyphens within artist/song names.
      const heading=entry.heading.trim();
      const separator=/[ \t]+[—–][ \t]+/.exec(heading)||/[ \t]+\|[ \t]+/.exec(heading)||/[ \t]+-[ \t]+/.exec(heading)||/:[ \t]+/.exec(heading);
      if(!separator)continue;
      const artist=heading.slice(0,separator.index).trim(),song=heading.slice(separator.index+separator[0].length).trim();
      if(!artist||!song)continue;
      const item={artist,song,chords:'',key:''};result.push(item);for(const alias of aliases(item))known.add(alias);
    }
    return result;
  }
  function highlightColours(entries){
    const colours=new Map();for(const entry of entries||[])for(const run of entry.runs||[])if(/^#[0-9a-f]{6}$/i.test(run.highlight||'')&&!colours.has(run.highlight))colours.set(run.highlight,colours.size);
    return colours;
  }
  function render(element,entry,colours){
    element.replaceChildren();
    if(!Array.isArray(entry?.runs)||entry.runs.map(r=>r.text).join('')!==entry.text){element.textContent=entry?.text||'';return;}
    for(const run of entry.runs){
      if(!/^#[0-9a-f]{6}$/i.test(run.highlight||'')){element.append(document.createTextNode(run.text));continue;}
      const mark=document.createElement('mark');mark.textContent=run.text;mark.className='lyric-highlight';
      const slot=colours.get(run.highlight);
      if(slot===0||slot===1)mark.classList.add(slot===0?'highlight-a':'highlight-b');
      else{
        // Keep additional source colours distinct, with readable text.
        mark.style.backgroundColor=run.highlight;
        const rgb=[1,3,5].map(i=>parseInt(run.highlight.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
        const luminance=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];mark.style.color=luminance>0.179?'#000000':'#ffffff';
      }
      element.append(mark);
    }
  }
  return {normalize,parseDocument,match,catalog,highlightColours,render};
})();
