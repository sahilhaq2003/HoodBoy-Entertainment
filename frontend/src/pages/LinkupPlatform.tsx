import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Armchair, Mic2, Store, Utensils, Wine, Package, Landmark, TicketCheck, BadgeDollarSign, Settings, Plus, Pencil, Trash2, RefreshCw, ExternalLink, Check, X, Search, Download, Eye, FileText, ArrowUpRight, ImagePlus, Loader2, MessageSquareText, ChevronLeft, ChevronRight, Cloud, WifiOff, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { linkupPlatformApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmailSettingsPanel from '../components/linkup/EmailSettingsPanel';
import { compressImageForUpload } from '../utils/imageCompression';
import { useAuth } from '../contexts/AuthContext';
import LinkupCheckInPanel from '../components/linkup/LinkupCheckInPanel';

type RecordItem = Record<string, any> & { _id: string };
type ReceiptPreview = { url: string; fileName: string; mimeType: string };
type Field = { key: string; label: string; type?: string; required?: boolean; integer?: boolean; options?: [string,string][]; resource?: string; multiple?: boolean; help?: string };
type Section = { key: string; label: string; icon: React.ReactNode; fields?: Field[]; columns?: string[]; readOnly?: boolean };
const PAGE_SIZE = 25;
const DRAFT_VERSION = 1;

const statusOptions = (values: string[]): [string,string][] => values.map(value => [value, value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())]);
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const supportedTimeZones = (() => {
  const zones = typeof (Intl as any).supportedValuesOf === 'function'
    ? (Intl as any).supportedValuesOf('timeZone') as string[]
    : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Colombo', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
  return [...new Set(['UTC', browserTimeZone, ...zones])].map((zone): [string,string] => [zone, zone.replaceAll('_', ' ')]);
})();
const sections: Section[] = [
  { key: 'overview', label: 'Overview', icon: <BarChart3 size={17}/> },
  { key: 'events', label: 'Events', icon: <CalendarDays size={17}/>, columns: ['banner','title','eventDate','venueName','status'], fields: [
    {key:'title',label:'Event name',required:true},{key:'description',label:'Description',type:'textarea'},{key:'banner',label:'Event cover image',type:'image',help:'Recommended: 1600 × 900 pixels'},{key:'category',label:'Category'},
    {key:'eventDate',label:'Event date',type:'date',required:true},{key:'startTime',label:'Start time',type:'time'},{key:'endTime',label:'End time',type:'time'},
    {key:'timeZone',label:'Event time zone',type:'select',options:supportedTimeZones,required:true,help:'Select the venue location time zone. Emails and reminders use this zone, including daylight-saving changes.'},
    {key:'venueName',label:'Venue name'},{key:'location',label:'Address / location',required:true},{key:'bookingOpensAt',label:'Booking opens',type:'datetime-local'},
    {key:'bookingClosesAt',label:'Booking closes',type:'datetime-local'},{key:'status',label:'Status',type:'select',options:statusOptions(['draft','published','sold_out','completed','cancelled'])},{key:'ageRestricted',label:'Alcohol / age restricted event',type:'checkbox'} ] },
  { key: 'slots', label: 'Performance Slots', icon: <Mic2 size={17}/>, columns: ['title','event','scheduledAt','price','availableQuantity','status'], fields: [
    {key:'event',label:'Event',type:'relation',resource:'events',required:true},{key:'title',label:'Slot name',required:true},{key:'description',label:'Description',type:'textarea'},
    {key:'durationMinutes',label:'Duration (minutes)',type:'number',integer:true},{key:'scheduledAt',label:'Performance schedule',type:'datetime-local'},{key:'price',label:'Price',type:'number'},
    {key:'totalQuantity',label:'Total slots',type:'number',integer:true},{key:'availableQuantity',label:'Available slots',type:'number',integer:true},{key:'bookingDeadline',label:'Booking deadline',type:'datetime-local'},
    {key:'bankTransferEnabled',label:'Enable bank transfer',type:'checkbox'},{key:'bankAccounts',label:'Accepted bank accounts',type:'relation',resource:'bank-accounts',multiple:true},{key:'currency',label:'Currency'},{key:'paymentInstructions',label:'Payment instructions',type:'textarea'},
    {key:'status',label:'Status',type:'select',options:statusOptions(['available','pending','awaiting_payment','confirmed','cancelled'])} ] },
  { key: 'seating', label: 'Seating', icon: <Armchair size={17}/>, columns: ['name','event','seatingType','capacity','price','availableQuantity'], fields: [
    {key:'event',label:'Event',type:'relation',resource:'events',required:true},{key:'name',label:'Chair / table name',required:true},{key:'seatingType',label:'Type',type:'select',options:statusOptions(['chair','table']),required:true},
    {key:'capacity',label:'Guest capacity',type:'number',integer:true},{key:'price',label:'Price',type:'number'},{key:'totalQuantity',label:'Total quantity',type:'number',integer:true},
    {key:'availableQuantity',label:'Available quantity',type:'number',integer:true},{key:'description',label:'Description',type:'textarea'},{key:'isActive',label:'Active',type:'checkbox'} ] },
  { key: 'vendors', label: 'Food Vendors', icon: <Store size={17}/>, columns: ['logo','name','contactPerson','phone','email','isActive'], fields: [
    {key:'name',label:'Vendor name',required:true},{key:'contactPerson',label:'Contact person'},{key:'phone',label:'Phone'},{key:'email',label:'Email',type:'email'},
    {key:'description',label:'Description',type:'textarea'},{key:'logo',label:'Vendor logo',type:'image',help:'Square images work best'},{key:'address',label:'Address',type:'textarea'},{key:'isActive',label:'Active',type:'checkbox'} ] },
  { key: 'food', label: 'Food Menu', icon: <Utensils size={17}/>, columns: ['image','name','vendor','category','price','availableQuantity','isActive'], fields: [
    {key:'vendor',label:'Vendor',type:'relation',resource:'vendors',required:true},{key:'events',label:'Events',type:'relation',resource:'events',multiple:true},{key:'category',label:'Category',help:'Chicken, Beef, Pork, Seafood, Vegetarian, or a custom category'},
    {key:'name',label:'Food name',required:true},{key:'description',label:'Description',type:'textarea'},{key:'image',label:'Food image',type:'image',help:'Recommended: 1200 × 900 pixels'},{key:'price',label:'Price',type:'number'},
    {key:'availableQuantity',label:'Available quantity',type:'number',integer:true},{key:'dietaryInfo',label:'Dietary information'},{key:'allergenInfo',label:'Allergen information'},{key:'isActive',label:'Active',type:'checkbox'} ] },
  { key: 'alcohol', label: 'Alcohol Options', icon: <Wine size={17}/>, columns: ['image','name','category','price','servingSize','availableQuantity','isActive'], fields: [
    {key:'events',label:'Events',type:'relation',resource:'events',multiple:true},{key:'name',label:'Item name',required:true},{key:'category',label:'Category / type'},
    {key:'description',label:'Description',type:'textarea'},{key:'price',label:'Price',type:'number'},{key:'servingSize',label:'Serving size'},{key:'image',label:'Product image',type:'image',help:'Square images work best'},
    {key:'availableQuantity',label:'Available quantity',type:'number',integer:true},{key:'pricingMode',label:'Pricing',type:'select',options:statusOptions(['per_person','per_table'])},{key:'minimumAge',label:'Minimum age',type:'number',integer:true},{key:'isActive',label:'Active',type:'checkbox'} ] },
  { key: 'packages', label: 'Packages', icon: <Package size={17}/>, columns: ['image','name','event','packageType','packagePrice','availableQuantity','status'], fields: [
    {key:'event',label:'Event (select first)',type:'relation',resource:'events',required:true},{key:'name',label:'Package name',required:true},{key:'description',label:'Description',type:'textarea'},{key:'image',label:'Package cover image',type:'image',help:'Recommended: 1600 × 900 pixels'},
    {key:'packageType',label:'Package type',type:'select',options:statusOptions(['predefined','customizable'])},{key:'seating',label:'Seating configuration',type:'relation',resource:'seating',required:true},
    {key:'seatingCapacity',label:'Guest capacity',type:'number',integer:true},{key:'basePrice',label:'Base seating price',type:'number'},{key:'packagePrice',label:'Package selling price',type:'number'},
    {key:'includedItems',label:'Items included in this package',type:'package-items',help:'Included in the package price'},
    {key:'optionalItems',label:'Optional customer add-ons',type:'package-items',help:'Customers can add these during booking'},{key:'totalQuantity',label:'Total quantity',type:'number',integer:true},{key:'availableQuantity',label:'Available quantity',type:'number',integer:true},
    {key:'taxRate',label:'Tax rate (%)',type:'number'},{key:'serviceFeeRate',label:'Service fee (%)',type:'number'},{key:'currency',label:'Currency'},
    {key:'bankTransferEnabled',label:'Enable bank transfer',type:'checkbox'},{key:'bankAccounts',label:'Accepted bank accounts',type:'relation',resource:'bank-accounts',multiple:true},
    {key:'defaultBankAccount',label:'Default bank account',type:'relation',resource:'bank-accounts'},{key:'paymentInstructions',label:'Payment instructions',type:'textarea'},
    {key:'paymentDeadlineHours',label:'Payment deadline (hours)',type:'number',integer:true},{key:'checkoutHoldMinutes',label:'Checkout hold (minutes)',type:'number',integer:true},
    {key:'status',label:'Publish status',type:'select',options:statusOptions(['draft','published','inactive'])} ] },
  { key: 'bank-accounts', label: 'Bank Accounts', icon: <Landmark size={17}/>, columns: ['bankName','accountHolderName','accountNumber','currency','isActive'], fields: [
    {key:'bankName',label:'Bank name',required:true},{key:'accountHolderName',label:'Account holder',required:true},{key:'accountNumber',label:'Account number',required:true},
    {key:'branchName',label:'Branch name'},{key:'routingNumber',label:'Routing / sort code'},{key:'swiftCode',label:'SWIFT / BIC'},{key:'iban',label:'IBAN'},
    {key:'country',label:'Country'},{key:'currency',label:'Currency',required:true},{key:'instructions',label:'Payment instructions',type:'textarea'},{key:'isActive',label:'Active',type:'checkbox'} ] },
  { key: 'bookings', label: 'Bookings', icon: <TicketCheck size={17}/>, columns: ['bookingReference','customerName','event','totalAmount','bookingStatus','paymentStatus'], readOnly:true },
  { key: 'transfers', label: 'Payment Verification', icon: <BadgeDollarSign size={17}/>, columns: ['booking','bankAccount','transferReference','amount','verificationStatus','createdAt'], readOnly:true },
  { key: 'check-in', label: 'QR Check-In', icon: <QrCode size={17}/> },
  { key: 'settings', label: 'Settings', icon: <Settings size={17}/> },
];

