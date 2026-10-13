'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Shield,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

/* ============================================================
   TYPES
   ============================================================ */

type KycStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

type DocumentType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'RESIDENCE_PERMIT';

interface KycRecord {
  id: number;
  status: KycStatus;
  tier: number | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  documentType: DocumentType | null;
  documentNumber: string | null;
  documentFrontUrl: string | null;
  documentBackUrl: string | null;
  selfieUrl: string | null;
  address: string | null;
  reviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KycStatusResponse {
  kyc: KycRecord | null;
  status: KycStatus;
}

/* ============================================================
   FORM STATE
   ============================================================ */

interface FormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  documentType: DocumentType;
  documentNumber: string;
  documentFrontUrl: string;
  documentBackUrl: string;
  selfieUrl: string;
  address: string;
}

const INITIAL_FORM: FormData = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  nationality: '',
  documentType: 'NATIONAL_ID',
  documentNumber: '',
  documentFrontUrl: '',
  documentBackUrl: '',
  selfieUrl: '',
  address: '',
};

/* ============================================================
   HELPERS
   ============================================================ */

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDocumentType(type: DocumentType | null): string {
  if (!type) return '—';

  const labels: Record<DocumentType, string> = {
    NATIONAL_ID: 'National ID',
    PASSPORT: 'Passport',
    DRIVERS_LICENSE: "Driver's License",
    RESIDENCE_PERMIT: 'Residence Permit',
  };

  return labels[type] ?? type;
}

/* ============================================================
   STATUS BADGE
   ============================================================ */

function KycStatusBadge({ status }: { status: KycStatus }) {
  const configs: Record<
    KycStatus,
    { label: string; className: string }
  > = {
    NOT_SUBMITTED: {
      label: 'Not Submitted',
      className: 'kyc-badge kyc-badge-not-submitted',
    },
    PENDING: {
      label: 'Pending',
      className: 'kyc-badge kyc-badge-pending',
    },
    UNDER_REVIEW: {
      label: 'Under Review',
      className: 'kyc-badge kyc-badge-under-review',
    },
    APPROVED: {
      label: 'Approved',
      className: 'kyc-badge kyc-badge-approved',
    },
    REJECTED: {
      label: 'Rejected',
      className: 'kyc-badge kyc-badge-rejected',
    },
  };

  const config = configs[status];

  return (
    <span className={config.className}>
      <span className="kyc-badge-dot" />
      {config.label}
    </span>
  );
}

/* ============================================================
   STEP INDICATORS
   ============================================================ */

