import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Cloud Run再利用対策とBase64環境変数対応を組み込んだ堅牢な初期化
export function getAdminDb() {
  if (getApps().length === 0) {
    let credential;
    const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (base64Key) {
      const decodedKey = Buffer.from(base64Key, 'base64').toString('utf8');
      credential = cert(JSON.parse(decodedKey));
    }
    initializeApp({ credential });
  }
  // 常に明示的に app を渡してインスタンスを取得する
  const app = getApp();
  return getFirestore(app);
}

// パスキー認証で表示されるシステム名
export const rpName = "生徒会ポータルシステム";

// ドメイン設定 (ローカル開発時は localhost)
export const rpID = process.env.NEXT_PUBLIC_RP_ID || "localhost";
export const origin = process.env.NEXT_PUBLIC_ORIGIN || `http://${rpID}:3000`;