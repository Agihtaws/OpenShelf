// src/app/auth/login/types.ts
export type UserType = 'customer' | 'librarian' | 'admin';
export type AuthMode = 'login' | 'resetKey' | 'verifyDevice';

export interface FormData {
  email: string;
  password: string;
  securityKey?: string;
  employeeId?: string;
  rememberMe: boolean;
}

export interface FormErrors {
  email?: string;
  employeeId?: string;
  password?: string;
  securityKey?: string;
  general?: string;
}