const STEPS = [
  'Personal Info',
  'Document',
  'Selfie & Address',
  'Review',
];

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="kyc-steps">
      {STEPS.map((label, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;

        return (
          <div
            key={label}
            className={`kyc-step ${isActive ? 'kyc-step-active' : ''} ${isCompleted ? 'kyc-step-completed' : ''}`}
          >
            <div className="kyc-step-circle">
              {isCompleted ? (
                <CheckCircle2 size={16} />
              ) : (
                <span>{stepNumber}</span>
              )}
            </div>
            <span className="kyc-step-label">{label}</span>
            {index < totalSteps - 1 && (
              <ChevronRight
                size={14}
                className="kyc-step-arrow"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function KycPage() {
  const [statusData, setStatusData] =
    useState<KycStatusResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormData, string>>
  >({});

  /* ----------------------------------------------------------
     LOAD KYC STATUS
     ---------------------------------------------------------- */

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      setError('');

      const data =
        await apiFetch<KycStatusResponse>('/kyc/status');

      setStatusData(data);

      if (data.kyc) {
        setForm({
          firstName: data.kyc.firstName ?? '',
          lastName: data.kyc.lastName ?? '',
          dateOfBirth: data.kyc.dateOfBirth ?? '',
          nationality: data.kyc.nationality ?? '',
          documentType: data.kyc.documentType ?? 'NATIONAL_ID',
          documentNumber: data.kyc.documentNumber ?? '',
          documentFrontUrl: data.kyc.documentFrontUrl ?? '',
          documentBackUrl: data.kyc.documentBackUrl ?? '',
          selfieUrl: data.kyc.selfieUrl ?? '',
          address: data.kyc.address ?? '',
        });
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load KYC status.',
      );
    } finally {
      setLoading(false);
    }
  }

  /* ----------------------------------------------------------
     FIELD CHANGE
     ---------------------------------------------------------- */

  function handleChange<K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  /* ----------------------------------------------------------
     VALIDATION
     ---------------------------------------------------------- */

  function validateStep(stepNumber: number): boolean {
    const errors: Partial<Record<keyof FormData, string>> = {};

    if (stepNumber === 1) {
      if (!form.firstName.trim()) {
        errors.firstName = 'First name is required.';
      }
      if (!form.lastName.trim()) {
        errors.lastName = 'Last name is required.';
      }
      if (!form.dateOfBirth) {
        errors.dateOfBirth = 'Date of birth is required.';
      }
      if (!form.nationality.trim()) {
        errors.nationality = 'Nationality is required.';
      }
    }

    if (stepNumber === 2) {
      if (!form.documentNumber.trim()) {
        errors.documentNumber = 'Document number is required.';
      }
      if (!form.documentFrontUrl.trim()) {
        errors.documentFrontUrl = 'Document front image URL is required.';
      }
      if (!form.documentBackUrl.trim()) {
        errors.documentBackUrl = 'Document back image URL is required.';
      }
    }

    if (stepNumber === 3) {
      if (!form.selfieUrl.trim()) {
        errors.selfieUrl = 'Selfie image URL is required.';
      }
      if (!form.address.trim()) {
        errors.address = 'Address is required.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /* ----------------------------------------------------------
     NEXT / BACK
     ---------------------------------------------------------- */

  function handleNext() {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, STEPS.length));
  }

  function handleBack() {
    setStep((prev) => Math.max(prev - 1, 1));
    setFieldErrors({});
  }

  /* ----------------------------------------------------------
     SUBMIT
     ---------------------------------------------------------- */

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setSubmitError('');

      await apiFetch('/kyc/submit', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth,
          nationality: form.nationality.trim(),
          documentType: form.documentType,
          documentNumber: form.documentNumber.trim(),
          documentFrontUrl: form.documentFrontUrl.trim(),
          documentBackUrl: form.documentBackUrl.trim(),
          selfieUrl: form.selfieUrl.trim(),
          address: form.address.trim(),
        }),
      });

      setSubmitSuccess(true);
      await loadStatus();
    } catch (caught) {
      setSubmitError(
        caught instanceof Error
          ? caught.message
          : 'Submission failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ----------------------------------------------------------
     LOADING
     ---------------------------------------------------------- */

  if (loading) {
    return (
      <div className="kyc-page">
        <div className="kyc-loading">
          <Loader2 size={30} className="kyc-spin" />
          <span>Loading your KYC status...</span>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------
     ERROR
     ---------------------------------------------------------- */

  if (error) {
    return (
      <div className="kyc-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Identity Verification</h1>
          </div>
        </div>
        <div className="admin-alert admin-alert-error">
          <AlertCircle size={17} />
          {error}
          <button
            type="button"
            className="secondary-button"
            style={{ marginLeft: 'auto' }}
            onClick={() => void loadStatus()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const currentStatus = statusData?.status ?? 'NOT_SUBMITTED';
  const kyc = statusData?.kyc ?? null;
  const showForm =
    currentStatus === 'NOT_SUBMITTED' || currentStatus === 'REJECTED';

  /* ----------------------------------------------------------
     RENDER
     ---------------------------------------------------------- */

  return (
    <div className="kyc-page">

      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <div className="page-header">
        <div>
          <div className="admin-eyebrow">
            <Shield size={15} />
            KYC Verification
          </div>
          <h1 className="page-title">Identity Verification</h1>
          <p className="page-description">
            Complete identity verification to unlock full account features.
          </p>
        </div>
        <KycStatusBadge status={currentStatus} />
      </div>

      {/* ======================================================
          APPROVED STATE
          ====================================================== */}

      {currentStatus === 'APPROVED' && (
        <section className="kyc-approved-card">
          <div className="kyc-approved-icon">
            <ShieldCheck size={36} />
          </div>
          <div>
            <h2>Identity Verified</h2>
            <p>
              Your identity has been verified and your account is fully
              activated.
            </p>
            {kyc?.tier != null && (
              <div className="kyc-tier-badge">
                KYC Tier {kyc.tier}
              </div>
            )}
            {kyc?.reviewedAt && (
              <p className="kyc-meta">
                Verified on {formatDate(kyc.reviewedAt)}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ======================================================
          PENDING / UNDER_REVIEW STATE
          ====================================================== */}

      {(currentStatus === 'PENDING' ||
        currentStatus === 'UNDER_REVIEW') && (
        <section className="kyc-status-card kyc-status-pending">
          <div className="kyc-status-icon">
            <Clock size={30} />
          </div>
          <div>
            <h2>
              {currentStatus === 'PENDING'
                ? 'Submission Received'
                : 'Under Review'}
            </h2>
            <p>
              {currentStatus === 'PENDING'
                ? 'Your KYC submission has been received and is queued for review.'
                : 'Our compliance team is reviewing your documents. This typically takes 1–3 business days.'}
            </p>
            <div className="kyc-timeline">
              <div
                className={`kyc-timeline-item ${
                  currentStatus === 'PENDING' ||
                  currentStatus === 'UNDER_REVIEW'
                    ? 'kyc-timeline-done'
                    : ''
                }`}
              >
                <span className="kyc-timeline-dot" />
                <span>Submitted</span>
                {kyc?.submittedAt && (
                  <small>{formatDate(kyc.submittedAt)}</small>
                )}
              </div>
              <div
                className={`kyc-timeline-item ${
                  currentStatus === 'UNDER_REVIEW'
                    ? 'kyc-timeline-active'
                    : ''
                }`}
              >
                <span className="kyc-timeline-dot" />
                <span>Under Review</span>
              </div>
              <div className="kyc-timeline-item">
                <span className="kyc-timeline-dot" />
                <span>Decision</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================
          REJECTED NOTICE
          ====================================================== */}

      {currentStatus === 'REJECTED' && kyc?.reviewNotes && (
        <div className="admin-alert admin-alert-error" style={{ marginBottom: '1.5rem' }}>
          <X size={17} />
          <div>
            <strong>Your previous submission was rejected.</strong>
            <p style={{ marginTop: '0.25rem', marginBottom: 0 }}>
              Reason: {kyc.reviewNotes}
            </p>
          </div>
        </div>
      )}

      {/* ======================================================
          SUBMISSION FORM
          ====================================================== */}

      {showForm && (
        <section className="admin-panel kyc-form-panel">

          {submitSuccess ? (
            <div className="kyc-success-state">
              <CheckCircle2 size={40} />
              <h2>Submitted Successfully</h2>
              <p>
                Your KYC documents have been submitted. Our team will review
                them within 1–3 business days.
              </p>
            </div>
          ) : (
            <>
              {/* Step Indicator */}
              <div className="kyc-form-header">
                <div>
                  <h2>Submit KYC Documents</h2>
                  <p>Step {step} of {STEPS.length} — {STEPS[step - 1]}</p>
                </div>
              </div>

              <StepIndicator
                currentStep={step}
                totalSteps={STEPS.length}
              />

              {submitError && (
                <div className="admin-alert admin-alert-error">
                  <AlertCircle size={17} />
                  {submitError}
                </div>
              )}

              <div className="kyc-form-body">

                {/* ============================================
                    STEP 1: PERSONAL INFO
                    ============================================ */}

                {step === 1 && (
                  <div className="kyc-form-step">
                    <div className="kyc-step-heading">
                      <div className="kyc-step-icon">
                        <User size={20} />
                      </div>
                      <div>
                        <h3>Personal Information</h3>
                        <p>
                          Enter your legal name and personal details as they
                          appear on your official document.
                        </p>
                      </div>
                    </div>

                    <div className="kyc-form-grid">
                      <div className="form-field">
                        <label htmlFor="kyc-firstName">First Name</label>
                        <input
                          id="kyc-firstName"
                          type="text"
                          value={form.firstName}
                          onChange={(e) =>
                            handleChange('firstName', e.target.value)
                          }
                          placeholder="Your legal first name"
                        />
                        {fieldErrors.firstName && (
                          <span className="kyc-field-error">
                            {fieldErrors.firstName}
                          </span>
                        )}
                      </div>

                      <div className="form-field">
                        <label htmlFor="kyc-lastName">Last Name</label>
                        <input
                          id="kyc-lastName"
                          type="text"
                          value={form.lastName}
                          onChange={(e) =>
                            handleChange('lastName', e.target.value)
                          }
                          placeholder="Your legal last name"
                        />
                        {fieldErrors.lastName && (
                          <span className="kyc-field-error">
                            {fieldErrors.lastName}
                          </span>
                        )}
                      </div>

                      <div className="form-field">
                        <label htmlFor="kyc-dateOfBirth">Date of Birth</label>
                        <input
                          id="kyc-dateOfBirth"
                          type="date"
                          value={form.dateOfBirth}
                          onChange={(e) =>
                            handleChange('dateOfBirth', e.target.value)
                          }
                        />
                        {fieldErrors.dateOfBirth && (
                          <span className="kyc-field-error">
                            {fieldErrors.dateOfBirth}
                          </span>
                        )}
                      </div>

                      <div className="form-field">
                        <label htmlFor="kyc-nationality">Nationality</label>
                        <input
                          id="kyc-nationality"
                          type="text"
                          value={form.nationality}
                          onChange={(e) =>
                            handleChange('nationality', e.target.value)
                          }
                          placeholder="e.g. Nigerian"
                        />
                        {fieldErrors.nationality && (
                          <span className="kyc-field-error">
                            {fieldErrors.nationality}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================
                    STEP 2: DOCUMENT INFO
                    ============================================ */}

                {step === 2 && (
                  <div className="kyc-form-step">
                    <div className="kyc-step-heading">
                      <div className="kyc-step-icon">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h3>Document Information</h3>
                        <p>
                          Select your document type and provide the image
                          URLs. In production, you would upload images
                          directly.
                        </p>
                      </div>
                    </div>

                    <div className="kyc-form-grid">
                      <div className="form-field full-width">
                        <label htmlFor="kyc-documentType">
                          Document Type
                        </label>
                        <select
                          id="kyc-documentType"
                          value={form.documentType}
                          onChange={(e) =>
                            handleChange(
                              'documentType',
                              e.target.value as DocumentType,
                            )
                          }
                        >
                          <option value="NATIONAL_ID">National ID</option>
                          <option value="PASSPORT">Passport</option>
                          <option value="DRIVERS_LICENSE">
                            Driver's License
                          </option>
                          <option value="RESIDENCE_PERMIT">
                            Residence Permit
                          </option>
                        </select>
                      </div>

                      <div className="form-field full-width">
                        <label htmlFor="kyc-documentNumber">
                          Document Number
                        </label>
                        <input
                          id="kyc-documentNumber"
                          type="text"
                          value={form.documentNumber}
                          onChange={(e) =>
                            handleChange('documentNumber', e.target.value)
                          }
                          placeholder="e.g. A12345678"
                        />
                        {fieldErrors.documentNumber && (
                          <span className="kyc-field-error">
                            {fieldErrors.documentNumber}
                          </span>
                        )}
                      </div>

                      <div className="form-field">
                        <label htmlFor="kyc-documentFrontUrl">
                          Document Front Image URL
                        </label>
                        <input
                          id="kyc-documentFrontUrl"
                          type="url"
                          value={form.documentFrontUrl}
                          onChange={(e) =>
                            handleChange('documentFrontUrl', e.target.value)
                          }
                          placeholder="https://..."
                        />
                        <small>
                          Enter the URL of the uploaded front-side document
                          image.
                        </small>
                        {fieldErrors.documentFrontUrl && (
                          <span className="kyc-field-error">
                            {fieldErrors.documentFrontUrl}
                          </span>
                        )}
                      </div>

                      <div className="form-field">
                        <label htmlFor="kyc-documentBackUrl">
                          Document Back Image URL
                        </label>
                        <input
                          id="kyc-documentBackUrl"
                          type="url"
                          value={form.documentBackUrl}
                          onChange={(e) =>
                            handleChange('documentBackUrl', e.target.value)
                          }
                          placeholder="https://..."
                        />
                        <small>
                          Enter the URL of the uploaded back-side document
                          image.
                        </small>
                        {fieldErrors.documentBackUrl && (
                          <span className="kyc-field-error">
                            {fieldErrors.documentBackUrl}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================
                    STEP 3: SELFIE & ADDRESS
                    ============================================ */}

                {step === 3 && (
                  <div className="kyc-form-step">
                    <div className="kyc-step-heading">
                      <div className="kyc-step-icon">
                        <Shield size={20} />
                      </div>
                      <div>
                        <h3>Selfie and Address</h3>
                        <p>
                          Provide a selfie image URL and your current
                          residential address.
                        </p>
                      </div>
                    </div>

                    <div className="kyc-form-grid">
                      <div className="form-field full-width">
                        <label htmlFor="kyc-selfieUrl">
                          Selfie Image URL
                        </label>
                        <input
                          id="kyc-selfieUrl"
                          type="url"
                          value={form.selfieUrl}
                          onChange={(e) =>
                            handleChange('selfieUrl', e.target.value)
                          }
                          placeholder="https://..."
                        />
                        <small>
                          Enter the URL of the uploaded selfie image holding
                          your document.
                        </small>
                        {fieldErrors.selfieUrl && (
                          <span className="kyc-field-error">
                            {fieldErrors.selfieUrl}
                          </span>
                        )}
                      </div>

                      <div className="form-field full-width">
                        <label htmlFor="kyc-address">
                          Residential Address
                        </label>
                        <textarea
                          id="kyc-address"
                          rows={3}
                          value={form.address}
                          onChange={(e) =>
                            handleChange('address', e.target.value)
                          }
                          placeholder="Enter your full current residential address"
                        />
                        {fieldErrors.address && (
                          <span className="kyc-field-error">
                            {fieldErrors.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================
                    STEP 4: REVIEW & SUBMIT
                    ============================================ */}

                {step === 4 && (
                  <div className="kyc-form-step">
                    <div className="kyc-step-heading">
                      <div className="kyc-step-icon">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h3>Review & Submit</h3>
                        <p>
                          Review the information below before submitting.
                          Once submitted, you cannot edit until a decision
                          is made.
                        </p>
                      </div>
                    </div>

                    <div className="kyc-review-grid">
                      <div className="kyc-review-section">
                        <h4>Personal Information</h4>
                        <div className="kyc-review-fields">
                          <div className="kyc-review-row">
                            <span>First Name</span>
                            <strong>{form.firstName || '—'}</strong>
                          </div>
                          <div className="kyc-review-row">
                            <span>Last Name</span>
                            <strong>{form.lastName || '—'}</strong>
                          </div>
                          <div className="kyc-review-row">
                            <span>Date of Birth</span>
                            <strong>
                              {form.dateOfBirth
                                ? formatDate(form.dateOfBirth)
                                : '—'}
                            </strong>
                          </div>
                          <div className="kyc-review-row">
                            <span>Nationality</span>
                            <strong>{form.nationality || '—'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="kyc-review-section">
                        <h4>Document</h4>
                        <div className="kyc-review-fields">
                          <div className="kyc-review-row">
                            <span>Document Type</span>
                            <strong>
                              {formatDocumentType(form.documentType)}
                            </strong>
                          </div>
                          <div className="kyc-review-row">
                            <span>Document Number</span>
                            <strong>{form.documentNumber || '—'}</strong>
                          </div>
                          <div className="kyc-review-row">
                            <span>Front Image</span>
                            <strong className="kyc-review-url">
                              {form.documentFrontUrl || '—'}
                            </strong>
                          </div>
                          <div className="kyc-review-row">
                            <span>Back Image</span>
                            <strong className="kyc-review-url">
                              {form.documentBackUrl || '—'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="kyc-review-section">
                        <h4>Selfie & Address</h4>
                        <div className="kyc-review-fields">
                          <div className="kyc-review-row">
                            <span>Selfie Image</span>
                            <strong className="kyc-review-url">
                              {form.selfieUrl || '—'}
                            </strong>
                          </div>
                          <div className="kyc-review-row">
                            <span>Address</span>
                            <strong>{form.address || '—'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* --------------------------------------------------
                  FORM NAVIGATION
                  -------------------------------------------------- */}

              <div className="kyc-form-actions">
                {step > 1 && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleBack}
                    disabled={submitting}
                  >
                    Back
                  </button>
                )}

                <div style={{ flex: 1 }} />

                {step < STEPS.length ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleNext}
                  >
                    Next
                    <ChevronRight size={17} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2
                          size={17}
                          className="kyc-spin"
                        />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={17} />
                        Submit for Review
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

    </div>
  );
}
