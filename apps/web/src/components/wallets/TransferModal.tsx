'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { apiFetch } from '@/lib/api';

type Wallet = {
  id: number;
  currency: string;
  balance: string;
};

type TransferModalProps = {
  wallet: Wallet;
  wallets: Wallet[];
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

  return 'Unable to transfer money.';
}

export default function TransferModal({
  wallet,
  wallets,
  onClose,
  onSuccess,
}: TransferModalProps) {
  const [destinationWalletId, setDestinationWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableWallets = wallets.filter(
    (item) => item.id !== wallet.id && item.currency === wallet.currency,
  );

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();

    setError('');

    const numericAmount = Number(amount);

    if (!destinationWalletId) {
      setError('Please select a destination wallet.');
      return;
    }

    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    setLoading(true);

    try {
      await apiFetch(`/wallets/${wallet.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          destinationWalletId: Number(destinationWalletId),
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
        aria-labelledby="transfer-modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="transfer-modal-title">Transfer Money</h2>

            <p>Send money to another wallet.</p>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close transfer modal"
          >
            <X size={22} />
          </button>
        </div>

        <div className="wallet-summary">
          <span>From: {wallet.currency} Wallet</span>

          <strong>Balance: {wallet.balance}</strong>
        </div>

        <form onSubmit={handleSubmit} className="wallet-action-form">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="destination-wallet">
              Destination Wallet
            </label>

            <select
              id="destination-wallet"
              value={destinationWalletId}
              onChange={(event) =>
                setDestinationWalletId(event.target.value)
              }
              required
              disabled={loading || availableWallets.length === 0}
            >
              <option value="">Select wallet</option>

              {availableWallets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.currency} Wallet
                </option>
              ))}
            </select>

            {availableWallets.length === 0 && (
              <small className="form-hint">
                No other wallet with matching currency is available.
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="transfer-amount">Amount</label>

            <input
              id="transfer-amount"
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
              disabled={loading || availableWallets.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spinner" />
                  Processing...
                </>
              ) : (
                'Confirm Transfer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}