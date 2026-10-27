'use strict';
// Google Doc text is always rendered as text, never interpreted as HTML.
window.LyricsLibrary=(()=>{
  function normalize(text){return String(text).normalize('NFKC').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim().toLocaleLowerCase('en');}
  function aliases(song){return [' - ',' | ',': '].map(join=>normalize(song.artist+join+song.song));}
  function parseDocument(doc){
    const entries=[];let current=null,headingCount=0;
    function finish(){if(current){current.text=current.lines.join('').replace(/\r/g,'').trim();delete current.lines;entries.push(current);current=null;}}
    function content(items){for(const item of items||[]){
      if(item.paragraph){
        const p=item.paragraph,text=(p.elements||[]).map(e=>e.textRun?.content||'').join('');
        if(p.paragraphStyle?.namedStyleType==='HEADING_1'){
          finish();const heading=text.trim();if(heading){headingCount++;current={heading,lines:[]};}
        }else if(current)current.lines.push(text);
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
    const bySong=new Map(),unmatched=[],empty=[],ambiguous=[],used=new Set();
    for(const entry of entries||[]){
      const ids=index.get(normalize(entry.heading));
      if(!ids?.size){unmatched.push(entry.heading);continue;}
      // Different keys of the same artist/song share one lyrics entry.
      const identities=new Set([...ids].map(id=>JSON.stringify([normalize(songs[id].artist),normalize(songs[id].song)])));
      if(identities.size!==1){ambiguous.push(entry.heading);continue;}
      if([...ids].some(id=>used.has(id))){for(const id of ids)bySong.delete(id);ambiguous.push(entry.heading);continue;}
      for(const id of ids)used.add(id);
      if(!entry.text.trim()){empty.push(entry.heading);continue;}
      for(const id of ids)bySong.set(id,entry.text);
    }
    return {bySong,unmatched,empty,ambiguous};
  }
  return {normalize,parseDocument,match};
})();
