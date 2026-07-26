export interface SendOtpInput {
  phone: string;
}

export interface VerifyOtpInput {
  phone: string;
  otp: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}
