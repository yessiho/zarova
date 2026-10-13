
'use client';

import {
  Suspense,
  useEffect,
  useState,
} from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  CheckCircle,
  Loader2,
  XCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

type VerifyStatus =
  | 'verifying'
  | 'success'
  | 'failed';

type ApiError = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

// ============================================================
// ERROR HELPER
// ============================================================

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    const message =
      (error as ApiError).message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return fallback;
}

// ============================================================
// COMPONENT
// ============================================================

function PaystackVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] =
    useState<VerifyStatus>('verifying');

  const [message, setMessage] =
    useState('');

  // ============================================================
  // VERIFY ON MOUNT
  // ============================================================

  useEffect(() => {
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');
    const callbackStatus = searchParams.get('status');

    const ref = reference ?? trxref;

    if (!ref) {
      setStatus('failed');
      setMessage(
        'No payment reference found. Unable to verify this transaction.',
      );

      window.setTimeout(() => {
        router.replace('/wallets');
      }, 3000);

      return;
    }

    if (callbackStatus === 'cancelled') {
      setStatus('failed');
      setMessage('Payment was cancelled. No funds were deducted.');

      window.setTimeout(() => {
        router.replace('/wallets');
      }, 3000);

      return;
    }

    async function verify() {
      try {
        await apiFetch(
          `/paystack/verify/${encodeURIComponent(ref!)}`,
        );

        setStatus('success');
        setMessage(
          'Payment verified successfully. Your wallet has been funded.',
        );
      } catch (err: unknown) {
        console.error(
          'PAYSTACK VERIFY ERROR:',
          err,
        );

        setStatus('failed');
        setMessage(
          getErrorMessage(
            err,
            'Payment verification failed. Please contact support if funds were deducted.',
          ),
        );
      } finally {
        window.setTimeout(() => {
          router.replace('/wallets');
        }, 3000);
      }
    }

    void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="paystack-verify-page">

      <div className="paystack-verify-card">

        {/* ICON */}

        <div
          className={`paystack-verify-icon ${
            status === 'verifying'
              ? 'paystack-verify-icon-loading'
              : status === 'success'
                ? 'paystack-verify-icon-success'
                : 'paystack-verify-icon-error'
          }`}
        >

          {status === 'verifying' && (
            <Loader2
              size={48}
              className="paystack-verify-spinner"
            />
          )}

          {status === 'success' && (
            <CheckCircle
              size={48}
            />
          )}

          {status === 'failed' && (
            <XCircle
              size={48}
            />
          )}

        </div>

        {/* HEADING */}

        <h1>

          {status === 'verifying' &&
            'Verifying Payment...'}

          {status === 'success' &&
            'Payment Verified'}

          {status === 'failed' &&
            'Verification Failed'}

        </h1>

        {/* MESSAGE */}

        <p>

          {status === 'verifying'
            ? 'Please wait while we confirm your Paystack payment with our servers.'
            : message}

        </p>

        {/* REDIRECT NOTICE */}

        {status !== 'verifying' && (
          <p className="paystack-verify-redirect">
            Redirecting you to your
            wallets in 3 seconds...
          </p>
        )}

        {/* MANUAL LINK */}

        {status !== 'verifying' && (
          <button
            type="button"
            className="wallet-primary-button"
            onClick={() =>
              router.replace('/wallets')
            }
          >
            Go to Wallets Now
          </button>
        )}

      </div>

    </div>
  );
}

export default function PaystackVerifyPage() {
  return (
    <Suspense>
      <PaystackVerifyContent />
    </Suspense>
  );
}
