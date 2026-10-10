'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { apiFetch } from '@/lib/api';

type Wallet = {
  id: number;
  currency: string;
  balance: string;
};

type WithdrawModalProps = {
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

  return 'Unable to withdraw money.';
}

export default function WithdrawModal({
  wallet,
  onClose,
  onSuccess,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();

    setError('');

    const numericAmount = Number(amount);
    const availableBalance = Number(wallet.balance);

    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    if (numericAmount > availableBalance) {
      setError('Withdrawal amount cannot exceed your available balance.');
      return;
    }

    setLoading(true);

    try {
      await apiFetch(`/wallets/${wallet.id}/withdraw`, {
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
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="wallet-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="withdraw-modal-title">Withdraw Money</h2>

            <p>Withdraw money from your wallet.</p>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close withdrawal modal"
          >
            <X size={22} />
          </button>
        </div>

        <div className="wallet-summary">
          <span>{wallet.currency} Wallet</span>

          <strong>
            Available Balance: {wallet.balance}
          </strong>
        </div>

        <form onSubmit={handleSubmit} className="wallet-action-form">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="withdraw-amount">Amount</label>

            <input
              id="withdraw-amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              min="0.01"
              step="0.01"
              onChange={(event) => setAmount(event.target.value)}
              required
              disabled={loading}
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
                'Confirm Withdrawal'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}