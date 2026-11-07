import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Armchair, CalendarDays, Check, CheckCircle2, Copy, Download, FileSearch, Loader2, LockKeyhole, MapPin, Package, ShieldCheck, Upload, Users, Utensils, Wine } from 'lucide-react';
import toast from 'react-hot-toast';
import LinkupHeader from '../components/linkup/LinkupHeader';
import LinkupPageLoader from '../components/linkup/LinkupPageLoader';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { useAuth } from '../contexts/AuthContext';
import { linkupPlatformApi } from '../services/api';

type AnyRecord = Record<string, any>;
const money = (amount:number, currency='USD') => new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Number(amount||0));

const LinkupCheckout: React.FC = () => {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { user, googleLogin } = useAuth();
  const [pkg,setPackage] = useState<AnyRecord|null>(null);
  const [eventDetail,setEventDetail] = useState<AnyRecord|null>(null);
  const [food,setFood] = useState<Record<string,number>>({});
  const [alcohol,setAlcohol] = useState<Record<string,number>>({});
  const [customer,setCustomer] = useState({customerName:'',email:'',phone:'',guestCount:1,notes:'',ageConfirmed:false});
  const [payment,setPayment] = useState<AnyRecord|null>(null);
  const [booking,setBooking] = useState<AnyRecord|null>(null);
  const [receipt,setReceipt] = useState({bankAccountId:'',transferReference:'',paymentDate:new Date().toISOString().slice(0,10),notes:'',file:null as File|null});
  const [loading,setLoading] = useState(true);
  const [submitting,setSubmitting] = useState(false);
  const [downloadingConfirmation,setDownloadingConfirmation] = useState(false);
  const [showGoogleSignIn,setShowGoogleSignIn] = useState(false);
  const [receiptScan,setReceiptScan] = useState<{status:'idle'|'scanning'|'success'|'warning'|'error';progress:number;message:string;confidence?:number}>({status:'idle',progress:0,message:''});

  useEffect(()=>{(async()=>{
    if(!packageId)return;
    setLoading(true);
    try{
      const packageData=(await linkupPlatformApi.publicPackage(packageId)).data.data;
      setPackage(packageData);
      const eventId=packageData.event?._id||packageData.event;
      setEventDetail((await linkupPlatformApi.publicEvent(String(eventId))).data.data);
    }catch(error:any){toast.error(error.response?.data?.message||'This package is no longer available')}
    setLoading(false);
  })()},[packageId]);

  useEffect(()=>{if(user)setCustomer(current=>({...current,customerName:user.name||'',email:user.email||''}))},[user]);

  const optionalIds=useMemo(()=>new Set((pkg?.optionalItems||[]).map((item:AnyRecord)=>String(item.itemId))),[pkg]);
  const availableFood=(eventDetail?.food||[]).filter((item:AnyRecord)=>!optionalIds.size||optionalIds.has(String(item._id)));
  const availableAlcohol=(eventDetail?.alcohol||[]).filter((item:AnyRecord)=>!optionalIds.size||optionalIds.has(String(item._id)));
  const subtotal=useMemo(()=>{
    if(!pkg)return 0;
    let value=Number(pkg.packageType==='predefined'?pkg.packagePrice:(pkg.basePrice||pkg.seating?.price));
    if(pkg.packageType==='customizable'){
      for(const item of availableFood)value+=Number(item.price)*Number(food[item._id]||0);
      for(const item of availableAlcohol)value+=Number(item.price)*Number(alcohol[item._id]||0);
    }
    return value;
  },[pkg,food,alcohol,availableFood,availableAlcohol]);
  const tax=subtotal*Number(pkg?.taxRate||0)/100;
  const fee=subtotal*Number(pkg?.serviceFeeRate||0)/100;
  const total=subtotal+tax+fee;
  const event=eventDetail?.event||pkg?.event;

  const reserve = async () => {
    if(!pkg)return;
    if(!user){setShowGoogleSignIn(true);return}
    if(user.role!=='customer')return toast.error('Use a customer Google account to purchase packages');
    if(!customer.phone.trim())return toast.error('Enter your contact number');
    if(Number(customer.guestCount)<1||Number(customer.guestCount)>Number(pkg.seatingCapacity||pkg.seating?.capacity||1))return toast.error('Enter a valid guest count');
    if(availableAlcohol.some((item:AnyRecord)=>Number(alcohol[item._id])>0)&&!customer.ageConfirmed)return toast.error('Confirm that you meet the legal age requirement');
    setSubmitting(true);
    try{
      const result=(await linkupPlatformApi.bookPackage(pkg._id,{...customer,paymentMethod:'bank_transfer',foodItems:Object.entries(food).filter(([,quantity])=>quantity>0).map(([itemId,quantity])=>({itemId,quantity})),alcoholItems:Object.entries(alcohol).filter(([,quantity])=>quantity>0).map(([itemId,quantity])=>({itemId,quantity}))})).data.data;
      setPayment(result);
      setReceipt(current=>({...current,bankAccountId:result.bankAccounts?.[0]?._id||''}));
      window.scrollTo({top:0,behavior:'smooth'});
      toast.success('Payment details are ready. Your booking has not been recorded yet.');
    }catch(error:any){toast.error(error.response?.data?.message||'Payment details could not be prepared')}
    setSubmitting(false);
  };

  const uploadReceipt = async () => {
    if(!pkg||!payment||!receipt.file||!receipt.bankAccountId||!receipt.transferReference.trim())return toast.error('Choose an account, enter the transaction reference, and attach your receipt');
    const data=new FormData();
    data.append('payload',JSON.stringify({...customer,paymentMethod:'bank_transfer',foodItems:Object.entries(food).filter(([,quantity])=>quantity>0).map(([itemId,quantity])=>({itemId,quantity})),alcoholItems:Object.entries(alcohol).filter(([,quantity])=>quantity>0).map(([itemId,quantity])=>({itemId,quantity}))}));data.append('bankAccountId',receipt.bankAccountId);data.append('transferReference',receipt.transferReference.trim());data.append('paymentDate',receipt.paymentDate);data.append('paymentNotes',receipt.notes);data.append('receipt',receipt.file);
    setSubmitting(true);
    try{const response=await linkupPlatformApi.completePackageBooking(pkg._id,data);toast.success(response.data.message);setBooking({...response.data.data,submitted:true});window.scrollTo({top:0,behavior:'smooth'})}
    catch(error:any){toast.error(error.response?.data?.message||'Booking and receipt submission failed')}
    setSubmitting(false);
  };

  const chooseReceipt = async (file:File|null) => {
    if(!file)return;
    if(!['image/jpeg','image/png','application/pdf'].includes(file.type)){setReceiptScan({status:'error',progress:0,message:'Choose a JPG, PNG, or PDF receipt.'});return}
    if(file.size>8*1024*1024){setReceiptScan({status:'error',progress:0,message:'Receipt must be smaller than 8 MB.'});return}
    setReceipt(current=>({...current,file}));
    setReceiptScan({status:'scanning',progress:2,message:'Preparing secure receipt scan…'});
    try{
      const {scanPaymentReceipt}=await import('../utils/receiptOcr');
      const result=await scanPaymentReceipt(file,progress=>setReceiptScan({status:'scanning',progress,message:`Scanning receipt… ${progress}%`}));
      setReceipt(current=>({...current,file,transferReference:result.reference||current.transferReference,paymentDate:result.paymentDate||current.paymentDate}));
      const amountMatches=result.amount==null||Math.abs(result.amount-amount)<0.01;
      const details=[result.reference&&`reference ${result.reference}`,result.paymentDate&&`date ${result.paymentDate}`,result.amount!=null&&`amount ${money(result.amount,currency)}`].filter(Boolean).join(', ');
      if(result.reference&&amountMatches)setReceiptScan({status:'success',progress:100,confidence:result.confidence,message:`Detected ${details}. Please compare these details with the receipt before submitting.`});
      else if(result.amount!=null&&!amountMatches)setReceiptScan({status:'warning',progress:100,confidence:result.confidence,message:`The scanned amount ${money(result.amount,currency)} does not match the required total ${money(amount,currency)}. Check the receipt and fields carefully.`});
      else setReceiptScan({status:'warning',progress:100,confidence:result.confidence,message:'The receipt was scanned, but a reliable reference was not found. Enter it manually before submitting.'});
    }catch(error:any){setReceiptScan({status:'error',progress:0,message:error?.message||'Automatic scanning failed. Enter the payment details manually.'})}
  };

  const downloadConfirmation = async () => {
    if(!booking?.submitted||!booking.booking)return;
    setDownloadingConfirmation(true);
    try{
      const account=(payment?.bankAccounts||[]).find((item:AnyRecord)=>String(item._id)===String(receipt.bankAccountId));
      const {downloadBookingConfirmationPdf}=await import('../utils/bookingConfirmationPdf');
      await downloadBookingConfirmationPdf({
        bookingReference:booking.booking.bookingReference,
        transferReference:booking.transfer?.transferReference||receipt.transferReference,
        submittedAt:booking.transfer?.createdAt||booking.booking.createdAt||new Date().toISOString(),
        paymentDate:booking.transfer?.paymentDate||receipt.paymentDate,
        status:'Pending payment verification',
        customerName:booking.booking.customerName||user?.name||customer.customerName,
        email:booking.booking.email||user?.email||customer.email,
        phone:booking.booking.phone||customer.phone,
        guestCount:Number(booking.booking.guestCount||customer.guestCount||1),
        eventTitle:event?.title||'The Lnk Up event',
        eventDate:event?.eventDate,
        venue:[event?.venueName,event?.location].filter(Boolean).join(', '),
        packageName:pkg?.name||'Linkup package',
        seating:pkg?.seating?.name||`${maxGuests} guest package`,
        bankName:account?.bankName||'',
        accountHolder:account?.accountHolderName||'',
        currency:booking.booking.currency||currency,
        subtotal:Number(booking.booking.subtotal??subtotal),
        taxAmount:Number(booking.booking.taxAmount??tax),
        serviceFeeAmount:Number(booking.booking.serviceFeeAmount??fee),
        totalAmount:Number(booking.booking.totalAmount??amount),
        items:booking.booking.items||[],
        notes:booking.booking.notes||customer.notes,
      });
      toast.success('Confirmation PDF downloaded');
    }catch(error:any){toast.error(error?.message||'Could not create the confirmation PDF')}
    setDownloadingConfirmation(false);
  };

  if(loading)return <LinkupPageLoader variant="checkout"/>;
  if(!pkg)return <div className="min-h-screen bg-[#050817] text-white"><LinkupHeader/><main className="mx-auto max-w-xl px-5 py-24 text-center"><Package className="mx-auto text-violet-400" size={48}/><h1 className="mt-5 text-3xl font-black">Package unavailable</h1><p className="mt-3 text-slate-400">This package may be sold out or no longer published.</p><button onClick={()=>navigate('/linkup/packages')} className="mt-7 rounded-xl bg-violet-600 px-5 py-3 font-bold">Browse packages</button></main></div>;

  const reference=booking?.booking?.bookingReference;
  const amount=booking?.booking?.totalAmount??payment?.quote?.totalAmount??total;
  const currency=booking?.booking?.currency||pkg.currency;
  const maxGuests=Number(pkg.seatingCapacity||pkg.seating?.capacity||1);

  return <div className="linkup-content-ready min-h-screen bg-[#050817] text-white">
    <LinkupHeader onSignIn={()=>setShowGoogleSignIn(true)}/>
    <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.16),transparent_40%)]">
      <div className="mx-auto max-w-7xl px-5 py-8">
        <button onClick={()=>navigate(event?`/linkup/events/${event._id}`:'/linkup/packages')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white"><ArrowLeft size={16}/> Back to package</button>
        <div className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-violet-300"><LockKeyhole size={14}/> Secure checkout</div><h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight md:text-5xl">Complete your booking</h1><p className="mt-3 text-slate-400">Your booking is recorded only after you upload a valid payment receipt and complete submission.</p></div><div className="flex items-center gap-2 text-xs font-bold"><span className="rounded-full bg-violet-600 px-3 py-2">1. Details</span><span className={payment?'rounded-full bg-violet-600 px-3 py-2':'rounded-full bg-white/5 px-3 py-2 text-slate-500'}>2. Payment</span><span className={booking?.submitted?'rounded-full bg-emerald-500 px-3 py-2':'rounded-full bg-white/5 px-3 py-2 text-slate-500'}>3. Verification</span></div></div>
      </div>
    </div>

    <main className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className="space-y-6">
        {booking?.submitted?<div className="overflow-hidden rounded-3xl border border-emerald-400/20 bg-emerald-500/10 text-center"><div className="p-8 md:p-12"><span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-950/20"><CheckCircle2 size={40}/></span><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-emerald-300">Submission complete</p><h2 className="mt-2 text-3xl font-black">Payment receipt received</h2><p className="mx-auto mt-3 max-w-xl leading-7 text-emerald-100/75">Your receipt is awaiting verification. HoodBoy Entertainment will confirm your reservation after the payment is approved.</p><div className="mx-auto mt-6 max-w-md rounded-2xl border border-emerald-300/20 bg-black/20 p-5"><span className="block text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300/70">Booking reference</span><strong className="mt-2 block break-all font-mono text-lg text-emerald-100">{reference}</strong></div><div className="mx-auto mt-7 flex max-w-lg flex-col justify-center gap-3 sm:flex-row"><button disabled={downloadingConfirmation} onClick={downloadConfirmation} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-black text-slate-950 shadow-xl transition hover:bg-emerald-50 disabled:opacity-60">{downloadingConfirmation?<Loader2 className="animate-spin" size={17}/>:<Download size={17}/>} {downloadingConfirmation?'Creating PDF…':'Download confirmation PDF'}</button><button onClick={()=>navigate('/linkup')} className="rounded-xl border border-emerald-300/25 bg-emerald-950/20 px-5 py-3.5 text-sm font-black text-emerald-100 transition hover:bg-emerald-900/30">Return to events</button></div></div><div className="border-t border-emerald-300/15 bg-black/15 px-6 py-4 text-xs text-emerald-100/55">Keep the PDF for your records. It confirms submission and is not final proof of payment approval.</div></div>
        :payment?<>
          <div className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/5 p-6 md:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Payment required before booking</p><h2 className="mt-2 text-2xl font-black">Transfer {money(amount,currency)}</h2><p className="mt-2 text-sm text-slate-300">No booking or inventory hold exists yet. Complete the transfer and upload its receipt below to submit your booking.</p></div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 md:p-8"><h2 className="text-xl font-black">1. Choose the receiving account</h2><div className="mt-5 grid gap-3">{payment.bankAccounts.map((account:AnyRecord)=><label key={account._id} className={`cursor-pointer rounded-2xl border p-5 transition ${receipt.bankAccountId===account._id?'border-violet-400 bg-violet-500/10 shadow-lg shadow-violet-950/20':'border-white/10 bg-black/10 hover:border-white/20'}`}><span className="flex items-start gap-3"><input type="radio" className="mt-1 accent-violet-500" checked={receipt.bankAccountId===account._id} onChange={()=>setReceipt({...receipt,bankAccountId:account._id})}/><span className="min-w-0 flex-1"><b className="text-lg">{account.bankName}</b><span className="mt-2 block text-sm text-slate-300">{account.accountHolderName}</span><span className="mt-1 flex items-center gap-2 break-all font-mono text-sm text-violet-200">{account.accountNumber}<button type="button" onClick={e=>{e.preventDefault();void navigator.clipboard.writeText(account.accountNumber);toast.success('Account number copied')}}><Copy size={14}/></button></span><small className="mt-2 block text-slate-500">{account.currency}{account.branchName&&` · ${account.branchName}`}</small></span>{receipt.bankAccountId===account._id&&<Check className="text-violet-300" size={20}/>}</span></label>)}</div></div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 md:p-8"><h2 className="text-xl font-black">2. Upload payment proof</h2><p className="mt-2 text-sm text-slate-400">Upload first. The system will scan the receipt and suggest its reference number and payment date.</p><div className="mt-6 grid gap-5 md:grid-cols-2"><label className="md:col-span-2 cursor-pointer rounded-2xl border-2 border-dashed border-white/15 bg-black/10 p-8 text-center transition hover:border-violet-400/60 hover:bg-violet-500/5">{receiptScan.status==='scanning'?<Loader2 className="mx-auto animate-spin text-violet-400" size={28}/>:receipt.file?<FileSearch className="mx-auto text-emerald-400" size={28}/>:<Upload className="mx-auto text-violet-400" size={28}/>}<b className="mt-3 block">{receipt.file?.name||'Choose receipt or screenshot'}</b><small className="mt-1 block text-slate-500">JPG, PNG, or PDF · Maximum 8 MB · Scanned privately in your browser</small>{receiptScan.status==='scanning'&&<span className="mx-auto mt-4 block h-1.5 max-w-sm overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-violet-500 transition-all" style={{width:`${receiptScan.progress}%`}}/></span>}<input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" disabled={receiptScan.status==='scanning'} onChange={e=>{void chooseReceipt(e.target.files?.[0]||null);e.target.value=''}}/></label>{receiptScan.status!=='idle'&&receiptScan.status!=='scanning'&&<div className={`md:col-span-2 rounded-xl border p-4 text-sm ${receiptScan.status==='success'?'border-emerald-400/20 bg-emerald-500/10 text-emerald-100':receiptScan.status==='warning'?'border-amber-400/20 bg-amber-500/10 text-amber-100':'border-red-400/20 bg-red-500/10 text-red-100'}`}><b className="block">{receiptScan.status==='success'?'Receipt scanned — review required':receiptScan.status==='warning'?'Manual review needed':'Automatic scan unavailable'}</b><span className="mt-1 block opacity-80">{receiptScan.message}</span>{receiptScan.confidence!=null&&<small className="mt-2 block opacity-60">OCR confidence: {receiptScan.confidence}% · Always verify against the original receipt.</small>}</div>}<label className="text-sm font-bold text-slate-300">Transaction reference<input value={receipt.transferReference} onChange={e=>setReceipt({...receipt,transferReference:e.target.value})} className={`mt-2 h-12 w-full rounded-xl border bg-slate-950 px-4 outline-none focus:border-violet-400 ${receiptScan.status==='success'?'border-emerald-400/50':'border-white/10'}`} placeholder="Scanned automatically or enter manually"/></label><label className="text-sm font-bold text-slate-300">Payment date<input type="date" max={new Date().toISOString().slice(0,10)} value={receipt.paymentDate} onChange={e=>setReceipt({...receipt,paymentDate:e.target.value})} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-4 outline-none focus:border-violet-400"/></label><label className="md:col-span-2 text-sm font-bold text-slate-300">Payment note <span className="font-normal text-slate-500">(optional)</span><textarea rows={3} value={receipt.notes} onChange={e=>setReceipt({...receipt,notes:e.target.value})} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-violet-400" placeholder="Any information that will help us identify your transfer"/></label></div><button disabled={submitting||receiptScan.status==='scanning'} onClick={uploadReceipt} className="mt-6 h-13 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 font-black shadow-xl shadow-violet-950/30 disabled:opacity-50">{submitting?'Uploading receipt…':receiptScan.status==='scanning'?'Scanning receipt…':'Submit payment for verification'}</button></div>
        </>:<>
          {pkg.packageType==='customizable'&&<div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 md:p-8"><h2 className="text-xl font-black">Customize your experience</h2><p className="mt-2 text-sm text-slate-400">Choose any optional food and drink add-ons for your booking.</p>{availableFood.length>0&&<div className="mt-6"><h3 className="flex items-center gap-2 font-bold"><Utensils size={17} className="text-violet-300"/> Food options</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{availableFood.map((item:AnyRecord)=><label key={item._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-3"><span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-violet-500/10">{item.image&&<img src={item.image} alt="" className="h-full w-full object-cover"/>}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.name}</b><small className="text-slate-400">{money(item.price,pkg.currency)}</small></span><input aria-label={`${item.name} quantity`} type="number" min="0" max={item.availableQuantity} value={food[item._id]||0} onChange={e=>setFood({...food,[item._id]:Math.max(0,Number(e.target.value)||0)})} className="h-10 w-16 rounded-lg border border-white/10 bg-slate-950 px-2 text-center"/></label>)}</div></div>}{availableAlcohol.length>0&&<div className="mt-6"><h3 className="flex items-center gap-2 font-bold"><Wine size={17} className="text-fuchsia-300"/> Drinks</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{availableAlcohol.map((item:AnyRecord)=><label key={item._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-3"><span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.name}</b><small className="text-slate-400">{money(item.price,pkg.currency)}</small></span><input aria-label={`${item.name} quantity`} type="number" min="0" max={item.availableQuantity} value={alcohol[item._id]||0} onChange={e=>setAlcohol({...alcohol,[item._id]:Math.max(0,Number(e.target.value)||0)})} className="h-10 w-16 rounded-lg border border-white/10 bg-slate-950 px-2 text-center"/></label>)}</div><label className="mt-4 flex items-start gap-3 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-100"><input type="checkbox" className="mt-1 accent-violet-500" checked={customer.ageConfirmed} onChange={e=>setCustomer({...customer,ageConfirmed:e.target.checked})}/><span>I confirm that I meet the legal drinking age and will present valid identification at the venue.</span></label></div>}</div>}
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 md:p-8"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Your details</h2><p className="mt-2 text-sm text-slate-400">Your Google account securely identifies this booking.</p></div><ShieldCheck className="text-emerald-400"/></div>{user?<div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4"><span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-emerald-400 font-black text-slate-950">{user.avatar?<img src={user.avatar} alt="" className="h-full w-full object-cover"/>:String(user.name||'C')[0]}</span><span><b className="block">{user.name}</b><small className="text-emerald-200/70">{user.email}</small></span><CheckCircle2 className="ml-auto text-emerald-400"/></div>:<button onClick={()=>setShowGoogleSignIn(true)} className="mt-5 w-full rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-3.5 font-black text-violet-200 transition hover:bg-violet-500/20">Sign in with Google to continue</button>}<div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-300">Contact number<input value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-4 outline-none focus:border-violet-400" placeholder="Your phone number"/></label><label className="text-sm font-bold text-slate-300">Number of guests<input type="number" min="1" max={maxGuests} value={customer.guestCount} onChange={e=>setCustomer({...customer,guestCount:Number(e.target.value)})} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-4 outline-none focus:border-violet-400"/></label><label className="md:col-span-2 text-sm font-bold text-slate-300">Special requests <span className="font-normal text-slate-500">(optional)</span><textarea rows={3} value={customer.notes} onChange={e=>setCustomer({...customer,notes:e.target.value})} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-violet-400" placeholder="Accessibility needs, dietary notes, or other requests"/></label></div></div>
        </>}
      </section>

      <aside><div className="sticky top-28 overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/30"><div className="relative h-48 bg-gradient-to-br from-violet-900 to-slate-900">{pkg.image?<img src={pkg.image} alt={pkg.name} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center"><Package size={52} className="text-white/20"/></div>}<div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"/></div><div className="p-6"><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Your reservation</p><h2 className="mt-2 text-2xl font-black">{pkg.name}</h2><div className="mt-5 space-y-3 text-sm text-slate-300">{event&&<><div className="flex gap-3"><CalendarDays className="shrink-0 text-violet-300" size={17}/><span>{new Date(event.eventDate).toLocaleString()}</span></div><div className="flex gap-3"><MapPin className="shrink-0 text-violet-300" size={17}/><span>{event.venueName||event.location}</span></div></>}<div className="flex gap-3"><Armchair className="shrink-0 text-violet-300" size={17}/><span>{pkg.seating?.name} · up to {maxGuests} guests</span></div><div className="flex gap-3"><Users className="shrink-0 text-violet-300" size={17}/><span>{pkg.availableQuantity} packages available</span></div></div><div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm"><div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="text-white">{money(booking?.booking?.subtotal??payment?.quote?.subtotal??subtotal,currency)}</span></div><div className="flex justify-between text-slate-400"><span>Tax</span><span className="text-white">{money(booking?.booking?.taxAmount??payment?.quote?.taxAmount??tax,currency)}</span></div><div className="flex justify-between text-slate-400"><span>Service fee</span><span className="text-white">{money(booking?.booking?.serviceFeeAmount??payment?.quote?.serviceFeeAmount??fee,currency)}</span></div><div className="flex justify-between border-t border-white/10 pt-4 text-xl font-black"><span>Total</span><span>{money(amount,currency)}</span></div></div>{!payment&&!booking&&(pkg.bankTransferAvailable?<button disabled={submitting} onClick={reserve} className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 font-black shadow-xl shadow-violet-950/30 transition hover:brightness-110 disabled:opacity-50">{submitting?'Preparing payment…':user?'Continue to payment':'Sign in to purchase'}</button>:<div className="mt-6 rounded-xl bg-amber-500/10 p-4 text-sm font-bold text-amber-300">No payment method is currently available.</div>)}<div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500"><LockKeyhole size={12}/> Booking is created only with payment proof</div></div></div></aside>
    </main>

    {showGoogleSignIn&&<div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-7 text-slate-900 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-2xl font-black">Sign in to continue</h2><p className="mt-2 text-sm text-slate-500">Use Google to securely reserve this package and submit payment proof.</p></div><button onClick={()=>setShowGoogleSignIn(false)} className="text-2xl text-slate-400">×</button></div><div className="mt-6"><GoogleSignInButton onCredential={async credential=>{setSubmitting(true);try{await googleLogin(credential,true);setShowGoogleSignIn(false);toast.success('Signed in successfully')}catch(error:any){toast.error(error.response?.data?.message||'Google sign-in failed')}setSubmitting(false)}} onError={message=>toast.error(message)}/></div><p className="mt-4 text-center text-xs text-slate-400">Your Google email protects access to this booking.</p></div></div>}
  </div>;
};

export default LinkupCheckout;
