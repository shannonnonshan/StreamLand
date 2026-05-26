"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import toast, { Toaster } from 'react-hot-toast';
import { useConfirm } from "@/hooks/useConfirm";
import ConfirmDialog from "@/component/ConfirmDialog";
import { raleway } from "@/utils/front";
import {
  Shield, Mail, MapPin, User, Eye, EyeOff, Save, Key,
  CheckCircle, ArrowLeft, Camera, Upload, FileText,
  Download, Trash2, Globe, Linkedin,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const LOCATIONS: { group: string; items: string[] }[] = [
  { group: "🇻🇳 Vietnam", items: ["Hanoi, Vietnam","Ho Chi Minh City, Vietnam","Da Nang, Vietnam","Haiphong, Vietnam","Hue, Vietnam","Can Tho, Vietnam","Tuyen Quang, Vietnam","Lao Cai, Vietnam","Thai Nguyen, Vietnam","Phu Tho, Vietnam","Son La, Vietnam","Quang Ninh, Vietnam","Bac Ninh, Vietnam","Ninh Binh, Vietnam","Thanh Hoa, Vietnam","Nghe An, Vietnam","Quang Tri, Vietnam","Quang Nam, Vietnam","Binh Dinh, Vietnam","Khanh Hoa, Vietnam","Gia Lai, Vietnam","Lam Dong, Vietnam","Tay Ninh, Vietnam","Dong Nai, Vietnam","Binh Duong, Vietnam","Long An, Vietnam","Ben Tre, Vietnam","Dong Thap, Vietnam","Kien Giang, Vietnam","Ca Mau, Vietnam","Cao Bang, Vietnam"] },
  { group: "🌏 Asia Pacific", items: ["Tokyo, Japan","Osaka, Japan","Seoul, South Korea","Beijing, China","Shanghai, China","Shenzhen, China","Singapore","Bangkok, Thailand","Kuala Lumpur, Malaysia","Jakarta, Indonesia","Manila, Philippines","Mumbai, India","Delhi, India","Bangalore, India","Sydney, Australia","Melbourne, Australia","Auckland, New Zealand","Taipei, Taiwan","Hong Kong"] },
  { group: "🌍 Europe", items: ["London, United Kingdom","Paris, France","Berlin, Germany","Amsterdam, Netherlands","Madrid, Spain","Barcelona, Spain","Rome, Italy","Milan, Italy","Zurich, Switzerland","Vienna, Austria","Stockholm, Sweden","Copenhagen, Denmark","Oslo, Norway","Helsinki, Finland","Brussels, Belgium","Lisbon, Portugal","Warsaw, Poland","Prague, Czech Republic","Budapest, Hungary","Dublin, Ireland"] },
  { group: "🌎 Americas", items: ["New York, USA","Los Angeles, USA","San Francisco, USA","Chicago, USA","Seattle, USA","Boston, USA","Austin, USA","Miami, USA","Toronto, Canada","Vancouver, Canada","Montreal, Canada","Mexico City, Mexico","São Paulo, Brazil","Buenos Aires, Argentina"] },
  { group: "🌐 Middle East & Africa", items: ["Dubai, UAE","Abu Dhabi, UAE","Riyadh, Saudi Arabia","Tel Aviv, Israel","Cairo, Egypt","Nairobi, Kenya","Lagos, Nigeria","Cape Town, South Africa","Johannesburg, South Africa"] },
];

const TABS = [
  { key: "avatar",   label: "Avatar",   icon: Camera },
  { key: "security", label: "Security", icon: Shield },
  { key: "personal", label: "Profile",  icon: User   },
] as const;
type TabKey = typeof TABS[number]["key"];

// Tab pill colors — mirrors Documents: active=sky, others get their own tint
const TAB_STYLE: Record<TabKey, string> = {
  avatar:   "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
  security: "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  personal: "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
};
// Card header accent
const CARD: Record<TabKey, { header: string; label: string; icon: string }> = {
  avatar:   { header: "bg-sky-50 border-sky-200",     label: "text-sky-600",     icon: "bg-sky-600"     },
  security: { header: "bg-amber-50 border-amber-200",   label: "text-amber-600",   icon: "bg-amber-600"   },
  personal: { header: "bg-emerald-50 border-emerald-200", label: "text-emerald-600", icon: "bg-emerald-600" },
};

export default function SettingsPage() {
  const params    = useParams();
  const router    = useRouter();
  const { getProfile } = useAuth();
  const teacherId = params?.id as string;
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const [tab, setTab]       = useState<TabKey>("avatar");
  const [settings, setSettings] = useState({
    email: "", fullName: "", bio: "", location: "", education: "",
    experience: 0, website: "", linkedin: "", twoFactorEnabled: false,
    avatar: "", cvUrl: "", subjects: [] as string[],
  });
  const [avatarPreview,       setAvatarPreview]       = useState("");
  const [uploadingAvatar,     setUploadingAvatar]     = useState(false);
  const [showAvatarPreview,   setShowAvatarPreview]   = useState(false);
  const [selectedAvatarFile,  setSelectedAvatarFile]  = useState<File | null>(null);
  const [previewUrl,          setPreviewUrl]          = useState("");
  const [showCVPreview,       setShowCVPreview]       = useState(false);
  const [pendingCVFile,       setPendingCVFile]       = useState<File | null>(null);
  const [pendingCVPreviewUrl, setPendingCVPreviewUrl] = useState("");
  const [loading,             setLoading]             = useState(true);
  const [saving,              setSaving]              = useState(false);
  const [passwordForm,  setPasswordForm]  = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const res = await fetch(`${API_URL}/teacher/${teacherId}/profile`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const d = await res.json();
          setSettings({ email:d.email||'', fullName:d.fullName||'', bio:d.bio||'', location:d.location||'', education:d.teacherProfile?.education||'', experience:d.teacherProfile?.experience||0, website:d.teacherProfile?.website||'', linkedin:d.teacherProfile?.linkedin||'', twoFactorEnabled:d.twoFactorEnabled||false, avatar:d.avatar||'', cvUrl:d.teacherProfile?.cvUrl||'', subjects:d.teacherProfile?.subjects||[] });
          if (d.avatar) setAvatarPreview(d.avatar);
        }
      } catch(e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [teacherId]);
  useEffect(() => () => { if (pendingCVPreviewUrl) URL.revokeObjectURL(pendingCVPreviewUrl); }, [pendingCVPreviewUrl]);

  const tk = (bg: string) => ({ style: { background:bg, color:'#fff', borderRadius:'10px', padding:'11px 15px', fontWeight:'600', fontSize:'13px' } });

  const handleSaveSettings = async () => {
    if (saving) return; setSaving(true);
    const tid = toast.loading('Saving…', { position:'top-right', ...tk('#059669') });
    try {
      const token = localStorage.getItem('token')||localStorage.getItem('accessToken');
      let tRes;
      if (pendingCVFile) {
        const fd = new FormData(); fd.append('cv',pendingCVFile); fd.append('education',settings.education); fd.append('experience',String(settings.experience)); fd.append('website',settings.website); fd.append('linkedin',settings.linkedin);
        tRes = await fetch(`${API_URL}/auth/profile/teacher`,{ method:'PATCH', headers:{Authorization:`Bearer ${token}`}, body:fd });
      } else {
        tRes = await fetch(`${API_URL}/auth/profile/teacher`,{ method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({education:settings.education,experience:settings.experience,website:settings.website,linkedin:settings.linkedin}) });
      }
      const uRes = await fetch(`${API_URL}/auth/profile`,{ method:'PATCH', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({fullName:settings.fullName,bio:settings.bio,location:settings.location}) });
      if (uRes.ok && tRes.ok) {
        if (pendingCVFile) { const d=await tRes.json(); setSettings(p=>({...p,cvUrl:d.teacherProfile?.cvUrl||p.cvUrl})); setPendingCVFile(null); if(pendingCVPreviewUrl){URL.revokeObjectURL(pendingCVPreviewUrl);setPendingCVPreviewUrl('');} }
        await getProfile(); toast.dismiss(tid); toast.success('Saved!',{duration:2500,position:'top-right',icon:'✓',...tk('#059669')});
      } else { toast.dismiss(tid); toast.error('Failed to save',{duration:3000,position:'top-right',...tk('#DC2626')}); }
    } catch { toast.dismiss(tid); toast.error('Error saving',{duration:3000,position:'top-right',...tk('#DC2626')}); }
    finally { setSaving(false); }
  };
  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match',{duration:3000,position:'top-right',...tk('#DC2626')}); return; }
    const tid = toast.loading('Changing…',{position:'top-right',...tk('#059669')});
    try {
      const token = localStorage.getItem('token')||localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/teacher/${teacherId}/change-password`,{ method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body:JSON.stringify({currentPassword:passwordForm.currentPassword,newPassword:passwordForm.newPassword}) });
      toast.dismiss(tid);
      if (res.ok) { toast.success('Password changed!',{duration:2500,position:'top-right',icon:'✓',...tk('#059669')}); setPasswordForm({currentPassword:'',newPassword:'',confirmPassword:''}); }
      else toast.error('Failed',{duration:3000,position:'top-right',...tk('#DC2626')});
    } catch { toast.dismiss(tid); toast.error('Error',{duration:3000,position:'top-right',...tk('#DC2626')}); }
  };
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Image files only',{position:'top-right',...tk('#DC2626')}); return; }
    if (file.size > 5*1024*1024) { toast.error('Max 5MB',{position:'top-right',...tk('#DC2626')}); return; }
    const r = new FileReader(); r.onloadend = () => { setPreviewUrl(r.result as string); setSelectedAvatarFile(file); setShowAvatarPreview(true); }; r.readAsDataURL(file);
  };
  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true); const tid = toast.loading('Uploading…',{position:'top-right',...tk('#0284C7')});
    try {
      const token = localStorage.getItem('token')||localStorage.getItem('accessToken');
      const fd = new FormData(); fd.append('avatar',file);
      const res = await fetch(`${API_URL}/auth/profile`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`},body:fd});
      toast.dismiss(tid);
      if (res.ok) { toast.success('Avatar updated!',{duration:2500,position:'top-right',icon:'✓',...tk('#0284C7')}); await getProfile(); }
      else toast.error('Failed',{duration:3000,position:'top-right',...tk('#DC2626')});
    } catch { toast.dismiss(tid); toast.error('Error',{duration:3000,position:'top-right',...tk('#DC2626')}); }
    finally { setUploadingAvatar(false); }
  };
  const handleToggle2FA = async () => {
    const nv = !settings.twoFactorEnabled; const tid = toast.loading(`${nv?'Enabling':'Disabling'} 2FA…`,{position:'top-right',...tk('#D97706')});
    try {
      const token = localStorage.getItem('token')||localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/auth/${teacherId}/2fa`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({twoFactorEnabled:nv})});
      toast.dismiss(tid);
      if (res.ok) { setSettings(p=>({...p,twoFactorEnabled:nv})); toast.success(`2FA ${nv?'enabled':'disabled'}`,{duration:2500,position:'top-right',icon:'✓',...tk('#D97706')}); }
      else toast.error('Failed',{duration:3000,position:'top-right',...tk('#DC2626')});
    } catch { toast.dismiss(tid); toast.error('Error',{duration:3000,position:'top-right',...tk('#DC2626')}); }
  };
  const handleCVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.includes('pdf')&&!file.name.endsWith('.pdf')) { toast.error('PDF only',{position:'top-right',...tk('#DC2626')}); return; }
    if (file.size > 10*1024*1024) { toast.error('Max 10MB',{position:'top-right',...tk('#DC2626')}); return; }
    setPendingCVFile(file); setPendingCVPreviewUrl(URL.createObjectURL(file));
    toast.success('CV selected — save to upload',{duration:2500,position:'top-right',icon:'📎',...tk('#059669')});
  };
  const handleDeleteCV = async () => {
    if (pendingCVFile) { confirm('Remove CV?','Remove the selected file?',()=>{ setPendingCVFile(null); if(pendingCVPreviewUrl){URL.revokeObjectURL(pendingCVPreviewUrl);setPendingCVPreviewUrl('');} const fi=document.getElementById('cv-input') as HTMLInputElement; if(fi)fi.value=''; toast.success('Removed',{duration:2000,position:'top-right',...tk('#059669')}); }); return; }
    confirm('Delete CV?','This cannot be undone.',async()=>{
      const tid=toast.loading('Deleting…',{position:'top-right',...tk('#DC2626')});
      try { const token=localStorage.getItem('token')||localStorage.getItem('accessToken'); const res=await fetch(`${API_URL}/auth/profile/teacher`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({cvUrl:null})}); toast.dismiss(tid); if(res.ok){setSettings(p=>({...p,cvUrl:''}));toast.success('CV deleted',{duration:2000,position:'top-right',...tk('#059669')});}else toast.error('Failed',{duration:3000,position:'top-right',...tk('#DC2626')});
      } catch { toast.dismiss(tid); toast.error('Error',{duration:3000,position:'top-right',...tk('#DC2626')}); }
    },{type:'danger',confirmText:'Delete',cancelText:'Cancel'});
  };

  if (loading) return (
    <div className={`${raleway.className} flex min-h-screen items-center justify-center bg-slate-50`}>
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-sky-600 border-t-transparent"/>
    </div>
  );

  // Shared input / label styles — matches Documents' clean aesthetic
  const inp = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 placeholder:text-slate-400";
  const lbl = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500";

  // Section card shell
  const Card = ({ tab: t, title, subtitle, children }: { tab: TabKey; title: string; subtitle: string; children: React.ReactNode }) => (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex items-center gap-3 border-b border-slate-200 ${CARD[t].header} px-6 py-4`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${CARD[t].icon}`}>
          {t === "avatar"   && <Camera size={16} className="text-white"/>}
          {t === "security" && <Shield size={16} className="text-white"/>}
          {t === "personal" && <User   size={16} className="text-white"/>}
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${CARD[t].label}`}>{subtitle}</p>
          <p className="text-sm font-bold text-slate-800">{title}</p>
        </div>
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );

  return (
    <div className={`${raleway.className} flex h-full flex-col bg-slate-50 px-4 pb-6 pt-5`}>
      <Toaster/>
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} type={confirmState.type} confirmText={confirmState.confirmText} cancelText={confirmState.cancelText} onConfirm={handleConfirm} onCancel={handleCancel}/>

      <div className="mx-auto w-full max-w-7xl">

        {/* ── Header card — identical structure to Documents ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <button onClick={() => router.back()} className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-slate-700">
                <ArrowLeft size={13}/> Back
              </button>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Teacher workspace</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
              <p className="mt-1 text-sm text-slate-500">Manage your profile, security, and documents.</p>
            </div>
          </div>

          {/* Tab pills — same look as Documents tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-0.5">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  tab === key ? "bg-sky-600 text-white shadow-sm" : TAB_STYLE[key]
                }`}>
                <Icon size={13}/>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="mt-5">

          {/* AVATAR */}
          {tab === "avatar" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card tab="avatar" title="Your Avatar" subtitle="Profile Picture">
                <div className="flex flex-col items-center gap-5">
                  <div className="relative">
                    <div className="h-28 w-28 overflow-hidden rounded-2xl border-2 border-sky-100 bg-sky-50 shadow">
                      {avatarPreview||settings.avatar
                        ? <Image src={avatarPreview||settings.avatar} alt="Avatar" width={112} height={112} className="h-full w-full object-cover"/>
                        : <div className="flex h-full w-full items-center justify-center"><User size={40} className="text-sky-200"/></div>}
                    </div>
                    <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md transition hover:bg-sky-700">
                      <Upload size={14}/>
                      <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" disabled={uploadingAvatar}/>
                    </label>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-900">{settings.fullName||'Your Name'}</p>
                    <p className="text-sm text-slate-500">{settings.email}</p>
                    <p className="mt-1.5 text-xs text-slate-400">JPG or PNG · Max 5 MB</p>
                  </div>
                  {uploadingAvatar && <p className="flex items-center gap-2 text-xs text-sky-600"><span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"/>Uploading…</p>}
                </div>
              </Card>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="mb-3 text-sm font-bold text-slate-800">Tips for a great avatar</p>
                <ul className="space-y-2.5 text-xs text-slate-500">
                  {["Use a clear, well-lit photo of your face","Square images work best (1:1 ratio)","Minimum 200×200 px recommended","Personal photos build trust with students"].map(t => (
                    <li key={t} className="flex items-start gap-2"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"/>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* SECURITY */}
          {tab === "security" && (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Change password card */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className={`flex items-center gap-3 border-b border-slate-200 ${CARD.security.header} px-6 py-4`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${CARD.security.icon}`}><Key size={16} className="text-white"/></div>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${CARD.security.label}`}>Password</p>
                    <p className="text-sm font-bold text-slate-800">Change Password</p>
                  </div>
                </div>
                <div className="space-y-4 px-6 py-6">
                  {(["current","new","confirm"] as const).map(f => (
                    <div key={f}>
                      <label className={lbl}>{f==="current"?"Current Password":f==="new"?"New Password":"Confirm Password"}</label>
                      <div className="relative">
                        <input type={showPasswords[f]?"text":"password"} value={passwordForm[`${f}Password` as keyof typeof passwordForm]} onChange={e=>setPasswordForm(p=>({...p,[`${f}Password`]:e.target.value}))} className={inp+" pr-10"} placeholder="••••••••"/>
                        <button type="button" onClick={()=>setShowPasswords(p=>({...p,[f]:!p[f]}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                          {showPasswords[f]?<EyeOff size={16}/>:<Eye size={16}/>}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={handleChangePassword} className="w-full rounded-2xl bg-amber-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 active:scale-95">
                    Update Password
                  </button>
                </div>
              </div>

              {/* 2FA card */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className={`flex items-center gap-3 border-b border-slate-200 ${CARD.security.header} px-6 py-4`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${CARD.security.icon}`}><Shield size={16} className="text-white"/></div>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${CARD.security.label}`}>Authentication</p>
                    <p className="text-sm font-bold text-slate-800">Two-Factor Auth</p>
                  </div>
                </div>
                <div className="px-6 py-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">Enable 2FA</p>
                      <p className="mt-0.5 text-xs text-slate-500">Require a second step on every sign-in</p>
                    </div>
                    <button onClick={handleToggle2FA}
                      className={`relative inline-flex h-7 items-center rounded-full transition-colors ${settings.twoFactorEnabled?"bg-amber-500":"bg-slate-200"}`}
                      style={{width:52}}>
                      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.twoFactorEnabled?"translate-x-7":"translate-x-1"}`}/>
                    </button>
                  </div>
                  {settings.twoFactorEnabled && (
                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <CheckCircle size={15} className="shrink-0 text-emerald-600"/>
                      <p className="text-xs font-semibold text-emerald-800">2FA active — account is protected</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PROFILE */}
          {tab === "personal" && (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Left — basic info */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className={`flex items-center gap-3 border-b border-slate-200 ${CARD.personal.header} px-6 py-4`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${CARD.personal.icon}`}><User size={16} className="text-white"/></div>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${CARD.personal.label}`}>Info</p>
                    <p className="text-sm font-bold text-slate-800">Basic Details</p>
                  </div>
                </div>
                <div className="space-y-4 px-6 py-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Full Name</label>
                      <div className="relative"><User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="text" value={settings.fullName} onChange={e=>setSettings(p=>({...p,fullName:e.target.value}))} className={inp+" pl-9"}/></div>
                    </div>
                    <div>
                      <label className={lbl}>Email</label>
                      <div className="relative"><Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="email" value={settings.email} onChange={e=>setSettings(p=>({...p,email:e.target.value}))} className={inp+" pl-9"}/></div>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Location</label>
                    <div className="relative"><MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <select value={settings.location} onChange={e=>setSettings(p=>({...p,location:e.target.value}))} className={inp+" pl-9 appearance-none cursor-pointer"}>
                        <option value="">Select a location…</option>
                        {LOCATIONS.map(({group,items})=>(
                          <optgroup key={group} label={group}>{items.map(l=><option key={l} value={l}>{l}</option>)}</optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Bio</label>
                    <textarea value={settings.bio} onChange={e=>setSettings(p=>({...p,bio:e.target.value}))} rows={4} className={inp+" resize-none"} placeholder="Tell students about yourself…"/>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={lbl}>Education</label><input type="text" value={settings.education} onChange={e=>setSettings(p=>({...p,education:e.target.value}))} className={inp} placeholder="PhD in CS"/></div>
                    <div><label className={lbl}>Experience (yrs)</label><input type="number" min={0} value={settings.experience} onChange={e=>setSettings(p=>({...p,experience:parseInt(e.target.value)||0}))} className={inp}/></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Website</label>
                      <div className="relative"><Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="url" value={settings.website} onChange={e=>setSettings(p=>({...p,website:e.target.value}))} className={inp+" pl-9"} placeholder="https://…"/></div>
                    </div>
                    <div>
                      <label className={lbl}>LinkedIn</label>
                      <div className="relative"><Linkedin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input type="url" value={settings.linkedin} onChange={e=>setSettings(p=>({...p,linkedin:e.target.value}))} className={inp+" pl-9"} placeholder="linkedin.com/in/…"/></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — CV + Save */}
              <div className="space-y-4">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className={`flex items-center gap-3 border-b border-slate-200 ${CARD.personal.header} px-6 py-4`}>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${CARD.personal.icon}`}><FileText size={16} className="text-white"/></div>
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${CARD.personal.label}`}>Document</p>
                      <p className="text-sm font-bold text-slate-800">Curriculum Vitae</p>
                    </div>
                  </div>
                  <div className="space-y-3 px-6 py-6">
                    {pendingCVFile && (
                      <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <FileText size={16} className="shrink-0 text-amber-500"/>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{pendingCVFile.name}</p><p className="text-xs text-amber-600">⚠ Save to upload</p></div>
                        <div className="flex gap-1">
                          <button onClick={()=>window.open(URL.createObjectURL(pendingCVFile),'_blank')} className="rounded-xl p-1.5 text-amber-600 hover:bg-amber-100"><Eye size={14}/></button>
                          <button onClick={handleDeleteCV} className="rounded-xl p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    )}
                    {settings.cvUrl && !pendingCVFile && (
                      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <FileText size={16} className="shrink-0 text-emerald-500"/>
                        <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">CV uploaded</p><p className="text-xs text-slate-500">Preview or download</p></div>
                        <div className="flex gap-1">
                          <button onClick={()=>setShowCVPreview(true)} className="rounded-xl p-1.5 text-emerald-600 hover:bg-emerald-100"><Eye size={14}/></button>
                          <a href={settings.cvUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl p-1.5 text-emerald-600 hover:bg-emerald-100"><Download size={14}/></a>
                          <button onClick={handleDeleteCV} className="rounded-xl p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    )}
                    <label htmlFor="cv-input" className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-emerald-200 px-4 py-4 transition hover:border-emerald-400 hover:bg-emerald-50">
                      <Upload size={18} className="shrink-0 text-emerald-500"/>
                      <div><p className="text-sm font-semibold text-slate-700">{pendingCVFile?'Change CV':settings.cvUrl?'Update CV':'Upload CV'}</p><p className="text-xs text-slate-400">PDF only · max 10 MB</p></div>
                      <input id="cv-input" type="file" accept=".pdf" onChange={handleCVSelect} className="hidden"/>
                    </label>
                  </div>
                </div>
                <button onClick={handleSaveSettings} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving?<><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>Saving…</>:<><Save size={15}/>Save Changes</>}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Avatar modal */}
      {showAvatarPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-center text-lg font-bold tracking-tight text-slate-900">Preview Avatar</h3>
            <div className="mx-auto mb-5 h-36 w-36 overflow-hidden rounded-2xl border-4 border-sky-100 shadow-lg">
              {previewUrl?<Image src={previewUrl} alt="Preview" width={144} height={144} className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center"><User size={56} className="text-slate-300"/></div>}
            </div>
            <p className="mb-5 text-center text-sm text-slate-500">Use this as your new avatar?</p>
            <div className="flex gap-3">
              <button onClick={()=>{setShowAvatarPreview(false);setSelectedAvatarFile(null);setPreviewUrl("");const fi=document.getElementById('avatar-upload') as HTMLInputElement;if(fi)fi.value='';}} className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
              <button onClick={async()=>{setShowAvatarPreview(false);if(selectedAvatarFile)await handleAvatarUpload(selectedAvatarFile);setSelectedAvatarFile(null);setPreviewUrl("");}} className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"><Upload size={14}/>Upload</button>
            </div>
          </div>
        </div>
      )}

      {/* CV modal */}
      {showCVPreview && (pendingCVPreviewUrl||settings.cvUrl) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={()=>setShowCVPreview(false)}>
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText size={17} className="text-emerald-600"/>
                <span className="font-bold text-slate-800">CV Preview</span>
                {pendingCVPreviewUrl&&<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-600">Not saved</span>}
              </div>
              <div className="flex gap-2">
                {!pendingCVPreviewUrl&&settings.cvUrl&&<a href={settings.cvUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"><Download size={14}/>Download</a>}
                <button onClick={()=>setShowCVPreview(false)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Close</button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden"><iframe src={pendingCVPreviewUrl||settings.cvUrl} className="h-full w-full border-0" title="CV Preview"/></div>
          </div>
        </div>
      )}
    </div>
  );
}