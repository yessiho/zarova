'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { apiFetch } from '@/lib/api';

type Wallet = {
  id: number;
  currency: string;
  balance: string;
};

type DepositModalProps = {
  wallet: Wallet;
  onClose: () => void;
  onSuccess: () => void;
};

interface ApiError {
  message?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  ) {
    return (error as ApiError).message as string;
  }

  return 'Unable to deposit money.';
}

export default function DepositModal({
  wallet,
  onClose,
  onSuccess,
}: DepositModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();

    setError('');

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');

      return;
    }

    setLoading(true);

    try {
      await apiFetch(`/wallets/${wallet.id}/deposit`, {
        method: 'POST',
        body: JSON.stringify({
          amount: numericAmount,
        }),
      });

      onSuccess();
      onClose();
    } catch (error: unknown) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="wallet-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>Deposit Money</h2>
            <p>Add money to your wallet.</p>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close deposit modal"
          >
            <X size={22} />
          </button>
        </div>

        <div className="wallet-summary">
          <span>{wallet.currency} Wallet</span>

          <strong>Current Balance: {wallet.balance}</strong>
        </div>

        <form onSubmit={handleSubmit} className="wallet-action-form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="deposit-amount">Amount</label>

            <input
              id="deposit-amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              min="1"
              step="0.01"
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spinner" />
                  Processing...
                </>
              ) : (
                'Confirm Deposit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}