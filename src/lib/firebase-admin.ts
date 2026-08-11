import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth'; // ★ 追加

const initializeFirebaseAdmin = () => {
  // Cloud Run や Next.js のホットリロード対策：すでに初期化済みの場合は既存のインスタンスを返す
  if (getApps().length > 0) {
    return getApp();
  }

  try {
    let rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!rawKey) {
      throw new Error("環境変数 GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません。");
    }

    // 両端のダブルクォーテーションやシングルクォーテーションを取り除く
    rawKey = rawKey.trim();
    if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
      rawKey = rawKey.slice(1, -1);
    }

    let serviceAccount;
    try {
      // まずはそのままJSON文字列としてパースを試みる
      serviceAccount = JSON.parse(rawKey);
    } catch (parseError) {
      // そのままパースして失敗した場合は、Base64エンコードされているとみなしてデコードする
      const decodedKey = Buffer.from(rawKey, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decodedKey);
    }
    
    return initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin の初期化に失敗しました:', error);
    throw error;
  }
};

// 安全に初期化されたアプリインスタンスを取得
const app = initializeFirebaseAdmin();

// インスタンス再利用時のエラーを防ぐため、明示的に app を渡して Firestore と Auth を取得
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app); // ★ 追加