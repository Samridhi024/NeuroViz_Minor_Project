import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import type { ApiResponse } from '@samruddhi-agros/shared-types';

export interface ApiClientConfig {
  baseURL: string;
  getToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokenRefreshed: (accessToken: string, refreshToken: string) => void;
  onAuthFailed: () => void;
}

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseURL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Request interceptor — attach JWT
  client.interceptors.request.use((req: InternalAxiosRequestConfig) => {
    const token = config.getToken();
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
  });

  // Response interceptor — handle 401 refresh
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiResponse<unknown>>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        const refreshToken = config.getRefreshToken();

        if (refreshToken) {
          try {
            const { data } = await axios.post(`${config.baseURL}/auth/refresh`, { refreshToken });
            if (data.success && data.data) {
              config.onTokenRefreshed(data.data.accessToken, data.data.refreshToken);
              originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
              return client(originalRequest);
            }
          } catch {
            config.onAuthFailed();
          }
        } else {
          config.onAuthFailed();
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

export { axios };
export type { AxiosInstance, AxiosError };
