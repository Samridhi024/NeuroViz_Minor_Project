export interface AdminLoginInput {
  phone: string;
  password: string;
}

export interface KycActionInput {
  action: 'APPROVE' | 'REJECT';
  reason?: string;
}
