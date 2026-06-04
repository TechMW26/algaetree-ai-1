export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  CUSTOMER: "CUSTOMER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_VALUES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.CUSTOMER,
];

export const ACCESS_TYPES = {
  ALL: "ALL",
  CUSTOM: "CUSTOM",
} as const;

export type AccessType = (typeof ACCESS_TYPES)[keyof typeof ACCESS_TYPES];

// Every role lands on the map home ("/") after login. Admins/Super Admins
// reach their management console via the in-app "Manage" button.
export const ROLE_HOME: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "/",
  [ROLES.ADMIN]: "/",
  [ROLES.CUSTOMER]: "/",
};

// The management console each privileged role can open from the home header.
export const ROLE_CONSOLE: Partial<Record<Role, string>> = {
  [ROLES.SUPER_ADMIN]: "/super-admin",
  [ROLES.ADMIN]: "/admin",
};

// OTP / session timings
export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Login lockout
export const MAX_FAILED_LOGINS = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000; // 15 minutes

// Cookie names
export const ACCESS_COOKIE = "at_access";
export const REFRESH_COOKIE = "at_refresh";
