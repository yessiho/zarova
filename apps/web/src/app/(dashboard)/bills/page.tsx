'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Globe,
  Loader2,
  Phone,
  Tv,
  Wifi,
  Zap,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================ TYPES */

interface WalletData {
  id: number;
  balance: string;
  currency: string;
  status: string;
}

interface Provider { id: string; name: string }
interface Plan     { id: string; label: string; amount: number }

interface CatalogueEntry {
  label: string;
  description: string;
  icon: string;
  providers: Provider[];
  recipientLabel: string;
  recipientPlaceholder: string;
  quickAmounts?: number[];
  plans?: Record<string, Plan[]>;
}

type Catalogue = Record<string, CatalogueEntry>;

interface BillRecord {
  id: number;
  reference: string;
  billType: string;
  provider: string;
  recipient: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
}

type BillStep = 'category' | 'provider' | 'details' | 'review' | 'success';

/* ============================================================ HELPERS */

function fmt(amount: string | number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(Number(amount));
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  AIRTIME:     Phone,
  DATA:        Wifi,
  ELECTRICITY: Zap,
  CABLE_TV:    Tv,
  INTERNET:    Globe,
};

const CATEGORY_COLORS: Record<string, string> = {
  AIRTIME:     'yellow',
  DATA:        'blue',
  ELECTRICITY: 'orange',
  CABLE_TV:    'purple',
  INTERNET:    'green',
};

function relativeTime(date: string) {
  try {
    const d = new Date(date);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)   return 'Just now';
    if (diffMin < 60)  return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)   return `${diffHr}h ago`;
    return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short' }).format(d);
  } catch { return date; }
}

/* ============================================================ PAGE */

