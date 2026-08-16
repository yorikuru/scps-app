// src/app/types/external.ts

export type ExternalUserCategory = "student" | "teacher" | "other";
export type ExternalUserStatus = "pending" | "verifying" | "verified" | "active" | "suspended";

export type ExternalUser = {
  id: string;
  schoolId: string;
  loginId: string;
  name: string;
  nameKana?: string;
  email?: string;
  phoneNumber?: string;
  category: ExternalUserCategory;
  affiliation?: string;
  
  // 有効期間
  validFrom: string;
  validUntil?: string | null;
  expiresAt?: string | null; 
  
  // 認証・ステータス
  status: ExternalUserStatus;
  authUid?: string | null;
  initialPassword?: string;
  
  // システム利用権限（チャット、アンケート、回覧板など）
  allowedModules?: string[];
  
  note?: string;
  
  // 監査ログ
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt?: string;
  updatedBy?: string;
};