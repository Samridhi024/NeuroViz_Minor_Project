import { SendOtpInput, VerifyOtpInput, AuthTokens } from './auth.types.js';

export class AuthService {
  async sendOtp(input: SendOtpInput): Promise<{ message: string }> {
    // TODO: Generate OTP, store in Redis with TTL, send via MSG91
    throw new Error('Not implemented');
  }

  async verifyOtp(input: VerifyOtpInput): Promise<AuthTokens> {
    // TODO: Verify OTP from Redis, create/find user, generate JWT tokens
    throw new Error('Not implemented');
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // TODO: Verify refresh token, generate new token pair
    throw new Error('Not implemented');
  }

  async logout(userId: string): Promise<void> {
    // TODO: Blacklist current token in Redis
  }
}

export const authService = new AuthService();
