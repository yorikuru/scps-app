import { initializeApp, getApps, getApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountJson) {
  throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not defined");
}

const serviceAccount: ServiceAccount = JSON.parse(
  Buffer.from(serviceAccountJson, 'base64').toString('utf-8')
);

export const app = !getApps().length
  ? initializeApp({
      credential: cert(serviceAccount),
    })
  : getApp();

export const db = getFirestore(app);