export default function BillsPage() {
  const router = useRouter();

  const [step,          setStep]          = useState<BillStep>('category');
  const [catalogue,     setCatalogue]     = useState<Catalogue>({});
  const [wallets,       setWallets]       = useState<WalletData[]>([]);
  const [history,       setHistory]       = useState<BillRecord[]>([]);
  const [loadingInit,   setLoadingInit]   = useState(true);

  const [selectedType,     setSelectedType]     = useState('');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedPlan,     setSelectedPlan]     = useState<Plan | null>(null);
  const [recipient,        setRecipient]        = useState('');
  const [amount,           setAmount]           = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);
  const [recipientError,   setRecipientError]   = useState('');
  const [amountError,      setAmountError]      = useState('');

  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState('');
  const [lastBill,     setLastBill]     = useState<BillRecord | null>(null);

  /* ---- initial load ---- */
  useEffect(() => {
    Promise.all([
      apiFetch<Catalogue>('/bills/catalogue'),
      apiFetch<WalletData[]>('/wallets'),
      apiFetch<{ data: BillRecord[] }>('/bills?limit=5'),
    ])
      .then(([cat, wals, hist]) => {
        setCatalogue(cat ?? {});
        setWallets((Array.isArray(wals) ? wals : []).filter((w) => w.status === 'ACTIVE' && w.currency === 'NGN'));
        setHistory(Array.isArray(hist?.data) ? hist.data : []);
        const firstWallet = (Array.isArray(wals) ? wals : []).find((w) => w.status === 'ACTIVE' && w.currency === 'NGN');
        if (firstWallet) setSelectedWalletId(firstWallet.id);
      })
      .catch(() => {})
      .finally(() => setLoadingInit(false));
  }, []);

  const catEntry  = catalogue[selectedType] as CatalogueEntry | undefined;
  const plans     = selectedProvider && catEntry?.plans ? (catEntry.plans[selectedProvider.id] ?? []) : [];
  const hasPlans  = plans.length > 0;
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId);

  /* ---- submit ---- */
  const submitBill = useCallback(async () => {
    const finalAmt = parseInt(amount, 10);
    if (!selectedType || !selectedProvider || !recipient || isNaN(finalAmt) || !selectedWalletId) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await apiFetch<{ bill: BillRecord; message: string }>('/bills/pay', {
        method: 'POST',
        body: JSON.stringify({
          billType:  selectedType,
          provider:  selectedProvider.id,
          recipient,
          amount:    finalAmt,
          walletId:  selectedWalletId,
        }),
      });
      setLastBill(res.bill as BillRecord);
      setStep('success');
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedType, selectedProvider, recipient, amount, selectedWalletId]);

  /* ---- validate details ---- */
  const validateDetails = () => {
    let ok = true;
    if (!recipient.trim()) { setRecipientError('This field is required'); ok = false; }
    else setRecipientError('');

    if (!hasPlans) {
      const amt = parseInt(amount, 10);
      if (isNaN(amt) || amt < 50) { setAmountError('Enter a valid amount (min 50)'); ok = false; }
      else if (selectedWallet && amt > Number(selectedWallet.balance)) {
        setAmountError(`Insufficient balance. Available: ${fmt(selectedWallet.balance)}`);
        ok = false;
      } else setAmountError('');
    } else {
      if (!selectedPlan) { setAmountError('Select a plan'); ok = false; }
      else if (selectedWallet && selectedPlan.amount > Number(selectedWallet.balance)) {
        setAmountError(`Insufficient balance. Available: ${fmt(selectedWallet.balance)}`);
        ok = false;
      } else setAmountError('');
    }
    return ok;
  };

  /* ---- reset ---- */
  const reset = () => {
    setStep('category'); setSelectedType(''); setSelectedProvider(null);
    setSelectedPlan(null); setRecipient(''); setAmount('');
    setRecipientError(''); setAmountError(''); setSubmitError('');
  };

  /* ============================================================ RENDER */

  if (loadingInit) return (
    <main className="bills-page">
      <div className="bills-loading"><Loader2 size={24} className="bills-spin" /><p>Loading bill services…</p></div>
    </main>
  );

  if (step === 'success' && lastBill) return (
    <main className="bills-page">
      <div className="bills-success-card">
        <div className="bills-success-icon"><CheckCircle2 size={52} /></div>
        <h2>{catEntry?.label ?? 'Bill'} Successful!</h2>
        <p>Your payment has been processed and confirmed.</p>
        <div className="bills-success-details">
          <div className="bills-success-row"><span>Provider</span><strong>{selectedProvider?.name}</strong></div>
          <div className="bills-success-row"><span>Recipient</span><strong>{lastBill.recipient}</strong></div>
          <div className="bills-success-row"><span>Amount</span><strong>{fmt(lastBill.amount)}</strong></div>
          <div className="bills-success-row"><span>Status</span><strong className="bills-badge-success">Successful</strong></div>
          <div className="bills-success-row"><span>Reference</span><strong className="bills-ref">{lastBill.reference}</strong></div>
        </div>
        <div className="bills-success-actions">
          <button type="button" className="bills-primary-btn" onClick={reset}>Pay Another Bill</button>
          <button type="button" className="bills-outline-btn" onClick={() => router.push('/transactions')}>View Transactions</button>
        </div>
      </div>
    </main>
  );

  return (
    <main className="bills-page">

      {/* ── Header ── */}
      <div className="bills-topbar">
        {step !== 'category' ? (
          <button type="button" className="bills-back-btn" onClick={() => {
            if (step === 'provider')  { setStep('category'); setSelectedType(''); }
            else if (step === 'details') { setStep('provider'); setSelectedProvider(null); setSelectedPlan(null); }
            else if (step === 'review')  setStep('details');
          }}>
            <ArrowLeft size={17} /> Back
          </button>
        ) : (
          <button type="button" className="bills-back-btn" onClick={() => router.back()}>
            <ArrowLeft size={17} /> Back
          </button>
        )}
        <div className="bills-title">
          <h1>Pay Bills</h1>
          <p>Airtime, data, utilities & more</p>
        </div>
      </div>

      {/* ── Wallet selector ── */}
      {wallets.length > 0 && (
        <div className="bills-wallet-bar">
          <span>Pay from:</span>
          <div className="bills-wallet-chips">
            {wallets.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`bills-wallet-chip ${selectedWalletId === w.id ? 'active' : ''}`}
                onClick={() => setSelectedWalletId(w.id)}
              >
                {w.currency} · {fmt(w.balance)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================
          STEP: CATEGORY GRID
          ====================================================== */}
      {step === 'category' && (
        <>
          <div className="bills-category-grid">
            {Object.entries(catalogue).map(([type, entry]) => {
              const Icon  = CATEGORY_ICONS[type] ?? Phone;
              const color = CATEGORY_COLORS[type] ?? 'blue';
              return (
                <button
                  key={type}
                  type="button"
                  className="bills-category-card"
                  onClick={() => { setSelectedType(type); setStep('provider'); }}
                >
                  <div className={`bills-cat-icon ${color}`}><Icon size={26} /></div>
                  <strong>{entry.label}</strong>
                  <small>{entry.description}</small>
                  <ChevronRight size={15} className="bills-cat-arrow" />
                </button>
              );
            })}
          </div>

          {/* Recent bills */}
          {history.length > 0 && (
            <div className="bills-recent-card">
              <div className="bills-recent-header">
                <h3>Recent Payments</h3>
                <button type="button" className="bills-view-all" onClick={() => router.push('/transactions')}>
                  View All <ArrowRight size={13} />
                </button>
              </div>
              <div className="bills-recent-list">
                {history.map((b) => {
                  const Icon  = CATEGORY_ICONS[b.billType] ?? Phone;
                  const color = CATEGORY_COLORS[b.billType] ?? 'blue';
                  return (
                    <div key={b.id} className="bills-recent-item">
                      <div className={`bills-recent-icon ${color}`}><Icon size={16} /></div>
                      <div className="bills-recent-info">
                        <strong>{b.provider}</strong>
                        <span>{b.recipient}</span>
                      </div>
                      <div className="bills-recent-right">
                        <strong>{fmt(b.amount, b.currency)}</strong>
                        <small>{relativeTime(b.createdAt)}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================
          STEP: PROVIDER
          ====================================================== */}
      {step === 'provider' && catEntry && (
        <div className="bills-inner-card">
          <h2>{catEntry.label}</h2>
          <p className="bills-step-desc">Select a provider</p>
          <div className="bills-provider-grid">
            {catEntry.providers.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`bills-provider-card ${selectedProvider?.id === p.id ? 'selected' : ''}`}
                onClick={() => { setSelectedProvider(p); setStep('details'); }}
              >
                <div className="bills-provider-logo">{p.name.charAt(0)}</div>
                <strong>{p.name}</strong>
                {selectedProvider?.id === p.id && <CheckCircle2 size={16} className="bills-check" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================
          STEP: DETAILS
          ====================================================== */}
      {step === 'details' && catEntry && selectedProvider && (
        <div className="bills-inner-card">
          <h2>{selectedProvider.name} – {catEntry.label}</h2>
          <p className="bills-step-desc">Fill in the payment details</p>

          <div className="bills-form">
            {/* Recipient field */}
            <div className="bills-field">
              <label>{catEntry.recipientLabel}</label>
              <input
                type="text"
                className="bills-input"
                placeholder={catEntry.recipientPlaceholder}
                value={recipient}
                onChange={(e) => { setRecipient(e.target.value); setRecipientError(''); }}
              />
              {recipientError && <span className="bills-field-error">{recipientError}</span>}
            </div>

            {/* Plans OR custom amount */}
            {hasPlans ? (
              <div className="bills-field">
                <label>Select Plan</label>
                <div className="bills-plans-grid">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className={`bills-plan-card ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
                      onClick={() => { setSelectedPlan(plan); setAmount(String(plan.amount)); setAmountError(''); }}
                    >
                      <strong>{plan.label}</strong>
                      <span>{fmt(plan.amount)}</span>
                    </button>
                  ))}
                </div>
                {amountError && <span className="bills-field-error">{amountError}</span>}
              </div>
            ) : (
              <div className="bills-field">
                <label>Amount (₦)</label>
                <input
                  type="number"
                  className="bills-input"
                  placeholder="Enter amount"
                  min={50}
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
                />
                {catEntry.quickAmounts && (
                  <div className="bills-quick-amounts">
                    {catEntry.quickAmounts.map((v) => (
                      <button key={v} type="button" className={`bills-quick-chip ${amount === String(v) ? 'active' : ''}`} onClick={() => { setAmount(String(v)); setAmountError(''); }}>
                        ₦{v.toLocaleString()}
                      </button>
                    ))}
                  </div>
                )}
                {amountError && <span className="bills-field-error">{amountError}</span>}
              </div>
            )}

            <div className="bills-form-footer">
              <button
                type="button"
                className="bills-primary-btn"
                onClick={() => { if (validateDetails()) setStep('review'); }}
              >
                Review Payment <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          STEP: REVIEW
          ====================================================== */}
      {step === 'review' && catEntry && selectedProvider && (
        <div className="bills-inner-card">
          <h2>Confirm Payment</h2>
          <p className="bills-step-desc">Review the details before paying</p>

          <div className="bills-review-amount">
            <p>You are paying</p>
            <strong>{fmt(amount)}</strong>
          </div>

          <div className="bills-review-rows">
            <div className="bills-review-row"><span>Service</span><strong>{catEntry.label}</strong></div>
            <div className="bills-review-row"><span>Provider</span><strong>{selectedProvider.name}</strong></div>
            <div className="bills-review-row"><span>{catEntry.recipientLabel}</span><strong>{recipient}</strong></div>
            {selectedPlan && <div className="bills-review-row"><span>Plan</span><strong>{selectedPlan.label}</strong></div>}
            <div className="bills-review-row"><span>From</span><strong>NGN Wallet · {selectedWallet ? fmt(selectedWallet.balance) : '—'} balance</strong></div>
            <div className="bills-review-row"><span>Fee</span><strong className="bills-free">Free</strong></div>
          </div>

          {submitError && <p className="bills-submit-error">{submitError}</p>}

          <div className="bills-review-actions">
            <button type="button" className="bills-outline-btn" onClick={() => setStep('details')}>
              <ArrowLeft size={16} /> Edit
            </button>
            <button
              type="button"
              className="bills-primary-btn"
              disabled={submitting}
              onClick={() => void submitBill()}
            >
              {submitting
                ? <><Loader2 size={16} className="bills-spin" /> Processing…</>
                : <>Confirm & Pay <CheckCircle2 size={16} /></>}
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
