"use client";

import React, { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Building2, User } from "lucide-react";

type Props = {
  onSubmit: (password: string) => void;
  isLoading: boolean;
  isValidatingToken: boolean;
  accountInfo: { name: string; schoolName: string } | null;
};

export default function ResetForm({ onSubmit, isLoading, isValidatingToken, accountInfo }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // リアルタイム・バリデーション用ステート
  const [validation, setValidation] = useState({
    isMinLength: false,
    hasThreeTypes: false,
    matchConfirm: false,
    isAllValid: false
  });

  // 入力中のリアルタイム検証ロジック
  useEffect(() => {
    const isMinLength = password.length >= 8;

    // 4つのキャラクタータイプチェック
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[@!?#$%&]/.test(password);

    // 何種類使われているかをカウント
    const typeCount = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
    const hasThreeTypes = typeCount >= 3;

    const matchConfirm = password.length > 0 && password === confirmPassword;

    setValidation({
      isMinLength,
      hasThreeTypes,
      matchConfirm,
      isAllValid: isMinLength && hasThreeTypes && matchConfirm
    });
  }, [password, confirmPassword]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validation.isAllValid) {
      if (!validation.isMinLength) setError("パスワードは8文字以上必要です。");
      else if (!validation.hasThreeTypes) setError("大文字・小文字・数字・記号のうち3種類以上を組み合わせてください。"); // ←修正箇所
      else if (!validation.matchConfirm) setError("再入力されたパスワードが一致しません。");
      return;
    }

    onSubmit(password);
  };

  if (isValidatingToken) {
    return (
      <div className="text-center py-12 space-y-4">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600 mx-auto" />
        <p className="text-sm text-gray-500 font-bold">アカウント情報と認証リンクを確認しています...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
      {/* 対象アカウント情報インフォメーションカード */}
      {accountInfo && (
        <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-4 rounded-xl border border-blue-100/70 space-y-2 mb-2">
          <div className="flex items-center text-xs font-bold text-blue-800">
            <Building2 className="h-3.5 w-3.5 mr-1.5 flex-shrink-0 text-blue-500" />
            <span className="text-gray-500 mr-2">所属組織:</span>
            <span className="truncate">{accountInfo.schoolName}</span>
          </div>
          <div className="flex items-center text-sm font-black text-gray-900">
            <User className="h-4 w-4 mr-1.5 flex-shrink-0 text-indigo-500" />
            <span className="text-xs text-gray-500 font-bold mr-2">対象ユーザー:</span>
            <span className="tracking-wide">{accountInfo.name} 様</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex items-start">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">新しいパスワード</label>
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Key className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full pl-10 pr-10 border border-gray-200 rounded-xl py-3 text-sm transition-all bg-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-mono"
            placeholder="新しいパスワードを入力"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Key className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">新しいパスワード（確認用）</label>
        <div className="relative rounded-xl shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Key className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="block w-full pl-10 border border-gray-200 rounded-xl py-3 text-sm transition-all bg-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-mono"
            placeholder="確認のためもう一度入力"
          />
        </div>
      </div>

      {/* リアルタイムチェックリストUI */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2.5">
        <p className="text-xs font-extrabold text-gray-800 border-b border-gray-100 pb-1.5">🔐 パスワードの要件</p>
        
        <div className="flex items-center text-xs font-bold transition-colors">
          <CheckCircle2 className={`h-4 w-4 mr-2 flex-shrink-0 transition-transform ${validation.isMinLength ? "text-green-500 scale-110" : "text-gray-300"}`} />
          <span className={validation.isMinLength ? "text-green-700 line-through opacity-80" : "text-gray-600"}>8文字以上であること</span>
        </div>

        <div className="flex items-start text-xs font-bold transition-colors">
          <CheckCircle2 className={`h-4 w-4 mr-2 flex-shrink-0 mt-0.5 transition-transform ${validation.hasThreeTypes ? "text-green-500 scale-110" : "text-gray-300"}`} />
          <div className="flex flex-col">
            <span className={validation.hasThreeTypes ? "text-green-700 line-through opacity-80" : "text-gray-600"}>
              英大文字、英小文字、数字、記号のうちいずれか3種以上を使用
            </span>
          </div>
        </div>

        <div className="flex items-center text-xs font-bold transition-colors border-t border-gray-50 pt-2">
          <CheckCircle2 className={`h-4 w-4 mr-2 flex-shrink-0 transition-transform ${validation.matchConfirm ? "text-green-500 scale-110" : "text-gray-300"}`} />
          <span className={validation.matchConfirm ? "text-green-700" : "text-gray-600"}>パスワードが一致していること</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !validation.isAllValid}
        className={`w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white transition-all active:scale-[0.98] ${
          validation.isAllValid && !isLoading 
            ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200" 
            : "bg-gray-300 cursor-not-allowed shadow-none"
        }`}
      >
        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "パスワードを確定して保存"}
      </button>
    </form>
  );
}