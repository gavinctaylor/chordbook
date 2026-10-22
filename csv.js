(function(root){
  'use strict';
  function parseLibrary(text){
    text=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const rows=[];let row=[],field='',quoted=false,closed=false;
    const endField=()=>{row.push(field);field='';closed=false;};
    const endRow=()=>{endField();rows.push(row);row=[];};
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
      else if(c===',')endField();
      else if(c==='\n')endRow();
      else if(c==='"'&&!field&&!closed)quoted=true;
      else if(c==='"'||closed)throw Error('The CSV has an invalid quotation mark. Export it again from Google Sheets.');
      else field+=c;
    }
    if(quoted)throw Error('A quoted cell is unfinished. Export the CSV again from Google Sheets.');
    if(field||row.length||closed)endRow();
    const nonempty=rows.filter(r=>r.some(v=>v.trim()));
    if(!nonempty.length)throw Error('This file is empty.');
    const rawHeadings=nonempty.shift();
    const aliases={'artist name':'artist','song title':'song','title':'song','chord':'chords','song key':'key','key information':'key'};
    const headings=rawHeadings.map(s=>{const h=s.replace(/\uFEFF/g,'').trim().toLowerCase().replace(/\s+/g,' ');return aliases[h]||h;});
    const columns=['artist','song','chords'].map(h=>headings.indexOf(h));
    if(columns.some(i=>i<0)||columns.some(i=>headings.lastIndexOf(headings[i])!==i))throw Error('Expected headings Artist, Song and Chords (plus optional Key). Found: '+rawHeadings.map(h=>h.trim()||'(blank)').join(', ')+'. Select the worksheet containing your song table, with its headings in the first non-empty row.');
    const keyColumn=headings.indexOf("key");
    if(keyColumn>=0&&headings.lastIndexOf("key")!==keyColumn)throw Error("Use only one Key column.");
    const songs=nonempty.map((r,i)=>{
      if(r.length!==headings.length)throw Error(`Song row ${i+2} has an unexpected number of columns. Export the sheet again as CSV.`);
      const [artist,song,chords]=columns.map((n)=>r[n]);
      if(!artist.trim()||!song.trim()||!chords.trim())throw Error(`Song row ${i+2} needs an artist, song title and chords.`);
      return {artist:artist.trim(),song:song.trim(),chords,key:keyColumn<0?"":r[keyColumn].trim()};
    });
    if(!songs.length)throw Error('Add at least one song before importing.');
    return songs;
  }
  root.parseLibrary=parseLibrary;
  if(typeof module!=='undefined')module.exports={parseLibrary};
})(typeof window!=='undefined'?window:globalThis);
