"use client";

import React, { useState } from "react";
import { sendEmailMessage, EmailCategory } from "@/lib/mail";
import { Loader2, CheckCircle, XCircle, Mail, ArrowRight } from "lucide-react";

const CATEGORIES: EmailCategory[] = [
  "default",
  "auth",
  "notice",
  "action",
  "admin_support",
  "alerts",
  "noreply",
  "billing",
  "news",
  "export"
];

export default function TestMailPage() {
  const [targetEmail, setTargetEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  
  // 各カテゴリのテスト結果を管理するステート
  const [results, setResults] = useState<
    Record<EmailCategory, { status: "idle" | "testing" | "success" | "error"; message?: string }>
  >(CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: { status: "idle" } }), {} as any));

  const handleTest = async () => {
    if (!targetEmail) {
      alert("送信先のメールアドレスを入力してください。");
      return;
    }

    setIsTesting(true);
    
    // 一度すべてのステータスを idle にリセット
    setResults(CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: { status: "idle" } }), {} as any));

    // サーバーに負荷をかけすぎないよう、1件ずつ順番に送信処理を行う
    for (const category of CATEGORIES) {
      setResults(prev => ({ ...prev, [category]: { status: "testing" } }));
      
      try {
        const subject = `【SCPS 送信テスト】カテゴリ: ${category}`;
        const htmlContent = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #2563eb;">SCPS 送信元アドレス テスト</h2>
            <p>このメールは、送信元設定（共有メールボックス）が正しく機能しているかを確認するためのテストメールです。</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="margin: 0; font-weight: bold;">使用されたカテゴリ: <span style="color: #dc2626;">${category}</span></p>
            </div>
          </div>
        `;

        const res = await sendEmailMessage(targetEmail, subject, htmlContent, category);

        if (res.success) {
          setResults(prev => ({ ...prev, [category]: { status: "success" } }));
        } else {
          setResults(prev => ({ ...prev, [category]: { status: "error", message: res.error } }));
        }
      } catch (error: any) {
        setResults(prev => ({ ...prev, [category]: { status: "error", message: error.message || "予期せぬエラー" } }));
      }
      
      // Microsoft Graph APIのレートリミット対策として1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsTesting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-6">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">メール動的振り分け 一斉テスト</h1>
              <p className="text-xs font-bold text-gray-500 mt-1">.env に設定した10カテゴリのアドレスから、指定した宛先へ順番にテストメールを送信します。</p>
            </div>
          </div>

          <div className="flex gap-3">
            <input
              type="email"
              placeholder="テストを受信するメールアドレスを入力"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              disabled={isTesting}
              className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
            />
            <button
              onClick={handleTest}
              disabled={isTesting || !targetEmail}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center min-w-[120px]"
            >
              {isTesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-4 h-4 mr-2" /> 送信開始</>}
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-sm font-black text-gray-900 mb-4">テスト実行結果</h2>
          <div className="space-y-2">
            {CATEGORIES.map(category => {
              const res = results[category];
              return (
                <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-sm font-bold text-gray-700 w-32">{category}</span>
                  <div className="flex-1 flex items-center justify-end">
                    {res.status === "idle" && <span className="text-xs font-bold text-gray-400">待機中...</span>}
                    {res.status === "testing" && <span className="text-xs font-bold text-blue-600 flex items-center"><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> 送信中...</span>}
                    {res.status === "success" && <span className="text-xs font-bold text-green-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1.5" /> 送信成功</span>}
                    {res.status === "error" && (
                      <div className="flex items-center text-red-600">
                        <XCircle className="w-4 h-4 mr-1.5" />
                        <span className="text-xs font-bold truncate max-w-xs" title={res.message}>{res.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}