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
  const credentialHandler=useRef(onCredential);
  const errorHandler=useRef(onError);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{credentialHandler.current=onCredential},[onCredential]);
  useEffect(()=>{errorHandler.current=onError},[onError]);
  useEffect(()=>{
    let mounted=true;
    let resizeObserver:ResizeObserver|null=null;
    let renderFrame=0;
    let renderedWidth=0;
    activeHandler=credential=>void credentialHandler.current(credential);
    const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if(!clientId){setLoading(false);errorHandler.current?.('Google sign-in is not configured');return;}
    loadGoogleIdentity().then(()=>{
      if(!mounted||!container.current)return;
      if(initializedClientId!==clientId){
        window.google.accounts.id.initialize({client_id:clientId,callback:(response:any)=>activeHandler?.(response.credential),cancel_on_tap_outside:true});
        initializedClientId=clientId;
      }
      const render=()=>{
        if(!mounted||!container.current)return;
        const availableWidth=Math.floor(container.current.getBoundingClientRect().width);
        if(availableWidth<1)return;
        const buttonWidth=Math.max(200,Math.min(360,availableWidth));
        if(buttonWidth===renderedWidth&&container.current.childElementCount)return;
        renderedWidth=buttonWidth;
        container.current.innerHTML='';
        window.google.accounts.id.renderButton(container.current,{theme:'outline',size:'large',shape:'pill',text,width:buttonWidth});
        setLoading(false);
      };
      const scheduleRender=()=>{window.cancelAnimationFrame(renderFrame);renderFrame=window.requestAnimationFrame(render)};
      resizeObserver=new ResizeObserver(scheduleRender);
      resizeObserver.observe(container.current);
      scheduleRender();
    }).catch(error=>{if(mounted){setLoading(false);errorHandler.current?.(error.message)}});
    return()=>{mounted=false;resizeObserver?.disconnect();window.cancelAnimationFrame(renderFrame)};
  },[text]);
  return <div className="relative flex min-h-11 w-full min-w-0 max-w-full items-center justify-center overflow-hidden">{loading&&<div className="absolute h-10 w-full max-w-[360px] animate-pulse rounded-full bg-gray-100"/>}<div ref={container} className={`flex min-w-0 max-w-full justify-center overflow-hidden ${loading?'invisible':''}`} style={{width:'100%'}}/></div>;
};

export default GoogleSignInButton;
