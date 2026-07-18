"use client";

import React, { useState } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function ApplyPage() {
  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState("high_school");
  const [repName, setRepName] = useState("");
  const [repRole, setRepRole] = useState("officer");
  const [email, setEmail] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert({ show: false, type: "success", message: "" });

    if (repRole === "student") {
      setAlert({ show: true, type: "error", message: "一般生徒は学校テナントを新規作成できません。管理者または生徒会役員が申請してください。" });
      return;
    }

    setIsLoading(true);

    try {
      // 1. 学校コード（8桁の数字）を自動生成
      const codeDigits = Math.floor(10000000 + Math.random() * 90000000).toString();
      const fullSchoolCode = `SCPS-${codeDigits}`;

      // 2. 申請データの一時IDを生成
      const applicationRef = doc(collection(db, "tenant_applications"));
      const appId = applicationRef.id;

      // 3. 申請データを一時保存（本登録画面で引き継ぐため）
      await setDoc(applicationRef, {
        schoolName: schoolName.trim(),
        schoolType: schoolType,
        repName: repName.trim(),
        repRole: repRole,
        email: email.trim(),
        schoolCode: fullSchoolCode,
        createdAt: serverTimestamp(),
      });

      // 4. 自作のAPIルートを呼び出してメールを送信
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          appId: appId,
          schoolName: schoolName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      setIsSuccess(true);
      setAlert({ show: true, type: "success", message: "確認メールを送信しました。" });

    } catch (error: any) {
      console.error("Apply error: ", error);
      setAlert({ show: true, type: "error", message: "メールの送信に失敗しました。ターミナル（コンソール）のエラーを確認してください。" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">SCPS 利用申請（学校登録）</h2>
        <p className="mt-2 text-sm text-gray-600">あなたの学校の専用ポータル（テナント）を新規作成します。</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        {alert.show && (
          <div className={`mb-6 p-4 rounded-md text-sm font-medium ${alert.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {alert.message}
          </div>
        )}

        {isSuccess ? (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">確認メールを送信しました</h3>
            <p className="text-gray-600 mb-6">
              ご入力いただいたメールアドレスに、本登録用のリンクを送信しました。<br/>
              メール内のリンクをクリックして、テナントの作成とパスワード設定を完了させてください。
            </p>
            <p className="text-xs text-gray-400">※メールが届かない場合は、迷惑メールフォルダもご確認ください。</p>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* 学校情報 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">学校情報</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700">学校名 <span className="text-red-500">*</span></label>
                  <input type="text" required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: 熊本県立熊本高等学校" />
                  <p className="mt-1 text-xs text-red-500 font-bold">※必ず学校の「正式名称」でご記入ください。略称は使用しないでください。</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">学校区分 <span className="text-red-500">*</span></label>
                  <select required value={schoolType} onChange={(e) => setSchoolType(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 bg-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900">
                    <option value="elementary">小学校</option>
                    <option value="junior_high">中学校</option>
                    <option value="high_school">高等学校</option>
                    <option value="combined">中高一貫校</option>
                    <option value="university">大学・短大</option>
                    <option value="other">その他</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 代表者情報 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">代表者（アカウント管理者）情報</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700">氏名 <span className="text-red-500">*</span></label>
                  <input type="text" required value={repName} onChange={(e) => setRepName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="例: 熊本 太郎" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">代表者の区分 <span className="text-red-500">*</span></label>
                  <select required value={repRole} onChange={(e) => setRepRole(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 bg-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900">
                    <option value="officer">生徒会役員</option>
                    <option value="teacher">教員</option>
                    <option value="admin_staff">管理職員</option>
                    <option value="student">一般生徒</option>
                  </select>
                  {repRole === "student" && <p className="mt-1 text-xs text-red-500 font-bold">エラー：一般生徒はテナントを作成できません。</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">メールアドレス <span className="text-red-500">*</span></label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900" placeholder="連絡がつく有効なアドレス" />
                  <p className="mt-1 text-xs text-gray-500">※申請後、このアドレス宛に本登録用のリンクをお送りします。</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading || repRole === "student"}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-bold text-white ${
                  isLoading || repRole === "student" ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                }`}
              >
                {isLoading ? "送信中..." : "認証メールを送信する"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}