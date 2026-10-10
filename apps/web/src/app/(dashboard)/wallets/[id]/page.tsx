
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpFromLine,
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  Landmark,
  Loader2,
  ReceiptText,
  RefreshCw,
  Wallet as WalletIcon,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

import type {
  Currency,
  Transaction,
  Wallet,
} from '@/types';

/* ============================================================
   TYPES
============================================================ */

type ModalType =
  | 'deposit'
  | 'withdraw'
  | 'transfer'
  | null;

type TransactionDirection =
  | 'credit'
  | 'debit';

type ApiError = {
  message?: string | string[];
};

type TransactionResponse = {
  data?: Transaction[];
  transactions?: Transaction[];
};

type WalletAction =
  | 'deposit'
  | 'withdraw'
  | 'transfer'
  | null;

/* ============================================================
   COMPONENT
============================================================ */

export default function WalletDetailsPage() {
  const params = useParams();

  const rawWalletId = params?.id;

  const walletId = Number(
    Array.isArray(rawWalletId)
      ? rawWalletId[0]
      : rawWalletId,
  );

  /* ==========================================================
     STATE
  ========================================================== */

  const [wallet, setWallet] =
    useState<Wallet | null>(null);

  const [wallets, setWallets] =
    useState<Wallet[]>([]);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [modalError, setModalError] =
    useState('');

  const [modal, setModal] =
    useState<ModalType>(null);

  const [amount, setAmount] =
    useState('');

  const [
    destinationWalletId,
    setDestinationWalletId,
  ] = useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const [activeAction, setActiveAction] =
    useState<WalletAction>(null);

  /* ==========================================================
     ERROR HELPER
  ========================================================== */

  const getErrorMessage = useCallback(
    (
      error: unknown,
      fallback: string,
    ): string => {
      if (
        error &&
        typeof error === 'object' &&
        'message' in error
      ) {
        const message =
          (error as ApiError).message;

        if (typeof message === 'string') {
          return message;
        }

        if (Array.isArray(message)) {
          return message.join(', ');
        }
      }

      if (error instanceof Error) {
        return error.message || fallback;
      }

      return fallback;
    },
    [],
  );

  /* ==========================================================
     FINANCIAL HELPERS
  ========================================================== */

  const getNumericBalance = useCallback(
    (value: string | number | undefined) => {
      const parsed = Number(value);

      if (!Number.isFinite(parsed)) {
        return 0;
      }

      return parsed;
    },
    [],
  );

  const parseAmount = useCallback(
    (value: string) => {
      const trimmed = value.trim();

      if (!trimmed) {
        throw new Error(
          'Please enter an amount.',
        );
      }

      const numericAmount = Number(trimmed);

      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
      ) {
        throw new Error(
          'Please enter a valid amount greater than zero.',
        );
      }

      /*
       * Money values should normally be limited
       * to two decimal places.
       */
      if (
        !/^\d+(\.\d{1,2})?$/.test(trimmed)
      ) {
        throw new Error(
          'Please enter an amount with no more than two decimal places.',
        );
      }

      return numericAmount;
    },
    [],
  );

  const hasSufficientBalance = useCallback(
    (
      requestedAmount: number,
      balance: string | number,
    ) => {
      const availableBalance =
        getNumericBalance(balance);

      return requestedAmount <= availableBalance;
    },
    [getNumericBalance],
  );

  /* ==========================================================
     LOAD WALLET DATA
  ========================================================== */

  const fetchWalletData = useCallback(
    async (showRefresh = false) => {
      if (
        !Number.isInteger(walletId) ||
        walletId <= 0
      ) {
        setError('Invalid wallet ID.');
        setLoading(false);
        return;
      }

      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        /*
         * Load the user's wallets.
         *
         * This is also needed by the transfer modal.
         */
        const walletResponse: unknown =
          await apiFetch('/wallets');

        const allWallets: Wallet[] =
          Array.isArray(walletResponse)
            ? (walletResponse as Wallet[])
            : [];

        setWallets(allWallets);

        const currentWallet =
          allWallets.find(
            (item) =>
              item.id === walletId,
          );

        if (!currentWallet) {
          throw new Error(
            'Wallet not found.',
          );
        }

        setWallet(currentWallet);

        /*
         * Load transactions.
         *
         * The current backend contract returns
         * transactions from this endpoint.
         */
        const transactionResponse: unknown =
          await apiFetch(
            '/transactions?limit=100',
          );

        let allTransactions:
          Transaction[] = [];

        if (
          Array.isArray(
            transactionResponse,
          )
        ) {
          allTransactions =
            transactionResponse as Transaction[];
        } else if (
          transactionResponse &&
          typeof transactionResponse ===
            'object'
        ) {
          const response =
            transactionResponse as TransactionResponse;

          if (
            Array.isArray(response.data)
          ) {
            allTransactions =
              response.data;
          } else if (
            Array.isArray(
              response.transactions,
            )
          ) {
            allTransactions =
              response.transactions;
          }
        }

        /*
         * Only show transactions belonging
         * to this wallet.
         */
        const walletTransactions =
          allTransactions
            .filter(
              (transaction) =>
                transaction.sourceWalletId ===
                  walletId ||
                transaction.destinationWalletId ===
                  walletId,
            )
            .sort(
              (a, b) =>
                new Date(
                  b.createdAt,
                ).getTime() -
                new Date(
                  a.createdAt,
                ).getTime(),
            );

        setTransactions(
          walletTransactions,
        );
      } catch (error: unknown) {
        console.error(
          'WALLET DETAIL ERROR:',
          error,
        );

        setError(
          getErrorMessage(
            error,
            'Unable to load wallet information.',
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      getErrorMessage,
      walletId,
    ],
  );

  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    void fetchWalletData();
  }, [fetchWalletData]);

  /* ==========================================================
     WALLET STATUS
  ========================================================== */

  const walletIsActive =
    wallet?.status === 'ACTIVE';

  const canPerformFinancialActions =
    walletIsActive;

  /* ==========================================================
     DESTINATION WALLETS
  ========================================================== */

  const destinationWallets = useMemo(() => {
    if (!wallet) {
      return [];
    }

    return wallets.filter(
      (item) =>
        item.id !== wallet.id &&
        item.currency === wallet.currency &&
        item.status === 'ACTIVE',
    );
  }, [wallet, wallets]);

  /* ==========================================================
     WALLET STATISTICS
  ========================================================== */

  const walletStats = useMemo(() => {
    let credits = 0;
    let debits = 0;

    transactions.forEach(
      (transaction) => {
        const transactionAmount =
          Number(transaction.amount);

        if (
          !Number.isFinite(
            transactionAmount,
          )
        ) {
          return;
        }

        const direction =
          getTransactionDirection(
            transaction,
            walletId,
          );

        if (direction === 'credit') {
          credits += transactionAmount;
        } else {
          debits += transactionAmount;
        }
      },
    );

    return {
      credits,
      debits,
      transactionCount:
        transactions.length,
    };
  }, [
    transactions,
    walletId,
  ]);

  /* ==========================================================
     CURRENCY FORMATTER
  ========================================================== */

  function formatCurrency(
    value: string | number,
    currency: Currency,
  ) {
    const numericValue =
      Number(value);

    const safeValue =
      Number.isFinite(numericValue)
        ? numericValue
        : 0;

    return new Intl.NumberFormat(
      'en-NG',
      {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(safeValue);
  }

  /* ==========================================================
     CURRENCY FLAG
  ========================================================== */

  function getCurrencyFlag(
    currency: Currency,
  ) {
    const flags: Record<
      Currency,
      string
    > = {
      NGN: '🇳🇬',
      USD: '🇺🇸',
      EUR: '🇪🇺',
      GBP: '🇬🇧',
    };

    return flags[currency];
  }

  /* ==========================================================
     DATE FORMATTERS
  ========================================================== */

  function formatDate(
    date: string,
  ) {
    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime(),
      )
    ) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat(
      'en-NG',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    ).format(parsedDate);
  }

  function formatDateTime(
    date: string,
  ) {
    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime(),
      )
    ) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat(
      'en-NG',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    ).format(parsedDate);
  }

  /* ==========================================================
     COPY ACCOUNT NUMBER
  ========================================================== */

  async function copyAccountNumber() {
    const accountNumber =
      wallet?.account?.accountNumber;

    if (!accountNumber) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        accountNumber,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        'Unable to copy account number:',
        error,
      );
    }
  }

  /* ==========================================================
     MODAL MANAGEMENT
  ========================================================== */

  function openModal(
    type: ModalType,
  ) {
    if (
      !wallet ||
      !canPerformFinancialActions
    ) {
      return;
    }

    setModalError('');
    setAmount('');
    setDestinationWalletId('');
    setModal(type);
  }

  function closeModal() {
    if (submitting) {
      return;
    }

    setModal(null);
    setAmount('');
    setDestinationWalletId('');
    setModalError('');
    setActiveAction(null);
  }

  /* ==========================================================
     DEPOSIT
  ========================================================== */

  async function handleDeposit(
    event: { preventDefault(): void },
  ) {
    event.preventDefault();

    if (!wallet) {
      return;
    }

    try {
      setSubmitting(true);
      setActiveAction('deposit');
      setModalError('');

      if (!walletIsActive) {
        throw new Error(
          'This wallet is not active and cannot receive deposits.',
        );
      }

      const numericAmount =
        parseAmount(amount);

      await apiFetch(
        `/wallets/${wallet.id}/deposit`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: numericAmount,
          }),
        },
      );

      setModal(null);
      setAmount('');

      await fetchWalletData(true);
    } catch (error: unknown) {
      setModalError(
        getErrorMessage(
          error,
          'Unable to complete deposit.',
        ),
      );
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  }

  /* ==========================================================
     WITHDRAW
  ========================================================== */

  async function handleWithdraw(
    event: { preventDefault(): void },
  ) {
    event.preventDefault();

    if (!wallet) {
      return;
    }

    try {
      setSubmitting(true);
      setActiveAction('withdraw');
      setModalError('');

      if (!walletIsActive) {
        throw new Error(
          'This wallet is not active and cannot be used for withdrawals.',
        );
      }

      const numericAmount =
        parseAmount(amount);

      if (
        !hasSufficientBalance(
          numericAmount,
          wallet.balance,
        )
      ) {
        throw new Error(
          'Withdrawal amount cannot exceed your available balance.',
        );
      }

      await apiFetch(
        `/wallets/${wallet.id}/withdraw`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: numericAmount,
          }),
        },
      );

      setModal(null);
      setAmount('');

      await fetchWalletData(true);
    } catch (error: unknown) {
      setModalError(
        getErrorMessage(
          error,
          'Unable to complete withdrawal.',
        ),
      );
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  }

  /* ==========================================================
     TRANSFER
  ========================================================== */

  async function handleTransfer(
    event: { preventDefault(): void },
  ) {
    event.preventDefault();

    if (!wallet) {
      return;
    }

    try {
      setSubmitting(true);
      setActiveAction('transfer');
      setModalError('');

      if (!walletIsActive) {
        throw new Error(
          'This wallet is not active and cannot send transfers.',
        );
      }

      const numericAmount =
        parseAmount(amount);

      const targetWalletId =
        Number(destinationWalletId);

      if (
        !Number.isInteger(
          targetWalletId,
        ) ||
        targetWalletId <= 0
      ) {
        throw new Error(
          'Please select a valid destination wallet.',
        );
      }

      if (
        targetWalletId === wallet.id
      ) {
        throw new Error(
          'You cannot transfer money to the same wallet.',
        );
      }

      const destinationWallet =
        wallets.find(
          (item) =>
            item.id === targetWalletId,
        );

      if (!destinationWallet) {
        throw new Error(
          'The selected destination wallet could not be found.',
        );
      }

      if (
        destinationWallet.status !==
        'ACTIVE'
      ) {
        throw new Error(
          'The destination wallet is not active.',
        );
      }

      if (
        destinationWallet.currency !==
        wallet.currency
      ) {
        throw new Error(
          'Transfers are only allowed between wallets with the same currency.',
        );
      }

      if (
        !hasSufficientBalance(
          numericAmount,
          wallet.balance,
        )
      ) {
        throw new Error(
          'Transfer amount cannot exceed your available balance.',
        );
      }

      await apiFetch(
        `/wallets/${wallet.id}/transfer`,
        {
          method: 'POST',
          body: JSON.stringify({
            destinationWalletId:
              targetWalletId,
            amount: numericAmount,
          }),
        },
      );

      setModal(null);
      setAmount('');
      setDestinationWalletId('');

      await fetchWalletData(true);
    } catch (error: unknown) {
      setModalError(
        getErrorMessage(
          error,
          'Unable to complete transfer.',
        ),
      );
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  }

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="wallet-detail-loading">
        <Loader2
          size={34}
          className="wallet-detail-spinner"
        />

        <h3>
          Loading wallet
        </h3>

        <p>
          Please wait while we load your
          financial information.
        </p>
      </div>
    );
  }

  /* ==========================================================
     ERROR PAGE
  ========================================================== */

  if (error && !wallet) {
    return (
      <div className="wallet-detail-error-page">
        <div className="wallet-detail-error-icon">
          <WalletIcon size={30} />
        </div>

        <h2>
          Unable to load wallet
        </h2>

        <p>
          {error}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            className="wallet-detail-primary-button"
            onClick={() =>
              void fetchWalletData()
            }
          >
            <RefreshCw size={18} />
            Try Again
          </button>

          <Link
            href="/wallets"
            className="wallet-detail-primary-button"
          >
            <ArrowLeft size={18} />
            Back to Wallets
          </Link>
        </div>
      </div>
    );
  }

  if (!wallet) {
    return null;
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="wallet-detail-page">

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="wallet-detail-header">

        <div className="wallet-detail-header-left">

          <Link
            href="/wallets"
            className="wallet-detail-back-button"
          >
            <ArrowLeft size={17} />

            <span>
              Back to Wallets
            </span>
          </Link>

          <div className="wallet-detail-title">

            <div className="wallet-detail-currency-icon">
              {getCurrencyFlag(
                wallet.currency,
              )}
            </div>

            <div>

              <div className="wallet-detail-title-top">

                <h1>
                  {wallet.currency} Wallet
                </h1>

                <span
                  className={`wallet-detail-status ${wallet.status.toLowerCase()}`}
                >
                  {wallet.status}
                </span>

              </div>

              <p>
                Manage your wallet balance,
                account and transactions.
              </p>

            </div>

          </div>

        </div>

        <button
          type="button"
          className="wallet-detail-refresh-button"
          onClick={() =>
            void fetchWalletData(true)
          }
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? 'wallet-detail-spinning'
                : ''
            }
          />

          {refreshing
            ? 'Refreshing...'
            : 'Refresh'}
        </button>

      </div>

      {/* ======================================================
          ERROR ALERT
      ====================================================== */}

      {error && (
        <div className="wallet-detail-alert">
          {error}
        </div>
      )}

      {/* ======================================================
          INACTIVE WALLET NOTICE
      ====================================================== */}

      {!walletIsActive && (
        <div className="wallet-detail-alert">
          This wallet is currently{' '}
          <strong>
            {wallet.status.toLowerCase()}
          </strong>
          . Financial actions are disabled
          until the wallet becomes active.
        </div>
      )}

      {/* ======================================================
          MAIN BALANCE CARD
      ====================================================== */}

      <section className="wallet-detail-balance-card">

        <div className="wallet-detail-balance-main">

          <div className="wallet-detail-balance-label">

            <WalletIcon size={18} />

            Available Balance

          </div>

          <h2>
            {formatCurrency(
              wallet.balance,
              wallet.currency,
            )}
          </h2>

          <p>
            Current available funds in this
            wallet.
          </p>

        </div>

        <div className="wallet-detail-balance-meta">

          <div>
            <span>
              Wallet ID
            </span>

            <strong>
              #{wallet.id}
            </strong>
          </div>

          <div>
            <span>
              Currency
            </span>

            <strong>
              {wallet.currency}
            </strong>
          </div>

          <div>
            <span>
              Created
            </span>

            <strong>
              {formatDate(
                wallet.createdAt,
              )}
            </strong>
          </div>

        </div>

      </section>

      {/* ======================================================
          VIRTUAL ACCOUNT DETAILS
      ====================================================== */}

      <section className="wallet-detail-account-section">

        <div className="wallet-detail-section-header">

          <div className="wallet-detail-section-heading">

            <div className="wallet-detail-section-icon account">
              <CreditCard size={20} />
            </div>

            <div>
              <span className="wallet-detail-section-eyebrow">
                VIRTUAL BANKING
              </span>

              <h2>
                Account Details
              </h2>

              <p>
                Your virtual account information
                for receiving funds.
              </p>
            </div>

          </div>

        </div>

        {wallet.account ? (

          <div className="wallet-detail-account-card">

            <div className="wallet-detail-account-primary">

              <div className="wallet-detail-account-brand">
                <div className="wallet-detail-account-icon">
                  <Landmark size={23} />
                </div>

                <div className="wallet-detail-account-primary-copy">
                  <span className="wallet-detail-field-label">
                    Account Number
                  </span>

                  <div className="wallet-detail-account-number">
                    <strong>
                      {wallet.account.accountNumber}
                    </strong>

                    <button
                      type="button"
                      onClick={() =>
                        void copyAccountNumber()
                      }
                      title={
                        copied
                          ? 'Account number copied'
                          : 'Copy account number'
                      }
                      aria-label={
                        copied
                          ? 'Account number copied'
                          : 'Copy account number'
                      }
                      className={`wallet-detail-copy-button ${
                        copied ? 'copied' : ''
                      }`}
                    >
                      {copied ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        <Copy size={17} />
                      )}

                      <span>
                        {copied ? 'Copied' : 'Copy'}
                      </span>
                    </button>
                  </div>

                  <span className="wallet-detail-account-hint">
                    Use this account number to receive
                    funds into your {wallet.currency} wallet.
                  </span>
                </div>
              </div>

              <div className="wallet-detail-account-status">
                <span className="wallet-detail-field-label">
                  Account Status
                </span>

                <span
                  className={`wallet-detail-account-status-badge ${
                    wallet.account.status.toLowerCase()
                  }`}
                >
                  <span className="wallet-detail-status-dot" />
                  {wallet.account.status}
                </span>
              </div>

            </div>

            <div className="wallet-detail-account-grid">

              <div className="wallet-detail-account-field">
                <span className="wallet-detail-field-label">
                  Account Name
                </span>

                <strong>
                  {wallet.account.accountName}
                </strong>
              </div>

              <div className="wallet-detail-account-field">
                <span className="wallet-detail-field-label">
                  Bank Name
                </span>

                <strong>
                  {wallet.account.bankName}
                </strong>
              </div>

              <div className="wallet-detail-account-field">
                <span className="wallet-detail-field-label">
                  Account Type
                </span>

                <strong>
                  {wallet.account.accountType}
                </strong>
              </div>

              <div className="wallet-detail-account-field">
                <span className="wallet-detail-field-label">
                  Currency
                </span>

                <strong>
                  <span className="wallet-detail-inline-currency">
                    {getCurrencyFlag(wallet.currency)}
                  </span>
                  {wallet.currency}
                </strong>
              </div>

              {wallet.account.bankCode && (
                <div className="wallet-detail-account-field">
                  <span className="wallet-detail-field-label">
                    Bank Code
                  </span>

                  <strong className="wallet-detail-mono">
                    {wallet.account.bankCode}
                  </strong>
                </div>
              )}

              <div className="wallet-detail-account-field">
                <span className="wallet-detail-field-label">
                  Wallet ID
                </span>

                <strong className="wallet-detail-mono">
                  #{wallet.id}
                </strong>
              </div>

            </div>

            <div className="wallet-detail-account-footer">
              <div className="wallet-detail-account-footer-icon">
                <CheckCircle2 size={16} />
              </div>

              <span>
                This virtual account is linked directly to
                your {wallet.currency} wallet.
              </span>
            </div>

          </div>

        ) : (

          <div className="wallet-detail-empty">

            <div className="wallet-detail-empty-icon">
              <CreditCard size={38} />
            </div>

            <h3>
              Account details unavailable
            </h3>

            <p>
              A virtual account has not yet
              been assigned to this wallet.
              Refresh the page or contact
              support if the issue continues.
            </p>

          </div>

        )}

      </section>

      {/* ======================================================
          WALLET STATISTICS
      ====================================================== */}

      <section className="wallet-detail-stats-grid">

        <div className="wallet-detail-stat-card">

          <div className="wallet-detail-stat-icon credit">
            <ArrowDownToLine size={20} />
          </div>

          <div>

            <span>
              Loaded Credits
            </span>

            <strong>
              {formatCurrency(
                walletStats.credits,
                wallet.currency,
              )}
            </strong>

          </div>

        </div>

        <div className="wallet-detail-stat-card">

          <div className="wallet-detail-stat-icon debit">
            <ArrowUpFromLine size={20} />
          </div>

          <div>

            <span>
              Loaded Debits
            </span>

            <strong>
              {formatCurrency(
                walletStats.debits,
                wallet.currency,
              )}
            </strong>

          </div>

        </div>

        <div className="wallet-detail-stat-card">

          <div className="wallet-detail-stat-icon neutral">
            <ReceiptText size={20} />
          </div>

          <div>

            <span>
              Transactions
            </span>

            <strong>
              {walletStats.transactionCount}
            </strong>

          </div>

        </div>

      </section>

      {/* ======================================================
          WALLET ACTIONS
      ====================================================== */}

      <section className="wallet-detail-actions-section">

        <div className="wallet-detail-section-heading">

          <div>

            <h2>
              Wallet Actions
            </h2>

            <p>
              Perform financial operations
              securely.
            </p>

          </div>

        </div>

        <div className="wallet-detail-actions-grid">

          {/* DEPOSIT */}

          <button
            type="button"
            onClick={() =>
              openModal('deposit')
            }
            className="wallet-detail-action-card"
            disabled={
              !canPerformFinancialActions ||
              submitting
            }
          >
            <div className="wallet-detail-action-icon deposit">
              <ArrowDownToLine size={22} />
            </div>

            <div>
              <strong>
                Deposit Money
              </strong>

              <span>
                Add funds to this wallet
              </span>
            </div>
          </button>

          {/* WITHDRAW */}

          <button
            type="button"
            onClick={() =>
              openModal('withdraw')
            }
            className="wallet-detail-action-card"
            disabled={
              !canPerformFinancialActions ||
              submitting ||
              getNumericBalance(
                wallet.balance,
              ) <= 0
            }
          >
            <div className="wallet-detail-action-icon withdraw">
              <ArrowUpFromLine size={22} />
            </div>

            <div>
              <strong>
                Withdraw Money
              </strong>

              <span>
                Withdraw available funds
              </span>
            </div>
          </button>

          {/* TRANSFER */}

          <button
            type="button"
            onClick={() =>
              openModal('transfer')
            }
            className="wallet-detail-action-card"
            disabled={
              !canPerformFinancialActions ||
              submitting ||
              destinationWallets.length === 0 ||
              getNumericBalance(
                wallet.balance,
              ) <= 0
            }
          >
            <div className="wallet-detail-action-icon transfer">
              <ArrowLeftRight size={22} />
            </div>

            <div>
              <strong>
                Transfer Money
              </strong>

              <span>
                {destinationWallets.length === 0
                  ? 'No compatible wallet available'
                  : 'Send funds to another wallet'}
              </span>
            </div>
          </button>

        </div>

      </section>

      {/* ======================================================
          TRANSACTION HISTORY
      ====================================================== */}

      <section className="wallet-detail-history">

        <div className="wallet-detail-history-header">

          <div>

            <div className="wallet-detail-section-icon">
              <ReceiptText size={20} />
            </div>

            <div>

              <h2>
                Transaction History
              </h2>

              <p>
                Recent financial activity
                associated with this wallet.
              </p>

            </div>

          </div>

          <Link
            href="/transactions"
            className="wallet-detail-view-all"
          >
            View All
            <Eye size={17} />
          </Link>

        </div>

        {transactions.length === 0 ? (

          <div className="wallet-detail-empty">

            <div className="wallet-detail-empty-icon">
              <ReceiptText size={38} />
            </div>

            <h3>
              No transactions yet
            </h3>

            <p>
              Your wallet transactions will
              appear here once activity begins.
            </p>

          </div>

        ) : (

          <div className="wallet-detail-transaction-list">

            {transactions.map(
              (transaction) => {
                const direction =
                  getTransactionDirection(
                    transaction,
                    wallet.id,
                  );

                const transactionCurrency =
                  transaction.currency ||
                  wallet.currency;

                return (
                  <Link
                    key={transaction.id}
                    href={`/transactions/${transaction.id}`}
                    className="wallet-detail-transaction-item"
                  >

                    <div
                      className={`wallet-detail-transaction-icon ${direction}`}
                    >
                      {direction ===
                      'credit' ? (
                        <ArrowDownToLine
                          size={19}
                        />
                      ) : (
                        <ArrowUpFromLine
                          size={19}
                        />
                      )}
                    </div>

                    <div className="wallet-detail-transaction-info">

                      <strong>
                        {transaction.type || 'TRANSACTION'}
                      </strong>

                      <span>
                        {transaction.reference ||
                          `Transaction #${transaction.id}`}
                      </span>

                      <small>
                        <Calendar size={13} />

                        {formatDateTime(
                          transaction.createdAt,
                        )}
                      </small>

                    </div>

                    <div className="wallet-detail-transaction-right">

                      <strong
                        className={
                          direction ===
                          'credit'
                            ? 'wallet-detail-credit'
                            : 'wallet-detail-debit'
                        }
                      >
                        {direction ===
                        'credit'
                          ? '+'
                          : '-'}

                        {formatCurrency(
                          transaction.amount,
                          transactionCurrency,
                        )}
                      </strong>

                      <span
                        className={`wallet-detail-transaction-status ${
                          transaction.status?.toLowerCase() ||
                          'unknown'
                        }`}
                      >
                        {transaction.status ||
                          'UNKNOWN'}
                      </span>

                    </div>

                  </Link>
                );
              },
            )}

          </div>

        )}

      </section>

      {/* ======================================================
          DEPOSIT MODAL
      ====================================================== */}

      {modal === 'deposit' && (

        <div
          className="wallet-detail-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deposit-modal-title"
        >

          <div className="wallet-detail-modal">

            <div className="wallet-detail-modal-header">

              <div className="wallet-detail-modal-title">

                <div className="wallet-detail-modal-icon deposit">
                  <ArrowDownToLine size={21} />
                </div>

                <div>

                  <h2 id="deposit-modal-title">
                    Deposit Money
                  </h2>

                  <p>
                    Add funds to your{' '}
                    {wallet.currency} wallet.
                  </p>

                </div>

              </div>

              <button
                type="button"
                className="wallet-detail-modal-close"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Close deposit modal"
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={handleDeposit}
            >

              {modalError && (
                <div
                  className="wallet-detail-modal-error"
                  role="alert"
                >
                  {modalError}
                </div>
              )}

              <div className="wallet-detail-form-field">

                <label htmlFor="deposit-amount">
                  Deposit Amount
                </label>

                <div className="wallet-detail-input-wrapper">

                  <span>
                    {wallet.currency}
                  </span>

                  <input
                    id="deposit-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) =>
                      setAmount(
                        event.target.value,
                      )
                    }
                    required
                    disabled={submitting}
                  />

                </div>

              </div>

              <div className="wallet-detail-modal-actions">

                <button
                  type="button"
                  className="wallet-detail-secondary-button"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="wallet-detail-primary-button"
                  disabled={submitting}
                >
                  {submitting &&
                    activeAction ===
                      'deposit' && (
                      <Loader2
                        size={17}
                        className="wallet-detail-spinning"
                      />
                    )}

                  {submitting
                    ? 'Processing...'
                    : 'Deposit Money'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ======================================================
          WITHDRAW MODAL
      ====================================================== */}

      {modal === 'withdraw' && (

        <div
          className="wallet-detail-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-modal-title"
        >

          <div className="wallet-detail-modal">

            <div className="wallet-detail-modal-header">

              <div className="wallet-detail-modal-title">

                <div className="wallet-detail-modal-icon withdraw">
                  <ArrowUpFromLine size={21} />
                </div>

                <div>

                  <h2 id="withdraw-modal-title">
                    Withdraw Money
                  </h2>

                  <p>
                    Withdraw funds from your{' '}
                    {wallet.currency} wallet.
                  </p>

                </div>

              </div>

              <button
                type="button"
                className="wallet-detail-modal-close"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Close withdrawal modal"
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={handleWithdraw}
            >

              {modalError && (
                <div
                  className="wallet-detail-modal-error"
                  role="alert"
                >
                  {modalError}
                </div>
              )}

              <div className="wallet-detail-current-balance">

                <span>
                  Available Balance
                </span>

                <strong>
                  {formatCurrency(
                    wallet.balance,
                    wallet.currency,
                  )}
                </strong>

              </div>

              <div className="wallet-detail-form-field">

                <label htmlFor="withdraw-amount">
                  Withdrawal Amount
                </label>

                <div className="wallet-detail-input-wrapper">

                  <span>
                    {wallet.currency}
                  </span>

                  <input
                    id="withdraw-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    max={getNumericBalance(
                      wallet.balance,
                    )}
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) =>
                      setAmount(
                        event.target.value,
                      )
                    }
                    required
                    disabled={submitting}
                  />

                </div>

              </div>

              <div className="wallet-detail-modal-actions">

                <button
                  type="button"
                  className="wallet-detail-secondary-button"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="wallet-detail-danger-button"
                  disabled={submitting}
                >
                  {submitting &&
                    activeAction ===
                      'withdraw' && (
                      <Loader2
                        size={17}
                        className="wallet-detail-spinning"
                      />
                    )}

                  {submitting
                    ? 'Processing...'
                    : 'Withdraw Money'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ======================================================
          TRANSFER MODAL
      ====================================================== */}

      {modal === 'transfer' && (

        <div
          className="wallet-detail-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-modal-title"
        >

          <div className="wallet-detail-modal">

            <div className="wallet-detail-modal-header">

              <div className="wallet-detail-modal-title">

                <div className="wallet-detail-modal-icon transfer">
                  <ArrowLeftRight size={21} />
                </div>

                <div>

                  <h2 id="transfer-modal-title">
                    Transfer Money
                  </h2>

                  <p>
                    Transfer funds securely to
                    another wallet.
                  </p>

                </div>

              </div>

              <button
                type="button"
                className="wallet-detail-modal-close"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Close transfer modal"
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={handleTransfer}
            >

              {modalError && (
                <div
                  className="wallet-detail-modal-error"
                  role="alert"
                >
                  {modalError}
                </div>
              )}

              <div className="wallet-detail-form-field">

                <label>
                  From Wallet
                </label>

                <div className="wallet-detail-readonly-field">

                  <WalletIcon size={18} />

                  <span>
                    {wallet.currency} Wallet
                  </span>

                  <strong>
                    {formatCurrency(
                      wallet.balance,
                      wallet.currency,
                    )}
                  </strong>

                </div>

              </div>

              <div className="wallet-detail-form-field">

                <label htmlFor="destination-wallet">
                  Destination Wallet
                </label>

                <select
                  id="destination-wallet"
                  value={
                    destinationWalletId
                  }
                  onChange={(event) =>
                    setDestinationWalletId(
                      event.target.value,
                    )
                  }
                  required
                  disabled={submitting}
                >

                  <option value="">
                    Select destination wallet
                  </option>

                  {destinationWallets.map(
                    (item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.currency} Wallet
                        {' — '}
                        {item.account
                          ?.accountNumber
                          ? item.account
                              .accountNumber
                          : `Wallet #${item.id}`}
                      </option>
                    ),
                  )}

                </select>

              </div>

              {destinationWallets.length ===
                0 && (
                <div className="wallet-detail-modal-error">
                  No active wallet with the
                  same currency is available
                  for transfer.
                </div>
              )}

              <div className="wallet-detail-form-field">

                <label htmlFor="transfer-amount">
                  Transfer Amount
                </label>

                <div className="wallet-detail-input-wrapper">

                  <span>
                    {wallet.currency}
                  </span>

                  <input
                    id="transfer-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    max={getNumericBalance(
                      wallet.balance,
                    )}
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) =>
                      setAmount(
                        event.target.value,
                      )
                    }
                    required
                    disabled={submitting}
                  />

                </div>

              </div>

              <div className="wallet-detail-modal-actions">

                <button
                  type="button"
                  className="wallet-detail-secondary-button"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="wallet-detail-primary-button"
                  disabled={
                    submitting ||
                    destinationWallets.length ===
                      0
                  }
                >
                  {submitting &&
                    activeAction ===
                      'transfer' && (
                      <Loader2
                        size={17}
                        className="wallet-detail-spinning"
                      />
                    )}

                  {submitting
                    ? 'Processing...'
                    : 'Transfer Money'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

/* ============================================================
   TRANSACTION DIRECTION HELPER
============================================================ */

function getTransactionDirection(
  transaction: Transaction,
  walletId: number,
): TransactionDirection {
  /*
   * Deposits are always credits to the wallet.
   */
  if (
    transaction.type ===
    'DEPOSIT'
  ) {
    return 'credit';
  }

  /*
   * Withdrawals are always debits from
   * the wallet.
   */
  if (
    transaction.type ===
    'WITHDRAWAL'
  ) {
    return 'debit';
  }

  /*
   * If this wallet is the destination,
   * money is coming in.
   */
  if (
    transaction.destinationWalletId ===
    walletId
  ) {
    return 'credit';
  }

  /*
   * Otherwise, if this wallet is involved
   * as the source, money is going out.
   */
  return 'debit';
}
