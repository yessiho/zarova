'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Search,
  Send,
  User,
  Wallet,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { getAuthUser } from '@/lib/auth';

/* ============================================================ TYPES */

interface WalletData {
  id: number;
  balance: string;
  currency: string;
  status: string;
  account: { accountNumber: string; accountName: string; bankName: string } | null;
}

interface Recipient {
  walletId: number;
  accountNumber: string;
  accountName: string;
  bankName: string;
  currency: string;
}

type Step = 'wallet' | 'recipient' | 'amount' | 'review' | 'success';

/* ============================================================ HELPERS */

function fmt(amount: string | number, currency: string) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'wallet',    label: 'Wallet'    },
  { key: 'recipient', label: 'Recipient' },
  { key: 'amount',    label: 'Amount'    },
  { key: 'review',    label: 'Review'    },
];

/* ============================================================ PAGE */

export default function SendPage() {
  const router = useRouter();
  const authUser = getAuthUser() as { firstName?: string } | null;

  const [step, setStep] = useState<Step>('wallet');

  /* -- wallet step */
  const [wallets,        setWallets]        = useState<WalletData[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);

  /* -- recipient step */
  const [accountInput,     setAccountInput]     = useState('');
  const [lookupLoading,    setLookupLoading]    = useState(false);
  const [lookupError,      setLookupError]      = useState('');
  const [recipient,        setRecipient]        = useState<Recipient | null>(null);

  /* -- amount step */
  const [amount,     setAmount]     = useState('');
  const [note,       setNote]       = useState('');
  const [amtError,   setAmtError]   = useState('');

  /* -- submit */
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [txRef,       setTxRef]       = useState('');

  /* ---- load wallets ---- */
  useEffect(() => {
    apiFetch<WalletData[]>('/wallets')
      .then((res) => setWallets(Array.isArray(res) ? res.filter((w) => w.status === 'ACTIVE') : []))
      .catch(() => setWallets([]))
      .finally(() => setWalletsLoading(false));
  }, []);

  /* ---- recipient lookup ---- */
  const lookupRecipient = useCallback(async () => {
    const num = accountInput.trim();
    if (!/^\d{10}$/.test(num)) {
      setLookupError('Enter a valid 10-digit account number');
      return;
    }
    setLookupError('');
    setLookupLoading(true);
    try {
      const res = await apiFetch<Recipient>(`/wallets/recipient?accountNumber=${num}`);
      if (res.currency !== selectedWallet?.currency) {
        setLookupError(`Recipient wallet is ${res.currency} — your selected wallet is ${selectedWallet?.currency}. Choose a matching wallet.`);
        setRecipient(null);
      } else {
        setRecipient(res);
      }
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : 'Recipient not found');
      setRecipient(null);
    } finally {
      setLookupLoading(false);
    }
  }, [accountInput, selectedWallet?.currency]);

  /* ---- submit transfer ---- */
  const submitTransfer = useCallback(async () => {
    const amt = parseInt(amount, 10);
    if (!selectedWallet || !recipient || isNaN(amt) || amt <= 0) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await apiFetch<{ transaction: { reference: string } }>(
        `/wallets/${selectedWallet.id}/transfer`,
        {
          method: 'POST',
          body: JSON.stringify({ destinationWalletId: recipient.walletId, amount: amt }),
        },
      );
      setTxRef(res.transaction?.reference ?? 'TXN-SUCCESS');
      setStep('success');
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Transfer failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedWallet, recipient, amount]);

  /* ---- validate amount ---- */
  const validateAmount = () => {
    const amt = parseInt(amount, 10);
    if (isNaN(amt) || amt <= 0) { setAmtError('Enter a valid amount'); return false; }
    if (selectedWallet && amt > Number(selectedWallet.balance)) {
      setAmtError(`Insufficient balance. Available: ${fmt(selectedWallet.balance, selectedWallet.currency)}`);
      return false;
    }
    setAmtError('');
    return true;
  };

  /* ---- step index ---- */
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  /* ============================================================ RENDER */

  if (step === 'success') {
    return (
      <main className="send-page">
        <div className="send-success-card">
          <div className="send-success-icon">
            <CheckCircle2 size={52} />
          </div>
          <h2>Transfer Sent!</h2>
          <p>Your money is on its way to {recipient?.accountName}.</p>

          <div className="send-success-details">
            <div className="send-success-row">
              <span>Amount</span>
              <strong>{fmt(amount, selectedWallet?.currency ?? 'NGN')}</strong>
            </div>
            <div className="send-success-row">
              <span>To</span>
              <strong>{recipient?.accountName}</strong>
            </div>
            <div className="send-success-row">
              <span>Bank</span>
              <strong>{recipient?.bankName}</strong>
            </div>
            <div className="send-success-row">
              <span>Reference</span>
              <strong className="send-ref">{txRef}</strong>
            </div>
          </div>

          <div className="send-success-actions">
            <button type="button" className="send-primary-btn" onClick={() => router.push('/transactions')}>
              View Transactions
            </button>
            <button type="button" className="send-outline-btn" onClick={() => {
              setStep('wallet'); setSelectedWallet(null); setRecipient(null);
              setAmount(''); setNote(''); setTxRef(''); setAccountInput('');
            }}>
              Send Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="send-page">

      {/* ── Back + title ── */}
      <div className="send-topbar">
        <button type="button" className="send-back-btn" onClick={() => router.back()}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div className="send-title-wrap">
          <Send size={20} />
          <h1>Send Money</h1>
        </div>
      </div>

      {/* ── Progress ── */}
      <div className="send-progress">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`send-progress-step ${i <= stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}>
            <div className="send-progress-dot">
              {i < stepIndex ? <CheckCircle2 size={14} /> : <span>{i + 1}</span>}
            </div>
            <span>{s.label}</span>
            {i < STEPS.length - 1 && <div className={`send-progress-line ${i < stepIndex ? 'done' : ''}`} />}
          </div>
        ))}
      </div>

      {/* ── Card ── */}
      <div className="send-card">

        {/* ======================================================
            STEP 1: Select Wallet
            ====================================================== */}
        {step === 'wallet' && (
          <div className="send-step">
            <div className="send-step-header">
              <Wallet size={22} />
              <div>
                <h2>Select Source Wallet</h2>
                <p>Choose which wallet to send from</p>
              </div>
            </div>

            {walletsLoading ? (
              <div className="send-loading"><Loader2 size={22} className="send-spin" /> Loading wallets…</div>
            ) : wallets.length === 0 ? (
              <div className="send-empty">No active wallets found. <button type="button" onClick={() => router.push('/wallets')}>Create one</button></div>
            ) : (
              <div className="send-wallet-list">
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`send-wallet-item ${selectedWallet?.id === w.id ? 'selected' : ''}`}
                    onClick={() => setSelectedWallet(w)}
                  >
                    <div className="send-wallet-item-left">
                      <span className="send-wallet-currency">{w.currency}</span>
                      <div>
                        <strong>{fmt(w.balance, w.currency)}</strong>
                        <small>{w.account?.bankName ?? 'Zarova Virtual Bank'}</small>
                      </div>
                    </div>
                    {selectedWallet?.id === w.id && <CheckCircle2 size={20} className="send-check" />}
                  </button>
                ))}
              </div>
            )}

            <div className="send-step-footer">
              <button
                type="button"
                className="send-primary-btn"
                disabled={!selectedWallet}
                onClick={() => setStep('recipient')}
              >
                Continue <ArrowRight size={17} />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================
            STEP 2: Recipient
            ====================================================== */}
        {step === 'recipient' && (
          <div className="send-step">
            <div className="send-step-header">
              <User size={22} />
              <div>
                <h2>Enter Recipient</h2>
                <p>Enter the 10-digit Zarova account number</p>
              </div>
            </div>

            <div className="send-recipient-form">
              <div className="send-input-group">
                <label>Account Number</label>
                <div className="send-input-row">
                  <input
                    type="text"
                    className="send-input"
                    placeholder="e.g. 1045827391"
                    maxLength={10}
                    value={accountInput}
                    onChange={(e) => {
                      setAccountInput(e.target.value.replace(/\D/g, ''));
                      setRecipient(null);
                      setLookupError('');
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void lookupRecipient(); }}
                  />
                  <button
                    type="button"
                    className="send-lookup-btn"
                    onClick={() => void lookupRecipient()}
                    disabled={lookupLoading || accountInput.length !== 10}
                  >
                    {lookupLoading ? <Loader2 size={17} className="send-spin" /> : <Search size={17} />}
                  </button>
                </div>
                {lookupError && <p className="send-error">{lookupError}</p>}
              </div>

              {recipient && (
                <div className="send-recipient-card">
                  <div className="send-recipient-avatar">
                    {recipient.accountName.charAt(0).toUpperCase()}
                  </div>
                  <div className="send-recipient-info">
                    <strong>{recipient.accountName}</strong>
                    <span>{recipient.bankName}</span>
                    <span className="send-recipient-acct">{recipient.accountNumber}</span>
                  </div>
                  <CheckCircle2 size={22} className="send-check" />
                </div>
              )}
            </div>

            <div className="send-step-footer">
              <button type="button" className="send-outline-btn" onClick={() => setStep('wallet')}>
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="send-primary-btn"
                disabled={!recipient}
                onClick={() => setStep('amount')}
              >
                Continue <ArrowRight size={17} />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================
            STEP 3: Amount
            ====================================================== */}
        {step === 'amount' && selectedWallet && (
          <div className="send-step">
            <div className="send-step-header">
              <span className="send-currency-icon">{selectedWallet.currency}</span>
              <div>
                <h2>Enter Amount</h2>
                <p>Balance: {fmt(selectedWallet.balance, selectedWallet.currency)}</p>
              </div>
            </div>

            <div className="send-amount-form">
              <div className="send-amount-input-wrap">
                <span className="send-amount-symbol">
                  {selectedWallet.currency === 'NGN' ? '₦' :
                   selectedWallet.currency === 'USD' ? '$' :
                   selectedWallet.currency === 'GBP' ? '£' : '€'}
                </span>
                <input
                  type="number"
                  className="send-amount-input"
                  placeholder="0"
                  min={1}
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setAmtError(''); }}
                />
              </div>
              {amtError && <p className="send-error">{amtError}</p>}

              <div className="send-quick-amounts">
                {[500, 1000, 2000, 5000, 10000].map((v) => (
                  <button key={v} type="button" className={`send-quick-chip ${amount === String(v) ? 'active' : ''}`} onClick={() => { setAmount(String(v)); setAmtError(''); }}>
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>

              <div className="send-input-group">
                <label>Note (optional)</label>
                <input
                  type="text"
                  className="send-input"
                  placeholder="What's this for?"
                  maxLength={100}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className="send-step-footer">
              <button type="button" className="send-outline-btn" onClick={() => setStep('recipient')}>
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="button"
                className="send-primary-btn"
                onClick={() => { if (validateAmount()) setStep('review'); }}
              >
                Review <ArrowRight size={17} />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================
            STEP 4: Review
            ====================================================== */}
        {step === 'review' && selectedWallet && recipient && (
          <div className="send-step">
            <div className="send-step-header">
              <CheckCircle2 size={22} />
              <div>
                <h2>Review Transfer</h2>
                <p>Confirm the details before sending</p>
              </div>
            </div>

            <div className="send-review-list">
              <div className="send-review-amount">
                <p>You are sending</p>
                <strong>{fmt(amount, selectedWallet.currency)}</strong>
              </div>

              <div className="send-review-rows">
                <div className="send-review-row">
                  <span>From</span>
                  <strong>{selectedWallet.currency} Wallet · {selectedWallet.account?.accountNumber ?? '—'}</strong>
                </div>
                <div className="send-review-row">
                  <span>To</span>
                  <strong>{recipient.accountName}</strong>
                </div>
                <div className="send-review-row">
                  <span>Account</span>
                  <strong>{recipient.accountNumber}</strong>
                </div>
                <div className="send-review-row">
                  <span>Bank</span>
                  <strong>{recipient.bankName}</strong>
                </div>
                {note && (
                  <div className="send-review-row">
                    <span>Note</span>
                    <strong>{note}</strong>
                  </div>
                )}
                <div className="send-review-row">
                  <span>Fee</span>
                  <strong className="send-free">Free</strong>
                </div>
              </div>
            </div>

            {submitError && <p className="send-error send-error-block">{submitError}</p>}

            <div className="send-step-footer">
              <button type="button" className="send-outline-btn" onClick={() => setStep('amount')}>
                <ArrowLeft size={16} /> Edit
              </button>
              <button
                type="button"
                className="send-primary-btn"
                disabled={submitting}
                onClick={() => void submitTransfer()}
              >
                {submitting ? <><Loader2 size={16} className="send-spin" /> Sending…</> : <>Confirm Send <Send size={16} /></>}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Selected wallet summary bar ── */}
      {selectedWallet && step !== 'wallet' && (
        <div className="send-wallet-bar">
          <Wallet size={15} />
          <span>Sending from</span>
          <strong>{selectedWallet.currency} · {fmt(selectedWallet.balance, selectedWallet.currency)}</strong>
          <button type="button" onClick={() => setStep('wallet')}>
            Change <ChevronRight size={13} />
          </button>
        </div>
      )}

    </main>
  );
}
