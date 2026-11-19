'use strict';
window.ChordbookThemes=(()=>{
  const palettes=[{"name": "Midnight Mint", "note": "Current palette, with matching highlights", "bg": "#121921", "panel": "#1b2530", "text": "#f2f6fa", "muted": "#aab9c8", "accent": "#7de1c2", "line": "#344251", "h1": "#705018", "h2": "#254f77", "ht": "#ffffff", "id": "midnight-mint", "mode": "dark", "accent-text": "#121921", "section": "#efbf78", "selected": "#233c36", "control-line": "#526171"}, {"name": "Warm Paper", "note": "A softer light option", "bg": "#f6f0e5", "panel": "#fffaf1", "text": "#302921", "muted": "#6b5d50", "accent": "#8e3449", "line": "#d9cbbb", "h1": "#f4dda0", "h2": "#d9c9ed", "ht": "#302921", "id": "warm-paper", "mode": "light", "accent-text": "#f6f0e5", "section": "#805015", "selected": "#f0e1df", "control-line": "#897b6b"}, {"name": "High Contrast", "note": "Bold separation for quick reading", "bg": "#000000", "panel": "#111111", "text": "#ffffff", "muted": "#cccccc", "accent": "#ffe66d", "line": "#666666", "h1": "#ffe66d", "h2": "#75dafa", "ht": "#000000", "id": "high-contrast", "mode": "dark", "accent-text": "#000000", "section": "#ffe66d", "selected": "#252525", "control-line": "#888888"}, {"name": "Ocean", "note": "Cool blues with warm accents", "bg": "#092635", "panel": "#123847", "text": "#f0f7fa", "muted": "#afc8d3", "accent": "#84d5ff", "line": "#356071", "h1": "#75432d", "h2": "#325f58", "ht": "#ffffff", "id": "ocean", "mode": "dark", "accent-text": "#092635", "section": "#f2b78b", "selected": "#1d4659", "control-line": "#6b8d9b"}, {"name": "Soft Sage", "note": "A calm light option", "bg": "#eaf0e7", "panel": "#f6f8f2", "text": "#243129", "muted": "#526358", "accent": "#245d46", "line": "#bccbbb", "h1": "#e9d491", "h2": "#b9d6e8", "ht": "#243129", "id": "soft-sage", "mode": "light", "accent-text": "#eaf0e7", "section": "#745015", "selected": "#dce9dc", "control-line": "#6d8271"}];
  const key='chordbook:'+new URL('./',location.href).pathname+':theme';
  let current=palettes[0].id;
  function apply(id,save=false){
    const palette=palettes.find(p=>p.id===id)||palettes[0];current=palette.id;
    const root=document.documentElement;root.style.colorScheme=palette.mode;
    for(const name of ['bg','panel','text','muted','accent','line','accent-text','section','selected','control-line'])root.style.setProperty('--'+name,palette[name]);
    root.style.setProperty('--highlight-a',palette.h1);root.style.setProperty('--highlight-b',palette.h2);root.style.setProperty('--highlight-text',palette.ht);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',palette.bg);
    if(save)try{localStorage.setItem(key,current);}catch(e){}
    return current;
  }
  let saved;try{saved=localStorage.getItem(key);}catch(e){}apply(saved);
  function init(){
    const select=document.getElementById('colour-scheme');if(!select)return;
    select.replaceChildren(...palettes.map(p=>new Option(p.name,p.id)));select.value=current;
    select.addEventListener('change',()=>{select.value=apply(select.value,true);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  return {apply};
})();
