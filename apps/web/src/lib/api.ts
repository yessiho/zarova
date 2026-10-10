
// ============================================================
// ZAROVA - API CLIENT
// ============================================================

import {
  clearAuthSession,
  getAccessToken,
} from './auth';

// ============================================================
// API CONFIGURATION
// ============================================================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';

// ============================================================
// API ERROR TYPE
// ============================================================

interface ApiErrorData {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

// ============================================================
// AUTHENTICATION PAGES
// ============================================================

const AUTH_PAGES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

// ============================================================
// AUTHENTICATION API ENDPOINTS
//
// These endpoints must NOT trigger automatic logout/redirect
// when they return 401.
//
// Example:
//
// POST /auth/user/login
//
// Wrong password = 401
//
// This should show an error message on the login page,
// NOT redirect the user.
// ============================================================

const AUTH_ENDPOINTS = [
  '/auth/user/login',
  '/auth/admin/login',
  '/auth/user/register',
  '/auth/admin/register',
  '/auth/user/forgot-password',
  '/auth/user/reset-password',
];

// ============================================================
// 401 REDIRECT PROTECTION
//
// Prevent multiple simultaneous API requests from triggering
// multiple redirects at the same time.
// ============================================================

let isHandlingUnauthorized = false;

// ============================================================
// HELPERS
// ============================================================

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// ============================================================
// CHECK AUTHENTICATION PAGE
// ============================================================

function isAuthenticationPage(
  pathname: string,
): boolean {
  return AUTH_PAGES.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`),
  );
}

// ============================================================
// CHECK AUTH ENDPOINT
//
// Authentication endpoints handle their own errors.
//
// They should NOT trigger automatic unauthorized redirects.
// ============================================================

function isAuthenticationEndpoint(
  endpoint: string,
): boolean {
  return AUTH_ENDPOINTS.some(
    (path) =>
      endpoint === path ||
      endpoint.startsWith(`${path}?`),
  );
}

// ============================================================
// HANDLE UNAUTHORIZED RESPONSE
//
// Centralized handling for:
//
// - Expired JWT
// - Invalid JWT
// - Removed session
// - Unauthorized protected request
//
// IMPORTANT:
//
// This should only run for protected API requests.
// ============================================================

function handleUnauthorized(): void {
  if (!isBrowser()) {
    return;
  }

  /*
   * Prevent multiple simultaneous 401 handlers.
   */
  if (isHandlingUnauthorized) {
    return;
  }

  isHandlingUnauthorized = true;

  /*
   * Get current location before clearing session.
   */
  const currentPath =
    window.location.pathname;

  const currentSearch =
    window.location.search;

  const redirectPath =
    `${currentPath}${currentSearch}`;

  /*
   * Clear centralized authentication session.
   */
  clearAuthSession();

  /*
   * Notify application components that authentication
   * state has changed.
   */
  window.dispatchEvent(
    new Event('auth-session-updated'),
  );

  /*
   * Never redirect if already on an authentication page.
   */
  if (isAuthenticationPage(currentPath)) {
    isHandlingUnauthorized = false;
    return;
  }

  /*
   * Redirect immediately.
   *
   * We use window.location.replace because api.ts is not
   * a React component and cannot use Next.js useRouter().
   */
  window.location.replace(
    `/login?redirect=${encodeURIComponent(
      redirectPath,
    )}`,
  );
}

// ============================================================
// API FETCH
// ============================================================

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {

  // ==========================================================
  // GET JWT TOKEN
  //
  // Authentication logic is centralized in auth.ts.
  // ==========================================================

  const token = getAccessToken();

  // ==========================================================
  // BUILD REQUEST HEADERS
  // ==========================================================

  const headers = new Headers(
    options.headers,
  );

  /*
   * Only automatically set Content-Type for JSON requests.
   *
   * Do not override FormData because the browser must add
   * the multipart boundary automatically.
   */
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  /*
   * Automatically attach JWT token when available.
   */
  if (
    token &&
    !headers.has('Authorization')
  ) {
    headers.set(
      'Authorization',
      `Bearer ${token}`,
    );
  }

  // ==========================================================
  // SEND REQUEST
  // ==========================================================

  let response: Response;

  try {
    response = await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,
        headers,
      },
    );
  } catch {
    /*
     * Network-level failures.
     *
     * Examples:
     * - Backend offline
     * - CORS issue
     * - Network unavailable
     */
    throw new Error(
      'Unable to connect to the server. Please check your internet connection and try again.',
    );
  }

  // ==========================================================
  // HANDLE 204 NO CONTENT
  // ==========================================================

  if (response.status === 204) {
    return undefined as T;
  }

  // ==========================================================
  // PARSE RESPONSE
  // ==========================================================

  const contentType =
    response.headers.get('content-type') ||
    '';

  let data: unknown = null;

  if (
    contentType.includes(
      'application/json',
    )
  ) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  // ==========================================================
  // HANDLE API ERRORS
  // ==========================================================

  if (!response.ok) {

    let errorMessage =
      'Something went wrong. Please try again.';

    const errorData =
      data as ApiErrorData | null;

    /*
     * NestJS commonly returns:
     *
     * {
     *   statusCode: 400,
     *   message: "Error message",
     *   error: "Bad Request"
     * }
     */
    if (errorData?.message) {
      errorMessage = Array.isArray(
        errorData.message,
      )
        ? errorData.message.join(', ')
        : errorData.message;
    }

    // ========================================================
    // HANDLE 401 UNAUTHORIZED
    //
    // CRITICAL:
    //
    // Do NOT automatically redirect for authentication
    // endpoints.
    //
    // Example:
    //
    // Wrong login password → 401
    //
    // The login page should simply display the error.
    // ========================================================

    if (
      response.status === 401 &&
      !isAuthenticationEndpoint(endpoint)
    ) {
      handleUnauthorized();
    }

    /*
     * Throw the backend error.
     *
     * The calling page (Login, Wallet, Dashboard, etc.)
     * can handle and display it.
     */
    throw new Error(errorMessage);
  }

  // ==========================================================
  // SUCCESS RESPONSE
  // ==========================================================

  return data as T;
}