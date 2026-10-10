'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';

import { apiFetch } from '@/lib/api';

interface ApiError {
  message?: string | string[];
}

interface RegisterResponse {
  message?: string;
  user?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
}

type PasswordStrength = {
  score: number;
  label: string;
  className: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    const message = (error as ApiError).message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Unable to create your account. Please try again.';
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: '',
      className: '',
    };
  }

  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) {
    return {
      score,
      label: 'Weak',
      className: 'weak',
    };
  }

  if (score === 2 || score === 3) {
    return {
      score,
      label: 'Medium',
      className: 'medium',
    };
  }

  return {
    score,
    label: 'Strong',
    className: 'strong',
  };
}

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const passwordStrength = useMemo(
    () => getPasswordStrength(password),
    [password],
  );

  const passwordRequirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setLoading(true);

      await apiFetch<RegisterResponse>('/auth/user/register', {
        method: 'POST',

        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
        }),
      });

      setSuccess(
        'Account created successfully. Redirecting you to login...',
      );

      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (error: unknown) {
      console.error('Registration error:', error);

      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="register-page">
      {/* BACKGROUND */}
      <div className="register-background">
        <div className="register-orb register-orb-one" />
        <div className="register-orb register-orb-two" />
        <div className="register-grid-pattern" />
      </div>

      <div className="register-wrapper">

        {/* LEFT BRAND PANEL */}
        <section className="register-brand-panel">
          <div className="register-brand-content">

            <div className="register-brand-logo">
              <Landmark size={30} />
            </div>

            <div className="register-brand-name">
              Zarova
            </div>

            <h1>
              Take control of your
              <br />
              financial future.
            </h1>

            <p>
              Create your Zarova account and manage your wallets,
              transactions, and financial activities from one secure
              platform.
            </p>

            <div className="register-features">

              <div className="register-feature">
                <div className="register-feature-icon">
                  <ShieldCheck size={18} />
                </div>

                <div>
                  <strong>Secure by Design</strong>

                  <span>
                    Your financial activities are protected with secure
                    authentication.
                  </span>
                </div>
              </div>

              <div className="register-feature">
                <div className="register-feature-icon">
                  <Landmark size={18} />
                </div>

                <div>
                  <strong>Multi-Currency Management</strong>

                  <span>
                    Manage NGN, USD, GBP and EUR wallets from one dashboard.
                  </span>
                </div>
              </div>

              <div className="register-feature">
                <div className="register-feature-icon">
                  <UserPlus size={18} />
                </div>

                <div>
                  <strong>Easy Account Setup</strong>

                  <span>
                    Create your account and start managing your finances.
                  </span>
                </div>
              </div>

            </div>
          </div>

          <div className="register-brand-footer">
            © {new Date().getFullYear()} Zarova. Financial Management
            Platform.
          </div>
        </section>

        {/* RIGHT FORM PANEL */}
        <section className="register-form-panel">
          <div className="register-form-container">

            {/* MOBILE BRAND */}
            <div className="register-mobile-brand">
              <div className="register-mobile-logo">
                <Landmark size={24} />
              </div>

              <span>Zarova</span>
            </div>

            {/* HEADING */}
            <div className="register-heading">
              <span className="register-welcome">
                Create your account
              </span>

              <h2>Get started with Zarova</h2>

              <p>
                Fill in your details below to create your financial
                workspace.
              </p>
            </div>

            {/* ERROR */}
            {error && (
              <div className="register-error">
                {error}
              </div>
            )}

            {/* SUCCESS */}
            {success && (
              <div className="register-success">
                <Check size={18} />
                {success}
              </div>
            )}

            {/* REGISTER FORM */}
            <form
              onSubmit={handleSubmit}
              className="register-form"
            >

              {/* NAME ROW */}
              <div className="register-name-row">

                {/* FIRST NAME */}
                <div className="register-field">
                  <label htmlFor="firstName">
                    First Name
                  </label>

                  <div className="register-input-wrapper">
                    <User
                      size={19}
                      className="register-input-icon"
                    />

                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(event) =>
                        setFirstName(event.target.value)
                      }
                      placeholder="John"
                      required
                      autoComplete="given-name"
                    />
                  </div>
                </div>

                {/* LAST NAME */}
                <div className="register-field">
                  <label htmlFor="lastName">
                    Last Name
                  </label>

                  <div className="register-input-wrapper">
                    <User
                      size={19}
                      className="register-input-icon"
                    />

                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(event) =>
                        setLastName(event.target.value)
                      }
                      placeholder="Doe"
                      required
                      autoComplete="family-name"
                    />
                  </div>
                </div>

              </div>

              {/* EMAIL */}
              <div className="register-field">
                <label htmlFor="email">
                  Email Address
                </label>

                <div className="register-input-wrapper">
                  <Mail
                    size={19}
                    className="register-input-icon"
                  />

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="Enter your email"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div className="register-field">
                <label htmlFor="password">
                  Password
                </label>

                <div className="register-input-wrapper">
                  <Lock
                    size={19}
                    className="register-input-icon"
                  />

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="register-password-toggle"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>

                {/* PASSWORD STRENGTH */}
                {password && (
                  <div className="password-strength-container">

                    <div className="password-strength-header">
                      <span>Password strength</span>

                      <strong
                        className={`password-strength-label ${passwordStrength.className}`}
                      >
                        {passwordStrength.label}
                      </strong>
                    </div>

                    <div className="password-strength-bars">
                      {[1, 2, 3, 4].map((bar) => (
                        <span
                          key={bar}
                          className={
                            bar <= passwordStrength.score
                              ? `password-strength-bar active ${passwordStrength.className}`
                              : 'password-strength-bar'
                          }
                        />
                      ))}
                    </div>

                    <div className="password-requirements">

                      <div
                        className={
                          passwordRequirements.length
                            ? 'password-requirement valid'
                            : 'password-requirement'
                        }
                      >
                        {passwordRequirements.length ? (
                          <Check size={14} />
                        ) : (
                          <X size={14} />
                        )}

                        At least 8 characters
                      </div>

                      <div
                        className={
                          passwordRequirements.uppercase
                            ? 'password-requirement valid'
                            : 'password-requirement'
                        }
                      >
                        {passwordRequirements.uppercase ? (
                          <Check size={14} />
                        ) : (
                          <X size={14} />
                        )}

                        Uppercase letter
                      </div>

                      <div
                        className={
                          passwordRequirements.number
                            ? 'password-requirement valid'
                            : 'password-requirement'
                        }
                      >
                        {passwordRequirements.number ? (
                          <Check size={14} />
                        ) : (
                          <X size={14} />
                        )}

                        Number
                      </div>

                      <div
                        className={
                          passwordRequirements.special
                            ? 'password-requirement valid'
                            : 'password-requirement'
                        }
                      >
                        {passwordRequirements.special ? (
                          <Check size={14} />
                        ) : (
                          <X size={14} />
                        )}

                        Special character
                      </div>

                    </div>
                  </div>
                )}
              </div>

              {/* CONFIRM PASSWORD */}
              <div className="register-field">
                <label htmlFor="confirmPassword">
                  Confirm Password
                </label>

                <div className="register-input-wrapper">
                  <Lock
                    size={19}
                    className="register-input-icon"
                  />

                  <input
                    id="confirmPassword"
                    type={
                      showConfirmPassword
                        ? 'text'
                        : 'password'
                    }
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Confirm your password"
                    required
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="register-password-toggle"
                    onClick={() =>
                      setShowConfirmPassword(
                        !showConfirmPassword,
                      )
                    }
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>

                {/* PASSWORD MATCH STATUS */}
                {confirmPassword && (
                  <div
                    className={
                      passwordsMatch
                        ? 'password-match-status success'
                        : 'password-match-status error'
                    }
                  >
                    {passwordsMatch ? (
                      <>
                        <Check size={14} />
                        Passwords match
                      </>
                    ) : (
                      <>
                        <X size={14} />
                        Passwords do not match
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="register-submit-button"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2
                      size={19}
                      className="register-spinner"
                    />

                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account

                    <ArrowRight size={19} />
                  </>
                )}
              </button>

            </form>

            {/* LOGIN LINK */}
            <div className="register-login-link">
              <span>Already have an account?</span>

              <Link href="/login">
                Sign in
              </Link>
            </div>

            {/* SECURITY */}
            <p className="register-security-text">
              <ShieldCheck size={15} />

              Your information is securely protected.
            </p>

          </div>
        </section>

      </div>
    </main>
  );
}