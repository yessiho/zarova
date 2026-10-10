
// ============================================================
// ZAROVA - AUTHENTICATION UTILITIES
// ============================================================
//
// Centralized authentication session management.
//
// Responsibilities:
//
// - Store JWT access token
// - Retrieve JWT access token
// - Store authenticated user
// - Retrieve authenticated user
// - Save complete authentication session
// - Clear authentication session
// - Notify application components about auth changes
//
// IMPORTANT:
//
// Do not access authentication localStorage keys directly
// anywhere else in the application.
//
// Always use these functions.
//
// ============================================================


// ============================================================
// STORAGE KEYS
// ============================================================

const ACCESS_TOKEN_KEY = 'zarova_access_token';

const USER_KEY = 'zarova_user';


// ============================================================
// AUTH EVENTS
// ============================================================

export const AUTH_SESSION_UPDATED_EVENT =
  'auth-session-updated';

export const USER_PROFILE_UPDATED_EVENT =
  'user-profile-updated';


// ============================================================
// TYPES
// ============================================================

export interface AuthUser {
  id: number;

  email: string;

  firstName: string;

  lastName: string;

  status: string;
}


// ============================================================
// ENVIRONMENT CHECK
// ============================================================

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}


// ============================================================
// AUTH EVENT HELPER
// ============================================================

function dispatchAuthSessionUpdated(): void {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new Event(AUTH_SESSION_UPDATED_EVENT),
  );
}

function dispatchUserProfileUpdated(): void {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new Event(USER_PROFILE_UPDATED_EVENT),
  );
}


// ============================================================
// TOKEN MANAGEMENT
// ============================================================

/*
 * Retrieve the current authentication token.
 *
 * Only the Zarova centralized storage key is used.
 *
 * Legacy storage keys are intentionally not migrated.
 *
 * This prevents old or expired sessions from automatically
 * becoming active again.
 */
export function getAccessToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  const token = localStorage.getItem(
    ACCESS_TOKEN_KEY,
  );

  if (!token) {
    return null;
  }

  return token;
}


/*
 * Store authentication token.
 */
export function setAccessToken(
  token: string,
): void {
  if (!isBrowser()) {
    return;
  }

  if (!token || typeof token !== 'string') {
    return;
  }

  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    token,
  );
}


/*
 * Remove authentication token.
 */
export function removeAccessToken(): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(
    ACCESS_TOKEN_KEY,
  );
}


// ============================================================
// USER MANAGEMENT
// ============================================================

/*
 * Retrieve the authenticated user.
 */
export function getAuthUser(): AuthUser | null {
  if (!isBrowser()) {
    return null;
  }

  const storedUser = localStorage.getItem(
    USER_KEY,
  );

  if (!storedUser) {
    return null;
  }

  try {
    const user =
      JSON.parse(storedUser) as AuthUser;

    /*
     * Basic validation.
     *
     * Prevent invalid or corrupted objects from being treated
     * as authenticated users.
     */
    if (
      !user ||
      typeof user !== 'object' ||
      typeof user.id !== 'number' ||
      typeof user.email !== 'string'
    ) {
      clearAuthSession();

      return null;
    }

    return user;
  } catch {
    /*
     * Corrupted localStorage data.
     */
    clearAuthSession();

    return null;
  }
}


/*
 * Store authenticated user.
 */
export function setAuthUser(
  user: AuthUser,
): void {
  if (!isBrowser()) {
    return;
  }

  if (!user) {
    return;
  }

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user),
  );

  /*
   * Notify components that user information changed.
   */
  dispatchUserProfileUpdated();
}


/*
 * Remove authenticated user.
 */
export function removeAuthUser(): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(
    USER_KEY,
  );
}


// ============================================================
// AUTH STATE
// ============================================================

/*
 * Check whether an access token exists.
 *
 * This checks presence only.
 *
 * Backend API remains responsible for validating:
 *
 * - Token expiration
 * - Invalid signature
 * - Revoked token
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}


/*
 * Check whether a complete client-side authentication session
 * exists.
 *
 * Both token and user data are required.
 *
 * Useful for AuthGuard and protected layouts.
 */
export function hasAuthSession(): boolean {
  const token = getAccessToken();

  const user = getAuthUser();

  return !!(token && user);
}


// ============================================================
// LOGIN / SAVE SESSION
// ============================================================

/*
 * Save the complete authentication session.
 *
 * This must only be called after successful backend login.
 *
 * Example:
 *
 * const response = await apiFetch<LoginResponse>(
 *   '/auth/user/login',
 * );
 *
 * saveAuthSession(
 *   response.accessToken,
 *   response.user,
 * );
 */
export function saveAuthSession(
  accessToken: string,
  user: AuthUser,
): void {
  if (!isBrowser()) {
    return;
  }

  /*
   * Validate before writing anything.
   *
   * This prevents partial sessions.
   */
  if (
    !accessToken ||
    typeof accessToken !== 'string' ||
    !user ||
    typeof user !== 'object'
  ) {
    clearAuthSession();

    return;
  }

  /*
   * Save JWT.
   */
  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    accessToken,
  );

  /*
   * Save authenticated user.
   */
  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user),
  );

  /*
   * Notify application components once the complete
   * authentication session has been created.
   */
  dispatchAuthSessionUpdated();

  dispatchUserProfileUpdated();
}


// ============================================================
// UPDATE USER SESSION
// ============================================================

/*
 * Update authenticated user information.
 *
 * Useful after profile updates.
 */
export function updateAuthUser(
  updates: Partial<AuthUser>,
): AuthUser | null {
  if (!isBrowser()) {
    return null;
  }

  const currentUser = getAuthUser();

  if (!currentUser) {
    return null;
  }

  const updatedUser: AuthUser = {
    ...currentUser,
    ...updates,
  };

  /*
   * Save updated user without touching token.
   */
  localStorage.setItem(
    USER_KEY,
    JSON.stringify(updatedUser),
  );

  dispatchUserProfileUpdated();

  return updatedUser;
}


// ============================================================
// LOGOUT / CLEAR SESSION
// ============================================================

/*
 * Completely clear authentication session.
 *
 * Used when:
 *
 * - User logs out
 * - JWT expires
 * - Backend returns 401 Unauthorized
 * - Session becomes invalid
 * - Login attempt fails after partial session creation
 */
export function clearAuthSession(): void {
  if (!isBrowser()) {
    return;
  }

  /*
   * Remove JWT.
   */
  localStorage.removeItem(
    ACCESS_TOKEN_KEY,
  );

  /*
   * Remove authenticated user.
   */
  localStorage.removeItem(
    USER_KEY,
  );

  /*
   * Notify application components that authentication
   * state has changed.
   */
  dispatchAuthSessionUpdated();

  dispatchUserProfileUpdated();
}