const show = (value: any) => {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive';
  if (typeof value === 'object') return value.title || value.name || value.bookingReference || value.bankName || 'Linked record';
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(value))) return new Date(value).toLocaleString();
  return String(value).replaceAll('_',' ');
};

const localDateValue = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const dateValueInTimeZone = (timeZone = browserTimeZone, date = new Date()) => {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch { return localDateValue(date); }
};

const localDateTimeValue = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const storedUploadUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value) return value;
  try { const url = new URL(value); return url.pathname.startsWith('/uploads/') ? url.pathname : value; }
  catch { return value; }
};

type PackageSelection = { itemType: 'food'|'alcohol'; itemId: string; name: string; quantity: number };
const PackageItemsEditor: React.FC<{ items:PackageSelection[]; food:RecordItem[]; alcohol:RecordItem[]; eventId:string; currency?:string; help?:string; onChange:(items:PackageSelection[])=>void }> = ({items=[],food,alcohol,eventId,currency='USD',help,onChange}) => {
  const [choice,setChoice]=useState('');
  useEffect(()=>setChoice(''),[eventId]);
  const activeItem=(item:RecordItem)=>item.isActive!==false;
  const catalog:Array<RecordItem&{itemType:'food'|'alcohol'}>=[...food.filter(activeItem).map(item=>({...item,itemType:'food' as const})),...alcohol.filter(activeItem).map(item=>({...item,itemType:'alcohol' as const}))];
  const add=()=>{const [itemType,itemId]=choice.split(':');const item=catalog.find(entry=>entry.itemType===itemType&&String(entry._id)===itemId);if(!item)return;if(items.some(entry=>entry.itemType===itemType&&String(entry.itemId)===itemId))return;onChange([...items,{itemType:itemType as 'food'|'alcohol',itemId,name:item.name,quantity:1}]);setChoice('')};
  if(!eventId)return <span className="mt-1.5 block rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Select the package event first to load its available items.</span>;
  return <span className="mt-1.5 block rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="flex flex-col gap-2 sm:flex-row"><select value={choice} onChange={event=>setChoice(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium outline-none focus:border-violet-500"><option value="">Select food or alcohol item…</option>{catalog.some(item=>item.itemType==='food')&&<optgroup label="Food menu">{catalog.filter(item=>item.itemType==='food').map(item=><option key={`food-${item._id}`} value={`food:${item._id}`}>{item.name} — {Number(item.price||0).toLocaleString(undefined,{style:'currency',currency})}</option>)}</optgroup>}{catalog.some(item=>item.itemType==='alcohol')&&<optgroup label="Alcohol options">{catalog.filter(item=>item.itemType==='alcohol').map(item=><option key={`alcohol-${item._id}`} value={`alcohol:${item._id}`}>{item.name} — {Number(item.price||0).toLocaleString(undefined,{style:'currency',currency})}</option>)}</optgroup>}</select><button type="button" disabled={!choice} onClick={event=>{event.preventDefault();add()}} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus size={15}/> Add item</button></span>{help&&<span className="mt-2 block text-xs font-medium text-slate-500">{help}</span>}{!catalog.length&&<span className="mt-3 block rounded-lg bg-white p-3 text-xs font-semibold text-slate-500">No active food or alcohol items are assigned to this event yet.</span>}<span className="mt-3 grid gap-2">{items.map((entry,index)=>{const item=catalog.find(option=>option.itemType===entry.itemType&&String(option._id)===String(entry.itemId));return <span key={`${entry.itemType}-${entry.itemId}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-violet-100 text-violet-700">{item?.image?<img src={item.image} alt="" className="h-full w-full object-cover"/>:entry.itemType==='food'?<Utensils size={18}/>:<Wine size={18}/>}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{entry.name||item?.name||'Selected item'}</strong><small className="font-bold uppercase tracking-wide text-slate-400">{entry.itemType}</small></span><span className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-500">Qty</span><input type="number" min="1" step="1" inputMode="numeric" value={entry.quantity||1} onWheel={event=>event.currentTarget.blur()} onChange={event=>onChange(items.map((current,i)=>i===index?{...current,quantity:Math.max(1,Math.floor(Number(event.target.value)||1))}:current))} className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/><button type="button" aria-label={`Remove ${entry.name}`} onClick={event=>{event.preventDefault();onChange(items.filter((_,i)=>i!==index))}} className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={15}/></button></span></span>})}</span></span>;
};

const LinkupPlatform: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get('section');
  const initialSection = requestedSection && sections.some(item => item.key === requestedSection) && (requestedSection !== 'check-in' || user?.role === 'admin') ? requestedSection : 'overview';
  const [active, setActive] = useState(initialSection);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [overview, setOverview] = useState<Record<string,number>>({});
  const [relations, setRelations] = useState<Record<string,RecordItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RecordItem|null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string,any>>({});
  const [formError, setFormError] = useState('');
  const [uploadingImage, setUploadingImage] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState<number|null>(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [deleteId, setDeleteId] = useState<string|null>(null);
  const [sensitiveAction, setSensitiveAction] = useState<{
    kind: 'transfer' | 'booking';
    record: RecordItem;
    action: 'approve' | 'reject' | 'request_information' | 'cancel';
    reason?: string;
  } | null>(null);
  const [reasonAction, setReasonAction] = useState<{
    record: RecordItem;
    action: 'reject' | 'request_information';
  } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<ReceiptPreview|null>(null);
  const [previewingReceiptId, setPreviewingReceiptId] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const section = useMemo(() => sections.find(item => item.key === active)!, [active]);
  const availableSections = useMemo(() => user?.role === 'admin' ? sections : sections.filter(item => item.key !== 'check-in'), [user?.role]);
  const draftKey = useMemo(() => `hbe-linkup-draft:v${DRAFT_VERSION}:${user?._id || 'staff'}:${active}`, [user?._id, active]);
  const visibleRecords = useMemo(() => records.filter(record => !search || JSON.stringify(record).toLowerCase().includes(search.toLowerCase())), [records,search]);
  const totalPages = Math.max(1, Math.ceil(visibleRecords.length / PAGE_SIZE));
  const paginatedRecords = useMemo(() => visibleRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [visibleRecords,page]);

  useEffect(() => { setPage(1); }, [active,search]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page,totalPages]);
  useEffect(() => () => { if (receiptPreview?.url) URL.revokeObjectURL(receiptPreview.url); }, [receiptPreview]);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  useEffect(() => {
    if (!formOpen || editing || !section.fields?.length) return;
    try {
      const allowed = new Set(section.fields.map(field => field.key));
      const draftForm = Object.fromEntries(Object.entries(form).filter(([key]) => allowed.has(key)));
      const savedAt = Date.now();
      localStorage.setItem(draftKey, JSON.stringify({ version: DRAFT_VERSION, section: active, savedAt, form: draftForm }));
      setDraftSavedAt(savedAt);
    } catch {
      setDraftSavedAt(null);
    }
  }, [form, formOpen, editing, section.fields, draftKey, active]);

  const clearDraft = () => {
    try { localStorage.removeItem(draftKey); } catch { /* Local storage may be unavailable. */ }
    setDraftSavedAt(null);
  };

  const switchSection = (key:string) => {
    if (key === active) return;
    setLoading(true);
    setSearch('');
    setActive(key);
    setSearchParams(key === 'overview' ? {} : { section: key }, { replace: true });
  };

  useEffect(() => {
    const next = searchParams.get('section') || 'overview';
    const allowed = sections.some(item => item.key === next) && (next !== 'check-in' || user?.role === 'admin');
    if (allowed && next !== active) {
      setLoading(true);
      setSearch('');
      setActive(next);
    }
  }, [searchParams, user?.role, active]);

  useEffect(() => {
    if (!formOpen || editing) return;
    const timer = window.setTimeout(() => {
      document.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach(input => { input.min = active === 'events' ? dateValueInTimeZone(form.timeZone) : localDateValue(); });
      document.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]').forEach(input => { input.min = localDateTimeValue(); });
      document.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach(input => { input.min = '0'; });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [formOpen, editing, active, form.timeZone]);

  const load = async () => {
    setLoading(true);
    try {
      if (active === 'check-in') setRecords([]);
      else if (active === 'overview' || active === 'settings') setOverview((await linkupPlatformApi.overview()).data.data);
      else setRecords((await linkupPlatformApi.list(active)).data.data || []);
    } catch (error:any) { toast.error(error.response?.data?.message || 'Could not load Linkup data'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [active]);

  const openForm = async (record?:RecordItem) => {
    let source = record;
    if (record?._id) {
      try {
        source = (await linkupPlatformApi.get(active, record._id)).data.data;
      } catch (error:any) {
        if (error.response?.status === 404) {
          toast.error('This record no longer exists. The list has been refreshed.');
          await load();
          return;
        }
        toast.error(error.response?.data?.message || 'Could not load the latest record details');
        return;
      }
    }
    const next:Record<string,any> = {};
    for (const field of section.fields || []) {
      const raw = source?.[field.key];
      if (field.type === 'json') next[field.key] = JSON.stringify(raw || [], null, 2);
      else if (field.type === 'package-items') next[field.key] = (Array.isArray(raw)?raw:[]).map((item:any)=>({itemType:item.itemType,itemId:String(item.itemId?._id||item.itemId||''),name:item.name||'',quantity:Number(item.quantity||1)}));
      else if (field.multiple) next[field.key] = (raw || []).map((item:any) => String(item?._id || item)).filter(Boolean);
      else if (field.type === 'date' && raw) next[field.key] = String(raw).slice(0,10);
      else if (field.type === 'datetime-local' && raw) next[field.key] = String(raw).slice(0,16);
      else next[field.key] = raw?._id ?? raw ?? (field.key === 'timeZone' ? browserTimeZone : field.type === 'checkbox' ? true : '');
    }
    let restoredAt:number|null = null;
    if (!source) {
      try {
        const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
        if (saved?.version === DRAFT_VERSION && saved?.section === active && saved?.form && typeof saved.form === 'object') {
          const allowed = new Set((section.fields || []).map(field => field.key));
          Object.assign(next, Object.fromEntries(Object.entries(saved.form).filter(([key]) => allowed.has(key))));
          restoredAt = Number(saved.savedAt) || null;
        }
      } catch { localStorage.removeItem(draftKey); }
    }
    const resourcesToLoad=[...new Set([
      ...(section.fields || []).filter(field=>field.type==='relation'&&field.resource).map(field=>field.resource!),
      ...(section.key==='packages'?['food','alcohol']:[]),
    ])];
    if(resourcesToLoad.length){
      try {
        const loaded=await Promise.all(resourcesToLoad.map(resource=>linkupPlatformApi.list(resource)));
        setRelations(current=>({...current,...Object.fromEntries(resourcesToLoad.map((resource,index)=>[resource,loaded[index].data.data||[]]))}));
      } catch (error:any) {
        toast.error(!navigator.onLine ? 'You are offline. Your draft is available; linked options will refresh after reconnecting.' : error.response?.data?.message || 'Could not refresh linked options');
      }
    }
    setEditing(source || null); setForm(next); setFormError(''); setUploadingImage(''); setDraftSavedAt(restoredAt); setFormOpen(true);
    if (restoredAt) toast.success('Your saved draft has been restored.');
  };

  const uploadFormImage = async (field: Field, file?: File) => {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return setFormError('Image must be a JPG, PNG, or WEBP file.');
    if (file.size > 5 * 1024 * 1024) return setFormError('Image must be smaller than 5 MB.');
    setFormError(''); setUploadingImage(field.key);
    try {
      const optimizedFile = await compressImageForUpload(file);
      const data = new FormData(); data.append('image', optimizedFile);
      const response = await linkupPlatformApi.uploadImage(data);
      setForm(current => ({ ...current, [field.key]: response.data.data.url }));
      const saved = file.size - Number(response.data.data.optimizedBytes || optimizedFile.size);
      toast.success(saved > 0 ? `Image optimized · ${Math.round(saved / 1024)} KB saved` : 'Image optimized and uploaded');
    } catch (error:any) {
      const message = error.response?.data?.message || 'Image upload failed. Please try again.';
      setFormError(message); toast.error(message);
    } finally { setUploadingImage(''); }
  };

  const save = async () => {
    setFormError('');
    try {
      const payload = {...form};
      for (const field of section.fields || []) {
        const raw = payload[field.key];
        if (field.required && (raw == null || raw === '' || (Array.isArray(raw) && !raw.length))) throw new Error(`${field.label} is required.`);
        if (field.type === 'number') {
          const number = raw === '' || raw == null ? 0 : Number(raw);
          if (!Number.isFinite(number)) throw new Error(`${field.label} must be a valid number.`);
          if (number < 0) throw new Error(`${field.label} cannot be negative.`);
          if (field.integer && !Number.isInteger(number)) throw new Error(`${field.label} must be a whole number.`);
          payload[field.key] = number;
        }
        if (field.type === 'json') {
          try { payload[field.key] = JSON.parse(raw || '[]'); }
          catch { throw new Error(`${field.label} must contain valid JSON.`); }
        }
        if (field.multiple) payload[field.key] = (Array.isArray(raw) ? raw : []).map(value=>String(value?._id||value||'')).filter(Boolean);
        if (field.type === 'email' && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw))) throw new Error(`${field.label} must be a valid email address.`);
        if (['banner','logo','image'].includes(field.key) && raw) {
          try { const url = new URL(String(raw)); if (!['http:','https:'].includes(url.protocol)) throw new Error(); }
          catch { throw new Error(`${field.label} must be a valid http or https URL.`); }
        }
        if (!editing && raw && field.type === 'date' && String(raw) < (active === 'events' ? dateValueInTimeZone(payload.timeZone) : localDateValue())) throw new Error(`${field.label} cannot be in the past at the selected location.`);
        if (!editing && raw && field.type === 'datetime-local' && String(raw) < localDateTimeValue()) throw new Error(`${field.label} cannot be in the past.`);
      }
      if (payload.startTime && payload.endTime && payload.endTime <= payload.startTime) throw new Error('End time must be later than start time.');
      if (payload.bookingOpensAt && payload.bookingClosesAt && new Date(payload.bookingClosesAt) <= new Date(payload.bookingOpensAt)) throw new Error('Booking close time must be later than booking open time.');
      if (payload.scheduledAt && payload.bookingDeadline && new Date(payload.bookingDeadline) > new Date(payload.scheduledAt)) throw new Error('Booking deadline must be before the performance schedule.');
      if (payload.availableQuantity != null && payload.totalQuantity != null && Number(payload.availableQuantity) > Number(payload.totalQuantity)) throw new Error('Available quantity cannot exceed total quantity.');
      if (payload.taxRate > 100 || payload.serviceFeeRate > 100) throw new Error('Tax and service fee rates cannot exceed 100%.');
      for (const key of ['banner','logo','image']) if (payload[key]) payload[key] = storedUploadUrl(payload[key]);
      if (editing) await linkupPlatformApi.update(active, editing._id, payload); else await linkupPlatformApi.create(active, payload);
      if (!editing) clearDraft();
      toast.success(editing ? 'Updated successfully' : 'Created successfully'); setFormOpen(false); setEditing(null); load();
    } catch (error:any) {
      if (editing && error.response?.status === 404) {
        setFormOpen(false); setEditing(null); setFormError('');
        toast.error('This record was removed or changed elsewhere. The list has been refreshed.');
        await load();
        return;
      }
      const message=!navigator.onLine || !error.response ? 'Network unavailable. Your work is saved locally as a draft and will be ready when you reconnect.' : error.response?.data?.message || error.message || 'Could not save'; setFormError(message); toast.error(message);
    }
  };

  const requestVerification = (record:RecordItem, action:'approve'|'reject'|'request_information') => {
    if (action === 'approve') {
      setSensitiveAction({ kind:'transfer', record, action, reason:'' });
      return;
    }
    setReviewReason('');
    setReasonError('');
    setReasonAction({ record, action });
  };
  const continueReasonAction = () => {
    if (!reasonAction) return;
    const reason = reviewReason.trim();
    if (reason.length < 5) {
      setReasonError('Please enter a clear reason using at least 5 characters.');
      return;
    }
    setSensitiveAction({ kind:'transfer', record:reasonAction.record, action:reasonAction.action, reason });
    setReasonAction(null);
    setReviewReason('');
    setReasonError('');
  };
  const confirmSensitiveAction = async () => {
    if (!sensitiveAction) return;
    const { kind, record, action, reason = '' } = sensitiveAction;
    try {
      if (kind === 'booking') {
        await linkupPlatformApi.cancelBooking(record._id);
        toast.success('Booking cancelled');
      } else {
        await linkupPlatformApi.verifyTransfer(record._id,{action,reason});
        toast.success('Payment review updated');
      }
      load();
    }
    catch (error:any) {
      if (kind === 'booking') toast.error(error.response?.data?.message || 'Cancellation failed');
      else toast.error(error.response?.data?.message || 'Verification failed');
      return;
    }
    setSensitiveAction(null);
  };
  const downloadReceipt = async (record:RecordItem) => {
    try { const response=await linkupPlatformApi.downloadReceipt(record._id);const url=URL.createObjectURL(response.data);const anchor=document.createElement('a');anchor.href=url;anchor.download=record.originalFileName||`receipt-${record.transferReference}`;anchor.click();URL.revokeObjectURL(url); }
    catch { toast.error('Could not download receipt'); }
  };
  const previewReceipt = async (record:RecordItem) => {
    setPreviewingReceiptId(record._id);
    try {
      const response = await linkupPlatformApi.downloadReceipt(record._id);
      const blob = response.data as Blob;
      const fileName = record.originalFileName || `receipt-${record.transferReference}`;
      const extension = fileName.split('.').pop()?.toLowerCase();
      const fallbackType = extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
      setReceiptPreview({ url: URL.createObjectURL(blob), fileName, mimeType: blob.type || fallbackType });
    } catch { toast.error('Could not preview receipt'); }
    finally { setPreviewingReceiptId(null); }
  };
  const downloadPreview = () => {
    if (!receiptPreview) return;
    const anchor = document.createElement('a');
    anchor.href = receiptPreview.url;
    anchor.download = receiptPreview.fileName;
    anchor.click();
  };
  const exportBookings = async () => {
    try { const response=await linkupPlatformApi.exportBookings();const url=URL.createObjectURL(response.data);const anchor=document.createElement('a');anchor.href=url;anchor.download=`linkup-bookings-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();URL.revokeObjectURL(url); }
    catch { toast.error('Could not export bookings'); }
  };

  const stats = [
    ['Total Events',overview.totalEvents],['Upcoming Events',overview.upcomingEvents],['Active Packages',overview.activePackages],['Total Bookings',overview.totalBookings],
    ['Confirmed',overview.confirmedBookings],['Pending Verification',overview.pendingVerifications],['Verified Revenue',overview.verifiedRevenue],['Available Slots',overview.availablePerformanceSlots],
  ];

  return <div className="min-h-full bg-slate-50/70 p-4 md:p-6 lg:p-8">
    <div className="max-w-[1600px] mx-auto space-y-6">
    <section className="relative overflow-hidden rounded-3xl border border-violet-200/50 bg-gradient-to-br from-[#16112b] via-[#23134a] to-[#4c1d95] px-5 py-6 text-white shadow-[0_22px_55px_-30px_rgba(76,29,149,.75)] md:px-8 md:py-8">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="absolute bottom-0 right-1/3 h-32 w-48 rounded-full bg-violet-300/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 p-2 shadow-xl backdrop-blur"><img src="/logo-160.png" alt="HoodBoy Entertainment" className="h-full w-full object-contain" /></div>
          <div><p className="mb-1 text-[11px] font-bold uppercase tracking-[.24em] text-violet-200">HoodBoy Entertainment</p><h1 className="text-3xl font-black tracking-tight md:text-4xl">The Lnk Up</h1><p className="mt-2 max-w-xl text-sm text-violet-100/80 md:text-base">Control events, inventory, packages and customer bookings from one workspace.</p></div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link to="/linkup" target="_blank" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white px-5 py-2.5 text-sm font-bold text-violet-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50"><ExternalLink size={16}/> View public page <ArrowUpRight size={15}/></Link>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between px-2 pt-1"><div><h2 className="text-sm font-extrabold text-slate-900">Management tools</h2><p className="text-xs text-slate-500">All sections are always available below.</p></div><span className="hidden rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700 sm:inline">{availableSections.length} sections</span></div>
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6" aria-label="Lnk Up management sections">{availableSections.map(item => <button key={item.key} onClick={()=>switchSection(item.key)} aria-current={active===item.key?'page':undefined} className={`group flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-all duration-300 ease-out active:scale-[.98] ${active===item.key?'border-violet-600 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-200':'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50/60 hover:text-violet-800 hover:shadow-sm'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors duration-300 ${active===item.key?'bg-white/15':'bg-slate-100 text-slate-500 group-hover:bg-violet-100 group-hover:text-violet-700'}`}>{item.icon}</span><span className="leading-tight">{item.label}</span></button>)}</nav>
    </section>
    <section key={`${active}-${loading?'loading':'ready'}`} className={loading?'linkup-section-loading':'linkup-section-enter'} aria-live="polite" aria-busy={loading}>
    {loading ? <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50"><RefreshCw className="animate-spin text-violet-600"/></span><p className="mt-3 text-sm font-semibold text-slate-600">Loading {section.label.toLowerCase()}…</p><p className="mt-1 text-xs text-slate-400">Preparing the latest information</p></div> : active==='overview' ? <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(([label,value],index)=><div key={String(label)} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/60"><div className="flex items-center justify-between"><div className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</div><span className={`h-2.5 w-2.5 rounded-full ${index===5?'bg-amber-400':index===6?'bg-emerald-400':'bg-violet-400'}`} /></div><div className="mt-3 text-3xl font-black tracking-tight text-slate-900">{label==='Verified Revenue'?`$${Number(value||0).toLocaleString()}`:Number(value||0).toLocaleString()}</div></div>)}</div>
      <div className="flex flex-col justify-between gap-5 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-6 md:flex-row md:items-center"><div><h2 className="text-xl font-extrabold text-slate-900">Build your next event</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Create the event first, then configure seating, vendors and menu options. Build packages last so every offer connects to live inventory and accepted bank accounts.</p></div><button onClick={()=>switchSection('events')} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-200 transition hover:bg-violet-700"><Plus size={16}/> Create an event</button></div>
    </> : active==='settings' ? <EmailSettingsPanel/> : active==='check-in' ? <LinkupCheckInPanel/> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/60 p-5 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><span className="text-violet-700">{section.icon}</span><h2 className="text-lg font-extrabold text-slate-900">{section.label}</h2></div><p className="mt-1 text-xs font-medium text-slate-500">{visibleRecords.length} {visibleRecords.length===1?'record':'records'} available</p></div><div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto"><label className="relative min-w-0 sm:min-w-64"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${section.label.toLowerCase()}…`} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"/></label>{active==='bookings'&&<button onClick={exportBookings} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-violet-300 hover:text-violet-700"><Download size={16}/> Export CSV</button>}{!section.readOnly&&<button onClick={()=>openForm()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 text-sm font-bold text-white shadow-md shadow-violet-200 transition hover:-translate-y-0.5 hover:shadow-lg"><Plus size={16}/> Add {section.label.replace(/s$/, '')}</button>}</div></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr>{section.columns?.map(column=><th key={column} className="px-5 py-4 text-left">{['banner','logo','image'].includes(column)?'Image':column.replace(/([A-Z])/g,' $1')}</th>)}<th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{paginatedRecords.map(record=><tr key={record._id} className="transition hover:bg-violet-50/30">{section.columns?.map(column=><td key={column} className="max-w-[260px] truncate whitespace-nowrap px-5 py-4 font-medium text-slate-700">{['banner','logo','image'].includes(column)?(record[column]?<img src={record[column]} alt="" className="h-12 w-16 rounded-xl border border-slate-200 object-cover shadow-sm"/>:<span className="grid h-12 w-16 place-items-center rounded-xl bg-slate-100 text-slate-400"><ImagePlus size={18}/></span>):column.toLowerCase().includes('amount')||column.toLowerCase().includes('price')?`${record.currency||'$'} ${Number(record[column]||0).toFixed(2)}`:show(record[column])}</td>)}<td className="px-5 py-3"><div className="flex flex-wrap justify-end gap-2">{active==='transfers'&&<><button disabled={previewingReceiptId===record._id} onClick={()=>void previewReceipt(record)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 disabled:cursor-wait disabled:opacity-60">{previewingReceiptId===record._id?<Loader2 size={14} className="animate-spin"/>:<Eye size={14}/>} Preview</button><button aria-label="Download receipt" title="Download receipt" onClick={()=>void downloadReceipt(record)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-violet-200 hover:text-violet-700"><Download size={14}/></button></>}{active==='transfers'&&record.verificationStatus==='awaiting_verification'&&<><button onClick={()=>requestVerification(record,'approve')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><Check size={14}/> Approve</button><button onClick={()=>requestVerification(record,'reject')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><X size={14}/> Reject</button><button onClick={()=>requestVerification(record,'request_information')} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Request info</button></>}{active==='bookings'&&!['cancelled','completed','expired'].includes(record.bookingStatus)&&<button onClick={()=>setSensitiveAction({kind:'booking',record,action:'cancel'})} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Cancel booking</button>}{(!section.readOnly||(user?.role==='admin'&&['bookings','transfers'].includes(active)))&&<>{!section.readOnly&&<button onClick={()=>openForm(record)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Pencil size={14}/> Edit</button>}<button onClick={()=>setDeleteId(record._id)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"><Trash2 size={14}/> Delete</button></>}</div></td></tr>)}</tbody></table>{!visibleRecords.length&&<div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-700">{section.icon}</div><h3 className="text-base font-extrabold text-slate-900">No {section.label.toLowerCase()} yet</h3><p className="mt-1 max-w-sm text-sm text-slate-500">{search?'No records match your current search. Try another keyword.':'Create your first record to start managing this section.'}</p>{!section.readOnly&&!search&&<button onClick={()=>openForm()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-200"><Plus size={16}/> Add {section.label.replace(/s$/, '')}</button>}</div>}</div>
      {visibleRecords.length>PAGE_SIZE&&<div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-semibold text-slate-500">Showing <span className="text-slate-800">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,visibleRecords.length)}</span> of <span className="text-slate-800">{visibleRecords.length}</span> records</p><div className="flex items-center gap-2"><button type="button" disabled={page===1} onClick={()=>setPage(current=>Math.max(1,current-1))} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16}/> Previous</button><span className="min-w-24 text-center text-xs font-bold text-slate-500">Page {page} of {totalPages}</span><button type="button" disabled={page===totalPages} onClick={()=>setPage(current=>Math.min(totalPages,current+1))} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={16}/></button></div></div>}
    </div>}
    </section>

    {formError&&formOpen&&<div role="alert" className="fixed left-1/2 top-5 z-[60] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700 shadow-xl">{formError}</div>}
    {formOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-600">The Lnk Up</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{editing?'Edit':'Add'} {section.label}</h2>{!editing&&<p className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${isOnline?'text-emerald-600':'text-amber-600'}`}>{isOnline?<Cloud size={14}/>:<WifiOff size={14}/>} {isOnline?'Autosaved on this device':'Offline · changes are still saved locally'}</p>}</div>
          <button onClick={()=>{setFormOpen(false);setEditing(null);setFormError('')}} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"><X size={19}/></button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">{section.fields?.map(field=><div key={field.key} className={`${['textarea','json','image','package-items'].includes(field.type||'')?'md:col-span-2':''} text-sm font-bold text-slate-700`}>
          {field.type==='checkbox'?<label className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><input type="checkbox" checked={!!form[field.key]} onChange={e=>setForm({...form,[field.key]:e.target.checked})} className="h-4 w-4 accent-violet-600"/>{field.label}</label>:<>
            <span>{field.label}{field.required&&<span className="text-red-500"> *</span>}</span>
            {field.type==='image'?<label className="relative mt-1.5 block min-h-40 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-violet-200 bg-gradient-to-br from-violet-50 to-slate-50 transition hover:border-violet-400">{form[field.key]?<><img src={form[field.key]} alt={`${field.label} preview`} className="h-52 w-full object-cover"/><span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/90 to-transparent px-4 pb-3 pt-10 text-white"><span className="inline-flex items-center gap-2 text-xs font-bold"><ImagePlus size={16}/> Click to replace image</span><button type="button" onClick={event=>{event.preventDefault();event.stopPropagation();setForm({...form,[field.key]:''})}} className="rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-bold hover:bg-red-500">Remove</button></span></>:<span className="flex min-h-40 flex-col items-center justify-center px-5 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700">{uploadingImage===field.key?<Loader2 className="animate-spin" size={22}/>:<ImagePlus size={22}/>}</span><span className="mt-3 text-sm font-extrabold text-slate-800">{uploadingImage===field.key?'Uploading image…':'Choose an image'}</span><span className="mt-1 text-xs font-medium text-slate-500">JPG, PNG or WEBP · Maximum 5 MB</span>{field.help&&<span className="mt-1 text-[11px] text-slate-400">{field.help}</span>}</span>}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!uploadingImage} onChange={event=>{void uploadFormImage(field,event.target.files?.[0]);event.target.value=''}}/></label>
            :field.type==='package-items'?<PackageItemsEditor items={form[field.key]||[]} food={relations.food||[]} alcohol={relations.alcohol||[]} eventId={String(form.event||'')} currency={form.currency||'USD'} help={field.help} onChange={items=>setForm(current=>({...current,[field.key]:items}))}/>
            :field.type==='select'?<select required={field.required} value={form[field.key]||''} onChange={e=>setForm({...form,[field.key]:e.target.value})} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"><option value="">Select…</option>{field.options?.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
            :field.type==='relation'?<select required={field.required} multiple={field.multiple} value={form[field.key]||(field.multiple?[]:'')} onChange={e=>{const value=field.multiple?Array.from(e.target.selectedOptions).map(o=>o.value).filter(Boolean):e.target.value;setForm(current=>({...current,[field.key]:value,...(field.key==='event'?{seating:'',includedItems:[],optionalItems:[]}: {})}))}} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-violet-500">{!field.multiple&&<option value="">Select…</option>}{(relations[field.resource||'']||[]).filter(item=>field.resource!=='seating'||!form.event||String(item.event?._id||item.event)===String(form.event)).map(item=><option key={item._id} value={item._id}>{item.title||item.name||item.bankName}</option>)}</select>
            :field.type==='textarea'||field.type==='json'?<textarea required={field.required} rows={field.type==='json'?5:3} value={form[field.key]||''} onChange={e=>setForm({...form,[field.key]:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100" placeholder={field.help}/>
            :<input required={field.required} type={field.type||'text'} step={field.type==='number'?(field.integer?'1':'0.01'):undefined} inputMode={field.integer?'numeric':undefined} value={form[field.key]??''} onWheel={event=>field.type==='number'&&event.currentTarget.blur()} onChange={e=>setForm({...form,[field.key]:e.target.value})} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/>}
          </>}
        </div>)}</div>
        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-xs font-semibold text-slate-500">{!editing&&draftSavedAt&&<span className="inline-flex items-center gap-1.5"><Cloud size={14} className={isOnline?'text-emerald-500':'text-amber-500'}/> Draft saved locally at {new Date(draftSavedAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>}</div>
          <div className="flex flex-wrap justify-end gap-3">{!editing&&draftSavedAt&&<button type="button" onClick={()=>{clearDraft();setFormOpen(false);setForm({});setFormError('')}} className="h-11 rounded-xl px-3 text-sm font-bold text-red-600 transition hover:bg-red-50">Discard draft</button>}<button onClick={()=>{setFormOpen(false);setEditing(null);setFormError('')}} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Close</button><button disabled={!!uploadingImage||(!isOnline&&!editing)} onClick={save} className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 text-sm font-bold text-white shadow-md shadow-violet-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">{uploadingImage?'Uploading…':!isOnline&&!editing?'Offline · draft saved':editing?'Save changes':`Create ${section.label.replace(/s$/, '')}`}</button></div>
        </div>
      </div>
    </div>}
    {receiptPreview&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event=>{if(event.target===event.currentTarget)setReceiptPreview(null)}}>
      <div role="dialog" aria-modal="true" aria-labelledby="receipt-preview-title" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl shadow-slate-950/40">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><FileText size={19}/></span><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">Secure payment proof</p><h2 id="receipt-preview-title" className="truncate text-base font-black text-slate-900 sm:text-lg">{receiptPreview.fileName}</h2></div></div>
          <button type="button" aria-label="Close receipt preview" onClick={()=>setReceiptPreview(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"><X size={19}/></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
          {receiptPreview.mimeType.startsWith('image/')?<div className="flex min-h-[55vh] items-center justify-center"><img src={receiptPreview.url} alt="Uploaded payment receipt" className="max-h-[72vh] max-w-full rounded-xl bg-white object-contain shadow-lg"/></div>:receiptPreview.mimeType==='application/pdf'?<iframe src={receiptPreview.url} title="Payment receipt PDF" className="h-[72vh] min-h-[480px] w-full rounded-xl border border-slate-300 bg-white"/>:<div className="flex min-h-[55vh] flex-col items-center justify-center text-center"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-violet-600 shadow"><FileText size={28}/></span><h3 className="mt-4 text-lg font-black text-slate-900">Preview unavailable for this file type</h3><p className="mt-2 max-w-sm text-sm text-slate-500">Download the receipt to review it with the appropriate application.</p></div>}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={()=>setReceiptPreview(null)} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Close</button><button type="button" onClick={downloadPreview} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-200 hover:bg-violet-700"><Download size={16}/> Download receipt</button></div>
      </div>
    </div>}
    {reasonAction&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={event=>{if(event.target===event.currentTarget){setReasonAction(null);setReasonError('')}}}>
      <div role="dialog" aria-modal="true" aria-labelledby="payment-review-title" className="anim-rise w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl shadow-slate-950/30">
        <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 py-5">
          <div className="flex items-start gap-3.5">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${reasonAction.action==='reject'?'bg-red-50 text-red-600':'bg-amber-50 text-amber-600'}`}><MessageSquareText size={20}/></span>
            <div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-violet-600">Payment review</p><h2 id="payment-review-title" className="mt-1 text-xl font-black tracking-tight text-slate-900">{reasonAction.action==='reject'?'Add rejection reason':'Request more information'}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{reasonAction.action==='reject'?'Explain clearly why this payment receipt cannot be accepted.':'Tell the customer exactly what information or document is required.'}</p></div>
          </div>
          <button type="button" aria-label="Close" onClick={()=>{setReasonAction(null);setReasonError('')}} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"><X size={18}/></button>
        </div>
        <div className="px-6 py-5">
          <label htmlFor="payment-review-reason" className="text-sm font-extrabold text-slate-800">{reasonAction.action==='reject'?'Rejection reason':'Information required'} <span className="text-red-500">*</span></label>
          <textarea id="payment-review-reason" autoFocus rows={5} maxLength={500} value={reviewReason} onChange={event=>{setReviewReason(event.target.value);if(reasonError)setReasonError('')}} placeholder={reasonAction.action==='reject'?'Example: The transferred amount does not match the booking total.':'Example: Please upload a clearer receipt showing the transaction reference and payment date.'} className={`mt-2 w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 ${reasonError?'border-red-400 ring-4 ring-red-50':'border-slate-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-100'}`}/>
          <div className="mt-2 flex min-h-5 items-start justify-between gap-4"><p className={`text-xs font-semibold ${reasonError?'text-red-600':'text-slate-400'}`}>{reasonError||'This message will be saved with the payment review.'}</p><span className="shrink-0 text-xs font-semibold text-slate-400">{reviewReason.length}/500</span></div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={()=>{setReasonAction(null);setReasonError('')}} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={continueReasonAction} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 ${reasonAction.action==='reject'?'bg-red-600 shadow-red-200 hover:bg-red-700':'bg-amber-500 shadow-amber-200 hover:bg-amber-600'}`}><MessageSquareText size={16}/>{reasonAction.action==='reject'?'Continue to reject':'Continue request'}</button>
        </div>
      </div>
    </div>}
    <ConfirmDialog
      isOpen={!!sensitiveAction}
      title={sensitiveAction?.action==='approve'?'Approve payment?':sensitiveAction?.action==='reject'?'Reject payment?':sensitiveAction?.action==='request_information'?'Request more information?':'Cancel booking?'}
      message={sensitiveAction?.action==='approve'?'Are you sure you want to approve this payment receipt? The booking will be confirmed.':sensitiveAction?.action==='reject'?'Are you sure you want to reject this payment receipt? The customer will need to submit another receipt.':sensitiveAction?.action==='request_information'?'Are you sure you want to request additional payment information from this customer?':'Are you sure you want to cancel this booking and release its reserved inventory?'}
      confirmLabel={sensitiveAction?.action==='approve'?'Yes, approve':sensitiveAction?.action==='reject'?'Yes, reject':sensitiveAction?.action==='request_information'?'Request information':'Cancel booking'}
      variant={sensitiveAction?.action==='approve'?'info':sensitiveAction?.action==='request_information'?'warning':'danger'}
      onCancel={()=>setSensitiveAction(null)}
      onConfirm={confirmSensitiveAction}
    />
    <ConfirmDialog isOpen={!!deleteId} title={`Delete ${active==='bookings'?'booking':active==='transfers'?'payment record':'record'}?`} message={active==='bookings'?'This permanently removes the booking, its payment receipt and verification record, then returns reserved inventory. Use this only for test or incorrect data.':active==='transfers'?'This permanently removes the payment receipt and verification record. The linked booking will return to awaiting payment when no other receipt exists.':'Are you sure you want to delete this record? This action cannot be undone. Historical bank accounts cannot be removed.'} confirmLabel="Delete permanently" variant="danger" onCancel={()=>setDeleteId(null)} onConfirm={async()=>{if(!deleteId)return;try{await linkupPlatformApi.delete(active,deleteId);toast.success('Deleted permanently');setDeleteId(null);load();}catch(error:any){toast.error(error.response?.data?.message||'Delete failed')}}}/>
    </div>
  </div>;
};

export default LinkupPlatform;
