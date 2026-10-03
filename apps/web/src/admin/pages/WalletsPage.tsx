import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';

interface WalletUser { userId:number; name:string; lastName:string; phone:string; storeName:string; balance:number; lifetimeCredit:number; lifetimeDebit:number; isFrozen:boolean }
interface WalletList { items:WalletUser[]; total:number; stats:{ totalBalance:number; totalCredit:number; totalDebit:number; frozen:number } }
interface Entry { id:number; direction:'credit'|'debit'; amount:number; description:string; balanceAfter:number; createdAt:string }
const money = (value:number) => value.toLocaleString('fa-IR');

export function WalletsPage() {
  const toast = useToast();
  const client = useQueryClient();
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<WalletUser|null>(null);
  const [direction,setDirection]=useState<'credit'|'debit'>('credit');
  const [amount,setAmount]=useState('');
  const [description,setDescription]=useState('');
  const list=useQuery({queryKey:['admin','wallets',search],queryFn:()=>api.get<WalletList>('/admin/wallets',{q:search,perPage:100})});
  const history=useQuery({queryKey:['admin','wallet-history',selected?.userId],queryFn:()=>api.get<{items:Entry[]}>(`/admin/wallets/${selected!.userId}/transactions`),enabled:Boolean(selected)});
  const refresh=()=>client.invalidateQueries({queryKey:['admin','wallets']});
  const adjust=useMutation({mutationFn:()=>api.post(`/admin/wallets/${selected!.userId}/adjust`,{direction,amount:Number(amount),description}),onSuccess:async()=>{toast.ok('تراکنش کیف پول ثبت شد.');setAmount('');setDescription('');await refresh();await history.refetch()},onError:error=>toast.error((error as Error).message)});
  const freeze=useMutation({mutationFn:(isFrozen:boolean)=>api.patch(`/admin/wallets/${selected!.userId}/status`,{isFrozen}),onSuccess:async(_data,isFrozen)=>{toast.ok('وضعیت کیف پول به‌روزرسانی شد.');await refresh();setSelected(current=>current?{...current,isFrozen}:current)},onError:error=>toast.error((error as Error).message)});
  const stats=list.data?.stats;
  const closeDialog=()=>{if(adjust.isPending||freeze.isPending)return;setSelected(null);setAmount('');setDescription('')};

  return <div className="a-page a-fade">
    <section className="a-page-head"><div className="a-titles"><h2 className="a-title">مدیریت کیف پول‌ها</h2><p className="a-subtitle">کنترل موجودی، اصلاحات مالی، مسدودسازی و مشاهده دفترکل کاربران</p></div></section>
    <section className="a-stat-strip">{[
      ['موجودی کل',stats?.totalBalance,'تومان'],['کل واریزها',stats?.totalCredit,'تومان'],['کل برداشت‌ها',stats?.totalDebit,'تومان'],['کیف پول مسدود',stats?.frozen,'کاربر'],
    ].map(([label,value,suffix])=><article className="a-stat-card" key={String(label)}><span className="a-stat-label">{label}</span><strong className="a-stat-value">{money(Number(value||0))}</strong><small className="a-stat-caption">{suffix}</small></article>)}</section>

    <section className="a-card a-card--flush">
      <div className="a-filterbar"><div className="a-searchbar"><input className="a-input" type="search" placeholder="جست‌وجوی نام، فروشگاه یا موبایل…" value={search} onChange={event=>setSearch(event.target.value)}/></div></div>
      <div className="a-table-wrap"><table className="a-table"><thead><tr><th>کاربر</th><th>موبایل</th><th>موجودی</th><th>واریز / برداشت</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>
        {list.isLoading?<tr><td colSpan={6} className="a-empty">در حال دریافت اطلاعات…</td></tr>:list.data?.items.length===0?<tr><td colSpan={6} className="a-empty">کیف پولی پیدا نشد.</td></tr>:list.data?.items.map(item=><tr key={item.userId}><td><strong className="a-strong">{`${item.name} ${item.lastName}`.trim()||'بدون نام'}</strong><small className="a-cell-sub">{item.storeName||'بدون نام فروشگاه'}</small></td><td className="a-ltr">{item.phone}</td><td><strong className="a-money">{money(item.balance)}</strong></td><td>{money(item.lifetimeCredit)} / {money(item.lifetimeDebit)}</td><td><span className={`a-badge ${item.isFrozen?'a-badge--red':'a-badge--success'}`}>{item.isFrozen?'مسدود':'فعال'}</span></td><td><button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={()=>setSelected(item)}>مدیریت</button></td></tr>)}
      </tbody></table></div>
    </section>

    <Modal open={Boolean(selected)} onClose={closeDialog} busy={adjust.isPending||freeze.isPending} size="lg" title={<span>مدیریت کیف پول <small className="a-badge a-badge--neutral">{selected?.phone}</small></span>} footer={<>
      <button type="button" className="a-btn a-btn--secondary" onClick={closeDialog} disabled={adjust.isPending||freeze.isPending}>بستن</button>
      <button type="button" className={`a-btn ${selected?.isFrozen?'a-btn--secondary':'a-btn--danger'}`} disabled={freeze.isPending} onClick={()=>selected&&freeze.mutate(!selected.isFrozen)}>{selected?.isFrozen?'رفع مسدودی کیف پول':'مسدود کردن کیف پول'}</button>
      <button type="submit" form="wallet-adjustment-form" className="a-btn a-btn--primary" disabled={adjust.isPending||!amount||description.trim().length<3}>{adjust.isPending?'در حال ثبت…':'ثبت تراکنش'}</button>
    </>}>
      {selected&&<div className="a-dialog-stack">
        <section className="a-dialog-summary"><div><span>دارنده کیف پول</span><strong>{`${selected.name} ${selected.lastName}`.trim()||'بدون نام'}</strong><small>{selected.storeName||'بدون نام فروشگاه'}</small></div><div><span>موجودی فعلی</span><strong className="a-money">{money(selected.balance)} تومان</strong><small>{selected.isFrozen?'کیف پول مسدود است':'کیف پول فعال است'}</small></div></section>
        <form id="wallet-adjustment-form" className="a-form" onSubmit={event=>{event.preventDefault();adjust.mutate()}}><div className="a-card-head"><div><h4 className="a-card-title">اصلاح موجودی</h4><p className="a-card-sub">هر تغییر با نام مدیر و دلیل آن در دفترکل ذخیره می‌شود.</p></div></div><div className="a-form-grid"><label className="a-field"><span className="a-label">نوع تراکنش</span><select className="a-select" value={direction} onChange={event=>setDirection(event.target.value as 'credit'|'debit')}><option value="credit">افزایش موجودی</option><option value="debit">کاهش موجودی</option></select></label><label className="a-field"><span className="a-label">مبلغ (تومان)</span><input className="a-input a-input--num" type="number" min="1" inputMode="numeric" placeholder="مثلاً ۵۰۰٬۰۰۰" value={amount} onChange={event=>setAmount(event.target.value)} required/></label><label className="a-field a-span-2"><span className="a-label">علت اصلاح <span className="a-req">*</span></span><textarea className="a-textarea" rows={3} placeholder="علت دقیق افزایش یا کاهش موجودی را بنویسید…" value={description} onChange={event=>setDescription(event.target.value)} required minLength={3}/></label></div></form>
        <section className="a-dialog-history"><div className="a-card-head"><h4 className="a-card-title">آخرین تراکنش‌ها</h4><span className="a-badge a-badge--neutral">{history.data?.items.length??0} مورد</span></div>{history.isLoading?<p className="a-empty">در حال دریافت تراکنش‌ها…</p>:history.data?.items.length===0?<p className="a-empty">تراکنشی ثبت نشده است.</p>:<div className="a-ledger-list">{history.data?.items.map(entry=><div key={entry.id} className="a-ledger-row"><span className={`a-ledger-icon a-ledger-icon--${entry.direction}`}>{entry.direction==='credit'?'+':'−'}</span><div className="a-ledger-copy"><strong>{entry.description}</strong><small>{new Date(entry.createdAt).toLocaleString('fa-IR')} · مانده {money(entry.balanceAfter)}</small></div><strong className={`a-ledger-amount a-ledger-amount--${entry.direction}`}>{entry.direction==='credit'?'+':'−'} {money(entry.amount)}</strong></div>)}</div>}</section>
      </div>}
    </Modal>
  </div>;
}
