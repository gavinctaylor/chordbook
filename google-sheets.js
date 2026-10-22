'use strict';
window.SheetsConnection=(()=>{
  const scope='https://www.googleapis.com/auth/drive.file';
  let loading,client,token='',expires=0,rejectAuth,cancelPicker=null;
  const configured=()=>Boolean(window.GOOGLE_CONFIG?.clientId&&GOOGLE_CONFIG.apiKey&&GOOGLE_CONFIG.projectNumber);
  function script(src){return new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src=src;el.async=true;
    const timeout=setTimeout(()=>{el.remove();reject(Error('Google could not be reached. Check your connection and try again.'));},20000);
    el.onload=()=>{clearTimeout(timeout);resolve();};el.onerror=()=>{clearTimeout(timeout);el.remove();reject(Error('Google could not be reached. Check your connection and try again.'));};document.head.append(el);
  });}
  function prepare(){
    if(!configured())return Promise.reject(Error('The Google connection needs its one-time setup before it can be used.'));
    if(loading)return loading;
    loading=Promise.all([window.google?.accounts?Promise.resolve():script('https://accounts.google.com/gsi/client'),window.gapi?Promise.resolve():script('https://apis.google.com/js/api.js')]).then(()=>new Promise((resolve,reject)=>{
      gapi.load('picker',{callback:resolve,onerror:()=>reject(Error('Google Drive could not be opened.')),timeout:20000,ontimeout:()=>reject(Error('Google Drive took too long to load.'))});
    })).then(()=>{client=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CONFIG.clientId,scope,include_granted_scopes:false,callback:()=>{},error_callback:()=>{if(rejectAuth)rejectAuth(Error("Google sign-in was closed or blocked. Try again and allow the sign-in window."));}});}).catch(e=>{loading=null;throw e;});
    return loading;
  }
  // Call directly from a tap so Safari can open Google's sign-in window.
  function authorize(force=false){return new Promise((resolve,reject)=>{
    if(force){token="";expires=0;}
    if(!client){reject(Error('Google is still loading. Tap the button again in a moment.'));return;}
    if(token&&Date.now()<expires){resolve();return;}
    client.callback=response=>{
      if(response.error||!response.access_token||!google.accounts.oauth2.hasGrantedAllScopes(response,scope)){reject(Error('Google access was not granted. Your saved songs are unchanged.'));return;}
      token=response.access_token;expires=Date.now()+(Number(response.expires_in||3600)-60)*1000;resolve();
    };
    rejectAuth=reject;
    client.requestAccessToken({prompt:force?'select_account consent':'select_account'});
  });}
  function pick(){return new Promise((resolve,reject)=>{
    let picker;
    const finish=value=>{cancelPicker=null;if(picker)picker.dispose();window.dispatchEvent(new Event("pickerclosed"));resolve(value);};
    cancelPicker=()=>finish(null);
    try{picker=new google.picker.PickerBuilder()
      .addView(new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS).setMode(google.picker.DocsViewMode.LIST))
      .setOAuthToken(token).setDeveloperKey(GOOGLE_CONFIG.apiKey).setAppId(GOOGLE_CONFIG.projectNumber).setOrigin(location.origin)
      .setTitle('Choose your chord sheet').setCallback(data=>{
        if(data.action===google.picker.Action.PICKED){const doc=data.docs[0];finish({spreadsheetId:doc.id,name:doc.name});}
        else if(data.action===google.picker.Action.CANCEL){finish(null);}
      }).build();picker.setVisible(true);window.dispatchEvent(new Event("pickeropened"));
    }catch(e){cancelPicker=null;window.dispatchEvent(new Event('pickerclosed'));reject(Error('The Google Drive chooser could not open. Use Sign in again, then retry.'));}
  });}
  async function get(path){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal});
      if(response.status===401){token='';expires=0;throw Error('Google sign-in expired. Use Sign in again, then retry the update.');}
      if(response.status===403||response.status===404)throw Error('Google could not read this sheet. Use Sign in again with the account that owns it, or choose Change sheet.');
      if(!response.ok)throw Error('Google could not supply the sheet. Try again later.');
      return await response.json();
    }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('The download failed. Check your internet connection and try again.');throw e;}
    finally{clearTimeout(timeout);}
  }
  function metadata(id){return get(encodeURIComponent(id)+'?fields=properties(title),sheets(properties(sheetId,title))');}
  function fromRows(rows){
    if(!Array.isArray(rows)||!rows.length)throw Error('This worksheet is empty.');
    const width=rows[0].length;
    const csv=rows.map(row=>Array.from({length:Math.max(width,row.length)},(_,i)=>'"'+String(row[i]??'').replace(/"/g,'""')+'"').join(',')).join('\n');
    return parseLibrary(csv);
  }
  async function download(source){
    const meta=await metadata(source.spreadsheetId);
    const sheet=meta.sheets.find(s=>s.properties.sheetId===source.sheetId);
    if(!sheet)throw Error('The connected worksheet was removed. Use Change sheet to choose another.');
    const range="'"+sheet.properties.title.replace(/'/g,"''")+"'";
    const values=await get(encodeURIComponent(source.spreadsheetId)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE');
    return {songs:readWorksheet(values.values,sheet.properties.title),source:{...source,name:meta.properties.title,tab:sheet.properties.title}};
  }
  function readWorksheet(rows,title){try{return fromRows(rows);}catch(e){throw Error('Worksheet “'+title+'”: '+e.message);}}
  return {cancelPicker:()=>{if(cancelPicker)cancelPicker();},configured,prepare,ready:()=>Boolean(client),authorize,pick,metadata,download,fromRows};
})();
