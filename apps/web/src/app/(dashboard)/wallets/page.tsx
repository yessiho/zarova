
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CircleDollarSign,
  Copy,
  CreditCard,
  Eye,
  Landmark,
  Plus,
  RefreshCw,
  WalletCards,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

type Currency =
  | 'NGN'
  | 'USD'
  | 'EUR'
  | 'GBP';

type WalletStatus =
  | 'ACTIVE'
  | 'FROZEN'
  | 'CLOSED';

type WalletAccountType =
  | 'SAVINGS'
  | 'CURRENT'
  | 'VIRTUAL';

type WalletAccountStatus =
  | 'ACTIVE'
  | 'FROZEN'
  | 'SUSPENDED'
  | 'CLOSED';

type WalletAccount = {
  id: number;
  walletId: number;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string | null;
  accountType: WalletAccountType;
  status: WalletAccountStatus;
  createdAt: string;
  updatedAt: string;
};

type Wallet = {
  id: number;
  userId: number;
  currency: Currency;
  balance: string;
  status: WalletStatus;
  createdAt: string;
  updatedAt: string;
  account: WalletAccount | null;
};

type TransferRecipient = {
  walletId: number;
  userId: number;
  accountNumber: string;
  accountName: string;
  bankName: string;
  currency: Currency;
  status: WalletStatus;
};

type ModalType =
  | 'CREATE'
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'TRANSFER'
  | null;

type ApiError = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

// ============================================================
// CONSTANTS
// ============================================================

const CURRENCIES: Currency[] = [
  'NGN',
  'USD',
  'EUR',
  'GBP',
];

const CURRENCY_NAMES: Record<
  Currency,
  string
> = {
  NGN: 'Nigerian Naira',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
};

const CURRENCY_SYMBOLS: Record<
  Currency,
  string
> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
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
// NUMBER HELPERS
// ============================================================

function parseAmount(
  value: string,
): number {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? amount
    : 0;
}

function isValidAmount(
  value: string,
): boolean {
  const amount = parseAmount(value);

  return (
    Number.isFinite(amount) &&
    amount > 0
  );
}

// ============================================================
// COMPONENT
// ============================================================

