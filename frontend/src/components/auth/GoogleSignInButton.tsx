import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window { google?: any; }
}

let scriptPromise: Promise<void> | null = null;
let initializedClientId = '';
let activeHandler: ((credential:string)=>void) | null = null;

const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;
    script.onload=()=>resolve();script.onerror=()=>reject(new Error('Google sign-in could not be loaded'));
    document.head.appendChild(script);
  });
  return scriptPromise;
};

const GoogleSignInButton: React.FC<{ onCredential:(credential:string)=>void|Promise<void>; onError?:(message:string)=>void; text?:'signin_with'|'continue_with'|'signup_with' }> = ({onCredential,onError,text='continue_with'}) => {
  const container=useRef<HTMLDivElement>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let mounted=true;
    activeHandler=credential=>void onCredential(credential);
    const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if(!clientId){setLoading(false);onError?.('Google sign-in is not configured');return;}
    loadGoogleIdentity().then(()=>{
      if(!mounted||!container.current)return;
      if(initializedClientId!==clientId){
        window.google.accounts.id.initialize({client_id:clientId,callback:(response:any)=>activeHandler?.(response.credential),cancel_on_tap_outside:true});
        initializedClientId=clientId;
      }
      container.current.innerHTML='';
      window.google.accounts.id.renderButton(container.current,{theme:'outline',size:'large',shape:'pill',text,width:Math.min(360,container.current.clientWidth||360)});
      setLoading(false);
    }).catch(error=>{if(mounted){setLoading(false);onError?.(error.message)}});
    return()=>{mounted=false};
  },[onCredential,onError,text]);
  return <div className="w-full min-h-11 flex justify-center items-center">{loading&&<div className="h-10 w-full max-w-[360px] rounded-full bg-gray-100 animate-pulse"/>}<div ref={container} className={loading?'hidden':'w-full flex justify-center'}/></div>;
};

export default GoogleSignInButton;
