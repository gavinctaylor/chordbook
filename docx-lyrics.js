'use strict';
window.DocxLyrics=(()=>{
  const limit=8*1024*1024;
  function readPart(file){return new Promise((resolve,reject)=>{
    let size=0,stopped=false;const parts=[],stream=file.internalStream('uint8array');
    stream.on('data',bytes=>{if(stopped)return;size+=bytes.length;if(size>limit){stopped=true;stream.pause();reject(Error('The document text is too large. Please use a smaller lyrics document.'));return;}parts.push(bytes);});
    stream.on('error',reject).on('end',()=>{if(stopped)return;const data=new Uint8Array(size);let offset=0;for(const p of parts){data.set(p,offset);offset+=p.length;}resolve(new TextDecoder().decode(data));}).resume();
  });}
  function xml(text){
    if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('This Word document contains unsupported XML. Save a fresh .docx copy.');
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw Error('The Word document could not be read. Save a fresh .docx copy.');
    return doc;
  }
  const elements=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
  const child=(node,name)=>Array.from(node?.childNodes||[]).find(n=>n.nodeType===1&&n.localName===name);
  function attr(node,name){return Array.from(node?.attributes||[]).find(a=>a.localName===name)?.value||'';}
  function paragraphs(documentText,stylesText=''){
    const styles=new Map();
    if(stylesText)for(const style of elements(xml(stylesText),'style'))styles.set(attr(style,'styleId'),style);
    function headingStyle(id,seen=new Set()){
      if(!id||seen.has(id))return false;seen.add(id);
      const style=styles.get(id),name=attr(child(style,'name'),'val');
      if(/^heading\s*1$/i.test(id)||/^heading\s*1$/i.test(name))return true;
      const level=attr(child(child(style,'pPr'),'outlineLvl'),'val');
      if(level)return level==='0';
      return headingStyle(attr(child(style,'basedOn'),'val'),seen);
    }
    function text(node){
      if(node.nodeType!==1)return '';
      if(['del','moveFrom','txbxContent','instrText'].includes(node.localName))return '';
      if(node.localName==='t')return node.textContent;
      if(node.localName==='br'||node.localName==='cr')return '\n';
      if(node.localName==='tab')return '\t';
      return Array.from(node.childNodes||[]).map(text).join('');
    }
    const doc=xml(documentText),body=elements(doc,'body')[0];
    if(!body)throw Error('This file is not a supported Word document.');
    return elements(body,'p').filter(p=>{for(let n=p.parentNode;n&&n!==body;n=n.parentNode)if(['del','moveFrom','txbxContent'].includes(n.localName))return false;return true;}).map(p=>{
      const props=child(p,'pPr'),level=attr(child(props,'outlineLvl'),'val');
      const heading=level?level==='0':headingStyle(attr(child(props,'pStyle'),'val'));
      return {paragraph:{paragraphStyle:{namedStyleType:heading?'HEADING_1':'NORMAL_TEXT'},elements:[{textRun:{content:text(p)+'\n'}}]}};
    });
  }
  async function read(file){
    if(!/\.docx$/i.test(file.name))throw Error('Choose a .docx file. For older .doc or PDF files, first save or export a Word .docx copy with Heading 1 song titles.');
    if(file.size>10*1024*1024)throw Error('Please use a .docx file smaller than 10 MB.');
    let zip;try{zip=await JSZip.loadAsync(await file.arrayBuffer());}catch(e){throw Error('This file could not be opened as .docx. Check that it is not password protected and save a fresh Word copy.');}
    const document=zip.file('word/document.xml'),styles=zip.file('word/styles.xml');
    if(!document)throw Error('This file does not contain a Word document.');
    const content=paragraphs(await readPart(document),styles?await readPart(styles):'');
    const entries=LyricsLibrary.parseDocument({body:{content}});
    return {entries,source:{kind:'file',name:file.name},importedAt:new Date().toISOString()};
  }
  return {read,paragraphs};
})();