export default function WalletsPage() {
  const router = useRouter();

  // ============================================================
  // STATE
  // ============================================================

  const [wallets, setWallets] =
    useState<Wallet[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [modal, setModal] =
    useState<ModalType>(null);

  const [selectedWallet, setSelectedWallet] =
    useState<Wallet | null>(null);

  const [currency, setCurrency] =
    useState<Currency>('NGN');

  const [amount, setAmount] =
    useState('');

  const [recipientAccountNumber, setRecipientAccountNumber] =
    useState('');

  const [transferRecipient, setTransferRecipient] =
    useState<TransferRecipient | null>(null);

  const [recipientLoading, setRecipientLoading] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  // ============================================================
  // LOAD WALLETS
  // ============================================================

  const loadWallets = useCallback(
    async (
      isRefresh = false,
    ) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        const data =
          await apiFetch<Wallet[]>(
            '/wallets',
          );

        if (!Array.isArray(data)) {
          setWallets([]);

          throw new Error(
            'The wallet service returned an invalid response.',
          );
        }

        setWallets(data);
      } catch (error: unknown) {
        console.error(
          'LOAD WALLETS ERROR:',
          error,
        );

        setError(
          getErrorMessage(
            error,
            'Unable to load wallets. Please try again.',
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  // ============================================================
  // REFRESH
  // ============================================================

  function handleRefresh() {
    void loadWallets(true);
  }

  // ============================================================
  // MODAL
  // ============================================================

  function openModal(
    type: ModalType,
    wallet?: Wallet,
  ) {
    setSelectedWallet(
      wallet ?? null,
    );

    setAmount('');

    setRecipientAccountNumber('');

    setTransferRecipient(null);

    setError('');

    setSuccess('');

    setModal(type);
  }

  function closeModal() {
    if (submitting) {
      return;
    }

    setModal(null);

    setSelectedWallet(null);

    setAmount('');

    setRecipientAccountNumber('');

    setTransferRecipient(null);

    setError('');

    setSuccess('');
  }

  // ============================================================
  // COPY ACCOUNT NUMBER
  // ============================================================

  async function copyAccountNumber(
    accountNumber?: string,
  ) {
    if (!accountNumber) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        accountNumber,
      );

      setSuccess(
        'Account number copied successfully.',
      );

      window.setTimeout(() => {
        setSuccess('');
      }, 2500);
    } catch {
      setError(
        'Unable to copy account number.',
      );
    }
  }

  // ============================================================
  // FORMATTERS
  // ============================================================

  function getCurrencySymbol(
    walletCurrency: Currency,
  ) {
    return CURRENCY_SYMBOLS[
      walletCurrency
    ];
  }

  function getCurrencyName(
    walletCurrency: Currency,
  ) {
    return CURRENCY_NAMES[
      walletCurrency
    ];
  }

  function getCurrencyClass(
    walletCurrency: Currency,
  ) {
    return `currency-${walletCurrency.toLowerCase()}`;
  }

  function formatBalance(
    wallet: Wallet,
  ) {
    const value =
      parseAmount(wallet.balance);

    try {
      return new Intl.NumberFormat(
        'en-NG',
        {
          style: 'currency',
          currency: wallet.currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      ).format(value);
    } catch {
      return `${getCurrencySymbol(
        wallet.currency,
      )}${value.toFixed(2)}`;
    }
  }

  function formatCurrencyAmount(
    amountValue: number,
    walletCurrency: Currency,
  ) {
    try {
      return new Intl.NumberFormat(
        'en-NG',
        {
          style: 'currency',
          currency: walletCurrency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      ).format(amountValue);
    } catch {
      return `${getCurrencySymbol(
        walletCurrency,
      )}${amountValue.toFixed(2)}`;
    }
  }

  function formatNumber(
    value: number,
  ) {
    return new Intl.NumberFormat(
      'en-NG',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(value);
  }

  function formatDate(
    value: string,
  ) {
    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return '—';
    }

    return date.toLocaleDateString(
      'en-NG',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    );
  }

  // ============================================================
  // CREATE WALLET
  // ============================================================

  const existingCurrencies =
    useMemo(
      () =>
        new Set(
          wallets.map(
            (wallet) =>
              wallet.currency,
          ),
        ),
      [wallets],
    );

  const availableCurrencies =
    useMemo(
      () =>
        CURRENCIES.filter(
          (item) =>
            !existingCurrencies.has(
              item,
            ),
        ),
      [existingCurrencies],
    );

  async function createWallet() {
    if (
      existingCurrencies.has(
        currency,
      )
    ) {
      setError(
        `You already have a ${currency} wallet.`,
      );

      return;
    }

    try {
      setSubmitting(true);

      setError('');

      await apiFetch(
        '/wallets',
        {
          method: 'POST',

          body: JSON.stringify({
            currency,
          }),
        },
      );

      setSuccess(
        `${currency} wallet created successfully.`,
      );

      await loadWallets();

      window.setTimeout(() => {
        closeModal();
      }, 1000);
    } catch (error: unknown) {
      console.error(
        'CREATE WALLET ERROR:',
        error,
      );

      setError(
        getErrorMessage(
          error,
          'Unable to create wallet.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // DEPOSIT
  // ============================================================

  async function depositMoney() {
    if (!selectedWallet) {
      return;
    }

    if (
      selectedWallet.status !==
      'ACTIVE'
    ) {
      setError(
        'This wallet is not active.',
      );

      return;
    }

    if (
      !isValidAmount(amount)
    ) {
      setError(
        'Please enter a valid deposit amount greater than zero.',
      );

      return;
    }

    const depositAmount =
      parseAmount(amount);

    try {
      setSubmitting(true);

      setError('');

      await apiFetch(
        `/wallets/${selectedWallet.id}/deposit`,
        {
          method: 'POST',

          body: JSON.stringify({
            amount: depositAmount,
          }),
        },
      );

      setSuccess(
        `${formatCurrencyAmount(
          depositAmount,
          selectedWallet.currency,
        )} deposited successfully.`,
      );

      await loadWallets();

      window.setTimeout(() => {
        closeModal();
      }, 1000);
    } catch (error: unknown) {
      console.error(
        'DEPOSIT ERROR:',
        error,
      );

      setError(
        getErrorMessage(
          error,
          'Unable to complete deposit.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // WITHDRAW
  // ============================================================

  async function withdrawMoney() {
    if (!selectedWallet) {
      return;
    }

    if (
      selectedWallet.status !==
      'ACTIVE'
    ) {
      setError(
        'This wallet is not active.',
      );

      return;
    }

    if (
      !isValidAmount(amount)
    ) {
      setError(
        'Please enter a valid withdrawal amount greater than zero.',
      );

      return;
    }

    const withdrawalAmount =
      parseAmount(amount);

    const availableBalance =
      parseAmount(
        selectedWallet.balance,
      );

    if (
      withdrawalAmount >
      availableBalance
    ) {
      setError(
        `Insufficient balance. Available balance is ${formatBalance(
          selectedWallet,
        )}.`,
      );

      return;
    }

    try {
      setSubmitting(true);

      setError('');

      await apiFetch(
        `/wallets/${selectedWallet.id}/withdraw`,
        {
          method: 'POST',

          body: JSON.stringify({
            amount: withdrawalAmount,
          }),
        },
      );

      setSuccess(
        `${formatCurrencyAmount(
          withdrawalAmount,
          selectedWallet.currency,
        )} withdrawn successfully.`,
      );

      await loadWallets();

      window.setTimeout(() => {
        closeModal();
      }, 1000);
    } catch (error: unknown) {
      console.error(
        'WITHDRAW ERROR:',
        error,
      );

      setError(
        getErrorMessage(
          error,
          'Unable to complete withdrawal.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // TRANSFER
  // ============================================================

  async function findTransferRecipient() {
    const accountNumber =
      recipientAccountNumber.trim();

    if (!/^\d{10}$/.test(accountNumber)) {
      setTransferRecipient(null);

      setError(
        'Enter a valid 10-digit recipient account number.',
      );

      return;
    }

    try {
      setRecipientLoading(true);

      setError('');

      const recipient =
        await apiFetch<TransferRecipient>(
          `/wallets/recipient?accountNumber=${encodeURIComponent(
            accountNumber,
          )}`,
        );

      if (
        recipient.currency !==
        selectedWallet?.currency
      ) {
        setTransferRecipient(null);

        setError(
          `Recipient has a ${recipient.currency} wallet. You can only transfer ${selectedWallet?.currency} from this wallet.`,
        );

        return;
      }

      setTransferRecipient(recipient);
    } catch (error: unknown) {
      console.error(
        'RECIPIENT LOOKUP ERROR:',
        error,
      );

      setTransferRecipient(null);

      setError(
        getErrorMessage(
          error,
          'Unable to find recipient.',
        ),
      );
    } finally {
      setRecipientLoading(false);
    }
  }

  async function transferMoney() {
    if (!selectedWallet) {
      return;
    }

    if (
      selectedWallet.status !==
      'ACTIVE'
    ) {
      setError(
        'This wallet is not active.',
      );

      return;
    }

    if (!transferRecipient) {
      setError(
        'Find and confirm a recipient before transferring.',
      );

      return;
    }

    if (
      transferRecipient.currency !==
      selectedWallet.currency
    ) {
      setError(
        `Recipient has a ${transferRecipient.currency} wallet. You can only transfer ${selectedWallet.currency} from this wallet.`,
      );

      return;
    }

    if (
      !isValidAmount(amount)
    ) {
      setError(
        'Please enter a valid transfer amount greater than zero.',
      );

      return;
    }

    const transferAmount =
      parseAmount(amount);

    const availableBalance =
      parseAmount(
        selectedWallet.balance,
      );

    if (
      transferAmount >
      availableBalance
    ) {
      setError(
        `Insufficient balance. Available balance is ${formatBalance(
          selectedWallet,
        )}.`,
      );

      return;
    }

    try {
      setSubmitting(true);

      setError('');

      await apiFetch(
        `/wallets/${selectedWallet.id}/transfer`,
        {
          method: 'POST',

          body: JSON.stringify({
            destinationWalletId:
              transferRecipient.walletId,

            amount:
              transferAmount,
          }),
        },
      );

      setSuccess(
        `${formatCurrencyAmount(
          transferAmount,
          selectedWallet.currency,
        )} sent to ${transferRecipient.accountName}.`,
      );

      await loadWallets();

      window.setTimeout(() => {
        closeModal();
      }, 1000);
    } catch (error: unknown) {
      console.error(
        'TRANSFER ERROR:',
        error,
      );

      setError(
        getErrorMessage(
          error,
          'Unable to complete transfer.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // SUBMIT
  // ============================================================

  function handleSubmit() {
    if (submitting) {
      return;
    }

    switch (modal) {
      case 'CREATE':
        void createWallet();
        break;

      case 'DEPOSIT':
        void depositMoney();
        break;

      case 'WITHDRAW':
        void withdrawMoney();
        break;

      case 'TRANSFER':
        void transferMoney();
        break;

      default:
        break;
    }
  }

  // ============================================================
  // MULTI-CURRENCY SUMMARY
  //
  // IMPORTANT:
  //
  // Never add NGN + USD + EUR + GBP together.
  // Each currency is displayed independently.
  // ============================================================

  const balancesByCurrency =
    useMemo(() => {
      return CURRENCIES.map(
        (item) => {
          const wallet =
            wallets.find(
              (entry) =>
                entry.currency ===
                item,
            );

          return {
            currency: item,
            wallet,
            balance: wallet
              ? parseAmount(
                  wallet.balance,
                )
              : 0,
          };
        },
      );
    }, [wallets]);

  const activeWallets =
    wallets.filter(
      (wallet) =>
        wallet.status ===
        'ACTIVE',
    ).length;

  const currenciesAvailable =
    new Set(
      wallets.map(
        (wallet) =>
          wallet.currency,
      ),
    ).size;

  const walletsWithAccounts =
    wallets.filter(
      (wallet) =>
        wallet.account !== null,
    ).length;

  // ============================================================
  // FORM VALIDATION
  // ============================================================

  const amountValue =
    parseAmount(amount);

  const selectedBalance =
    selectedWallet
      ? parseAmount(
          selectedWallet.balance,
        )
      : 0;

  const amountExceedsBalance =
    (modal === 'WITHDRAW' ||
      modal === 'TRANSFER') &&
    amountValue >
      selectedBalance;

  const canSubmit =
    modal === 'CREATE'
      ? !existingCurrencies.has(
          currency,
        )
      : modal === 'TRANSFER'
        ? isValidAmount(
            amount,
          ) &&
          Boolean(
            transferRecipient,
          ) &&
          !amountExceedsBalance
        : isValidAmount(
            amount,
          ) &&
          !(
            modal ===
              'WITHDRAW' &&
            amountExceedsBalance
          );

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="wallets-page">

      {/* ======================================================
          PAGE HEADER
      ======================================================= */}

      <section className="wallets-page-header">

        <div className="wallets-header-content">

          <div className="wallets-header-icon">
            <WalletCards
              size={26}
            />
          </div>

          <div>
            <div className="page-eyebrow">
              Financial Management
            </div>

            <h1>
              My Wallets
            </h1>

            <p>
              Manage your balances,
              virtual accounts,
              deposits, withdrawals
              and transfers from one
              secure place.
            </p>
          </div>

        </div>

        <div className="wallets-header-actions">

          <button
            type="button"
            className="wallet-secondary-button"
            onClick={
              handleRefresh
            }
            disabled={
              refreshing
            }
          >
            <RefreshCw
              size={18}
              className={
                refreshing
                  ? 'spin'
                  : ''
              }
            />

            <span>
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </span>
          </button>

          <button
            type="button"
            className="wallet-primary-button"
            onClick={() =>
              openModal(
                'CREATE',
              )
            }
            disabled={
              availableCurrencies.length ===
              0
            }
          >
            <Plus size={18} />

            <span>
              Create Wallet
            </span>
          </button>

        </div>

      </section>

      {/* ======================================================
          GLOBAL ERROR
      ======================================================= */}

      {error && !modal && (
        <div
          className="wallet-alert wallet-alert-error"
          role="alert"
        >
          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError('')
            }
            aria-label="Close error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* ======================================================
          GLOBAL SUCCESS
      ======================================================= */}

      {success && !modal && (
        <div
          className="wallet-alert wallet-alert-success"
          role="status"
        >
          <span>
            {success}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccess('')
            }
            aria-label="Close success"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* ======================================================
          SUMMARY
      ======================================================= */}

      {!loading && (
        <section className="wallet-summary-grid">

          {/* MULTI-CURRENCY BALANCES */}

          <div className="wallet-summary-card wallet-summary-primary">

            <div className="wallet-summary-icon">
              <Landmark
                size={22}
              />
            </div>

            <div className="wallet-summary-content">

              <span>
                Currency Balances
              </span>

              <div className="wallet-currency-summary-list">

                {balancesByCurrency.map(
                  ({
                    currency: item,
                    wallet,
                    balance,
                  }) => (
                    <div
                      key={item}
                      className="wallet-currency-summary-item"
                    >
                      <span>
                        {item}
                      </span>

                      <strong>
                        {wallet
                          ? formatCurrencyAmount(
                              balance,
                              item,
                            )
                          : '—'}
                      </strong>
                    </div>
                  ),
                )}

              </div>

              <small>
                Balances are shown
                separately by currency.
              </small>

            </div>

          </div>

          {/* TOTAL WALLETS */}

          <div className="wallet-summary-card">

            <div className="wallet-summary-icon summary-blue">
              <WalletCards
                size={21}
              />
            </div>

            <div className="wallet-summary-content">

              <span>
                Total Wallets
              </span>

              <strong>
                {wallets.length}
              </strong>

              <small>
                Financial wallets
                created
              </small>

            </div>

          </div>

          {/* VIRTUAL ACCOUNTS */}

          <div className="wallet-summary-card">

            <div className="wallet-summary-icon summary-green">
              <CreditCard
                size={21}
              />
            </div>

            <div className="wallet-summary-content">

              <span>
                Virtual Accounts
              </span>

              <strong>
                {walletsWithAccounts}
              </strong>

              <small>
                Accounts successfully
                assigned
              </small>

            </div>

          </div>

          {/* ACTIVE WALLETS */}

          <div className="wallet-summary-card">

            <div className="wallet-summary-icon summary-purple">
              <CircleDollarSign
                size={21}
              />
            </div>

            <div className="wallet-summary-content">

              <span>
                Active Wallets
              </span>

              <strong>
                {activeWallets}
              </strong>

              <small>
                {currenciesAvailable}{' '}
                {currenciesAvailable ===
                1
                  ? 'currency'
                  : 'currencies'}{' '}
                available
              </small>

            </div>

          </div>

        </section>
      )}

      {/* ======================================================
          WALLET CONTENT
      ======================================================= */}

      <section className="wallets-content-section">

        <div className="wallets-section-header">

          <div>

            <h2>
              Your Financial
              Wallets
            </h2>

            <p>
              View balances,
              virtual account
              details and manage
              your available
              wallets.
            </p>

          </div>

          <div className="wallet-count-badge">
            {wallets.length}{' '}
            {wallets.length ===
            1
              ? 'Wallet'
              : 'Wallets'}
          </div>

        </div>

        {/* LOADING */}

        {loading ? (

          <div className="wallets-loading-state">

            <div className="wallet-loading-spinner" />

            <h3>
              Loading your
              wallets
            </h3>

            <p>
              Please wait while
              we retrieve your
              financial accounts.
            </p>

          </div>

        ) : wallets.length ===
          0 ? (

          /* EMPTY STATE */

          <div className="wallets-empty-state">

            <div className="empty-wallet-icon">
              <WalletCards
                size={42}
              />
            </div>

            <h3>
              No wallets
              available yet
            </h3>

            <p>
              Create your first
              wallet and start
              managing your
              finances securely.
            </p>

            <button
              type="button"
              className="wallet-primary-button"
              onClick={() =>
                openModal(
                  'CREATE',
                )
              }
            >
              <Plus size={18} />

              Create Your First
              Wallet
            </button>

          </div>

        ) : (

          /* WALLET GRID */

          <div className="fin-wallet-grid">

            {wallets.map(
              (wallet) => (

                <article
                  key={
                    wallet.id
                  }
                  className="fin-wallet-card"
                >

                  {/* CARD TOP */}

                  <div className="fin-wallet-card-top">

                    <div className="fin-wallet-identity">

                      <div
                        className={`fin-wallet-currency-icon ${getCurrencyClass(
                          wallet.currency,
                        )}`}
                      >
                        {getCurrencySymbol(
                          wallet.currency,
                        )}
                      </div>

                      <div>

                        <h3>
                          {
                            wallet.currency
                          }{' '}
                          Wallet
                        </h3>

                        <span>
                          {
                            getCurrencyName(
                              wallet.currency,
                            )
                          }
                        </span>

                      </div>

                    </div>

                    <span
                      className={`fin-wallet-status ${wallet.status.toLowerCase()}`}
                    >
                      <span className="status-dot" />

                      {
                        wallet.status
                      }
                    </span>

                  </div>

                  {/* BALANCE */}

                  <div className="fin-wallet-balance">

                    <span>
                      Available Balance
                    </span>

                    <h2>
                      {
                        formatBalance(
                          wallet,
                        )
                      }
                    </h2>

                  </div>

                  {/* VIRTUAL ACCOUNT */}

                  {wallet.account ? (

                    <div className="wallet-account-details">

                      <div className="wallet-account-header">

                        <div>

                          <span className="wallet-account-label">
                            Virtual
                            Account
                          </span>

                          <strong>
                            {
                              wallet
                                .account
                                .bankName
                            }
                          </strong>

                        </div>

                        <CreditCard
                          size={
                            20
                          }
                        />

                      </div>

                      <div className="wallet-account-number-row">

                        <div>

                          <span>
                            Account
                            Number
                          </span>

                          <strong className="wallet-account-number">
                            {
                              wallet
                                .account
                                .accountNumber
                            }
                          </strong>

                        </div>

                        <button
                          type="button"
                          className="copy-account-button"
                          onClick={() =>
                            void copyAccountNumber(
                              wallet
                                .account
                                ?.accountNumber,
                            )
                          }
                          title="Copy account number"
                          aria-label="Copy account number"
                        >
                          <Copy
                            size={
                              17
                            }
                          />
                        </button>

                      </div>

                      <div className="wallet-account-info">

                        <div>

                          <span>
                            Account
                            Name
                          </span>

                          <strong>
                            {
                              wallet
                                .account
                                .accountName
                            }
                          </strong>

                        </div>

                        <div>

                          <span>
                            Account
                            Type
                          </span>

                          <strong>
                            {
                              wallet
                                .account
                                .accountType
                            }
                          </strong>

                        </div>

                      </div>

                    </div>

                  ) : (

                    <div className="wallet-no-account">

                      <CreditCard
                        size={
                          18
                        }
                      />

                      <div>

                        <strong>
                          Account
                          number
                          pending
                        </strong>

                        <span>
                          Refresh to
                          retrieve
                          account
                          details.
                        </span>

                      </div>

                    </div>

                  )}

                  {/* META */}

                  <div className="fin-wallet-meta">

                    <div className="fin-wallet-meta-item">

                      <span>
                        Wallet ID
                      </span>

                      <strong>
                        #
                        {
                          wallet.id
                        }
                      </strong>

                    </div>

                    <div className="fin-wallet-meta-item">

                      <span>
                        Created
                      </span>

                      <strong>
                        {
                          formatDate(
                            wallet.createdAt,
                          )
                        }
                      </strong>

                    </div>

                  </div>

                  <div className="wallet-card-divider" />

                  {/* ACTIONS */}

                  <div className="fin-wallet-actions">

                    <button
                      type="button"
                      className="fin-wallet-action"
                      onClick={() =>
                        router.push(
                          `/wallets/${wallet.id}`,
                        )
                      }
                    >
                      <Eye
                        size={
                          17
                        }
                      />

                      <span>
                        View
                      </span>
                    </button>

                    <button
                      type="button"
                      className="fin-wallet-action"
                      onClick={() =>
                        openModal(
                          'DEPOSIT',
                          wallet,
                        )
                      }
                      disabled={
                        wallet.status !==
                        'ACTIVE'
                      }
                    >
                      <ArrowDownToLine
                        size={
                          17
                        }
                      />

                      <span>
                        Deposit
                      </span>
                    </button>

                    <button
                      type="button"
                      className="fin-wallet-action"
                      onClick={() =>
                        openModal(
                          'WITHDRAW',
                          wallet,
                        )
                      }
                      disabled={
                        wallet.status !==
                        'ACTIVE'
                      }
                    >
                      <ArrowUpFromLine
                        size={
                          17
                        }
                      />

                      <span>
                        Withdraw
                      </span>
                    </button>

                    <button
                      type="button"
                      className="fin-wallet-action"
                      onClick={() =>
                        openModal(
                          'TRANSFER',
                          wallet,
                        )
                      }
                      disabled={
                        wallet.status !==
                        'ACTIVE'
                      }
                    >
                      <ArrowLeftRight
                        size={
                          17
                        }
                      />

                      <span>
                        Transfer
                      </span>
                    </button>

                  </div>

                </article>
              ),
            )}

          </div>
        )}

      </section>

      {/* ======================================================
          WALLET MODAL
      ======================================================= */}

      {modal && (

        <div
          className="wallet-modal-overlay"
          onClick={closeModal}
        >

          <div
            className="wallet-management-modal"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div className="wallet-modal-header">

              <div>

                <span className="modal-eyebrow">
                  Wallet Management
                </span>

                <h2>

                  {modal ===
                    'CREATE' &&
                    'Create New Wallet'}

                  {modal ===
                    'DEPOSIT' &&
                    'Deposit Money'}

                  {modal ===
                    'WITHDRAW' &&
                    'Withdraw Money'}

                  {modal ===
                    'TRANSFER' &&
                    'Transfer Money'}

                </h2>

                <p>

                  {modal ===
                    'CREATE' &&
                    'Select the currency for your new financial wallet.'}

                  {modal ===
                    'DEPOSIT' &&
                    'Add funds securely to your selected wallet.'}

                  {modal ===
                    'WITHDRAW' &&
                    'Withdraw funds from your selected wallet.'}

                  {modal ===
                    'TRANSFER' &&
                    'Move funds between wallets of the same currency.'}

                </p>

              </div>

              <button
                type="button"
                className="wallet-modal-close"
                onClick={
                  closeModal
                }
                disabled={
                  submitting
                }
                aria-label="Close modal"
              >
                <X
                  size={20}
                />
              </button>

            </div>

            {/* SELECTED WALLET */}

            {selectedWallet && (

              <div className="modal-selected-wallet">

                <div
                  className={`modal-wallet-icon ${getCurrencyClass(
                    selectedWallet.currency,
                  )}`}
                >
                  {
                    getCurrencySymbol(
                      selectedWallet.currency,
                    )
                  }
                </div>

                <div>

                  <span>
                    Selected Wallet
                  </span>

                  <strong>
                    {
                      selectedWallet.currency
                    }{' '}
                    Wallet #
                    {
                      selectedWallet.id
                    }
                  </strong>

                </div>

                <div className="modal-wallet-balance">

                  <span>
                    Available
                  </span>

                  <strong>
                    {
                      formatBalance(
                        selectedWallet,
                      )
                    }
                  </strong>

                </div>

              </div>
            )}

            {/* MODAL ERROR */}

            {error && (

              <div
                className="wallet-modal-alert error"
                role="alert"
              >
                {error}
              </div>

            )}

            {/* MODAL SUCCESS */}

            {success && (

              <div
                className="wallet-modal-alert success"
                role="status"
              >
                {success}
              </div>

            )}

            {/* CREATE WALLET */}

            {modal ===
              'CREATE' && (

              <div className="wallet-modal-body">

                <div className="wallet-form-group">

                  <label
                    htmlFor="wallet-currency"
                  >
                    Wallet Currency
                  </label>

                  <select
                    id="wallet-currency"
                    value={
                      currency
                    }
                    onChange={(
                      event,
                    ) =>
                      setCurrency(
                        event
                          .target
                          .value as Currency,
                      )
                    }
                    disabled={
                      submitting
                    }
                  >

                    {CURRENCIES.map(
                      (item) => {

                        const exists =
                          existingCurrencies.has(
                            item,
                          );

                        return (
                          <option
                            key={
                              item
                            }
                            value={
                              item
                            }
                            disabled={
                              exists
                            }
                          >
                            {
                              item
                            }{' '}
                            —{' '}
                            {
                              getCurrencyName(
                                item,
                              )
                            }
                            {exists
                              ? ' — Already created'
                              : ''}
                          </option>
                        );
                      },
                    )}

                  </select>

                  {availableCurrencies.length ===
                  0 ? (

                    <small className="wallet-form-warning">
                      You already
                      have wallets
                      for all
                      supported
                      currencies.
                    </small>

                  ) : (

                    <small>
                      Each currency
                      can have one
                      wallet.
                    </small>

                  )}

                </div>

              </div>
            )}

            {/* DEPOSIT / WITHDRAW */}

            {(modal ===
              'DEPOSIT' ||
              modal ===
                'WITHDRAW') &&
              selectedWallet && (

                <div className="wallet-modal-body">

                  <div className="wallet-form-group">

                    <label
                      htmlFor="wallet-amount"
                    >
                      Amount (
                      {
                        selectedWallet.currency
                      })
                    </label>

                    <div className="wallet-amount-input">

                      <span>
                        {
                          getCurrencySymbol(
                            selectedWallet.currency,
                          )
                        }
                      </span>

                      <input
                        id="wallet-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={
                          amount
                        }
                        onChange={(
                          event,
                        ) =>
                          setAmount(
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          submitting
                        }
                      />

                    </div>

                    {modal ===
                      'WITHDRAW' && (

                      <small>
                        Available
                        balance:{' '}
                        <strong>
                          {
                            formatBalance(
                              selectedWallet,
                            )
                          }
                        </strong>
                      </small>

                    )}

                    {modal ===
                      'DEPOSIT' && (

                      <small>
                        Enter the
                        amount you
                        want to
                        deposit.
                      </small>

                    )}

                  </div>

                </div>
              )}

            {/* TRANSFER */}

            {modal ===
              'TRANSFER' &&
              selectedWallet && (

                <div className="wallet-modal-body">

                  <div className="wallet-form-group">

                    <label
                      htmlFor="recipient-account-number"
                    >
                      Recipient Account Number
                    </label>

                    <div
                      className="wallet-amount-input"
                      style={{
                        gap: '10px',
                      }}
                    >

                      <input
                        id="recipient-account-number"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={10}
                        placeholder="Enter 10-digit account number"
                        value={
                          recipientAccountNumber
                        }
                        onChange={(
                          event,
                        ) => {
                          const value =
                            event.target.value
                              .replace(
                                /\D/g,
                                '',
                              )
                              .slice(
                                0,
                                10,
                              );

                          setRecipientAccountNumber(
                            value,
                          );

                          setTransferRecipient(
                            null,
                          );

                          setError('');
                        }}
                        disabled={
                          submitting ||
                          recipientLoading
                        }
                      />

                      <button
                        type="button"
                        className="wallet-secondary-button"
                        onClick={() =>
                          void findTransferRecipient()
                        }
                        disabled={
                          submitting ||
                          recipientLoading ||
                          recipientAccountNumber.length !==
                            10
                        }
                      >
                        {
                          recipientLoading
                            ? 'Finding...'
                            : 'Find Recipient'
                        }
                      </button>

                    </div>

                    <small>
                      Enter the recipient's Zarova virtual account number.
                    </small>

                  </div>

                  {transferRecipient && (

                    <div
                      className="selected-wallet-box"
                      style={{
                        marginTop: '14px',
                      }}
                    >

                      <span>
                        Recipient
                      </span>

                      <strong>
                        {
                          transferRecipient.accountName
                        }
                      </strong>

                      <small>
                        {
                          transferRecipient.bankName
                        }{' '}
                        • Account{' '}
                        {
                          transferRecipient.accountNumber
                        }
                      </small>

                      <small>
                        Currency:{' '}
                        {
                          transferRecipient.currency
                        }
                      </small>

                    </div>

                  )}

                  <div className="wallet-form-group">

                    <label
                      htmlFor="transfer-amount"
                    >
                      Transfer
                      Amount (
                      {
                        selectedWallet.currency
                      })
                    </label>

                    <div className="wallet-amount-input">

                      <span>
                        {
                          getCurrencySymbol(
                            selectedWallet.currency,
                          )
                        }
                      </span>

                      <input
                        id="transfer-amount"
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        placeholder="0"
                        value={
                          amount
                        }
                        onChange={(
                          event,
                        ) =>
                          setAmount(
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          submitting
                        }
                      />

                    </div>

                    <small>
                      Available
                      balance:{' '}
                      <strong>
                        {
                          formatBalance(
                            selectedWallet,
                          )
                        }
                      </strong>
                    </small>

                  </div>

                </div>
              )}

            {/* MODAL FOOTER */}

            <div className="wallet-modal-footer">

              <button
                type="button"
                className="wallet-secondary-button"
                onClick={
                  closeModal
                }
                disabled={
                  submitting
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="wallet-primary-button"
                onClick={
                  handleSubmit
                }
                disabled={
                  submitting ||
                  !canSubmit
                }
              >

                {submitting
                  ? 'Processing...'
                  : modal ===
                      'CREATE'
                    ? 'Create Wallet'
                    : modal ===
                        'DEPOSIT'
                      ? 'Confirm Deposit'
                      : modal ===
                          'WITHDRAW'
                        ? 'Confirm Withdrawal'
                        : 'Confirm Transfer'}

              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
