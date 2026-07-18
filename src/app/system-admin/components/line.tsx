"use client";

import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Building, Send, Wrench } from "lucide-react";
import { sendLineToAdmin } from "@/lib/line";

// 親コンポーネントから渡されるPropsの型定義
type TenantData = {
  id: string;
  name: string;
  [key: string]: any; // lineFeatureAllowed など動的なプロパティを許容
};

type GlobalUserData = {
  id: string;
  [key: string]: any;
};

type LineProps = {
  tenants: TenantData[];
  users: GlobalUserData[];
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function Line({ tenants, users, showAlert }: LineProps) {
  // 親から渡されたテナント情報をローカルステートで管理し、UIを即時反映させる
  const [localTenants, setLocalTenants] = useState<TenantData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    setLocalTenants(tenants);
  }, [tenants]);

  const toggleTenantAllowance = async (tenantId: string, currentStatus: boolean) => {
    setIsSaving(true);
    try {
      const newStatus = !currentStatus;
      
      // 親コンポーネントの仕様に合わせ、更新先のコレクションを "schools" に指定
      await updateDoc(doc(db, "schools", tenantId), {
        lineFeatureAllowed: newStatus
      });
      
      setLocalTenants(prev => 
        prev.map(t => t.id === tenantId ? { ...t, lineFeatureAllowed: newStatus } : t)
      );
      
      showAlert("success", `テナントのLINE連携を${newStatus ? '許可' : '停止'}しました。`);
    } catch (error) {
      console.error("Update error:", error);
      showAlert("error", "設定の保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSystemTestMessage = async () => {
    if (!testMessage.trim()) {
      showAlert("error", "テストメッセージを入力してください。");
      return;
    }
    
    setIsSaving(true);
    try {
      const result = await sendLineToAdmin(`【システムメンテナンス】\n${testMessage}`);
      
      if (result.success) {
        showAlert("success", "管理者宛てにテスト送信を行いました。");
        setTestMessage("");
      } else {
        showAlert("error", 'error' in result && result.error ? String(result.error) : "送信エラーが発生しました。");
      }
    } catch (error) {
      console.error(error);
      showAlert("error", "予期せぬエラーが発生しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center bg-gray-50">
          <Building className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-bold text-gray-900">テナント別 LINE機能許可設定</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            各学校（テナント）に対してLINE連携機能の利用を許可するかどうかを制御します。ここで許可されていないテナントは、テナント管理画面で機能をONにすることができません。
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">テナント名</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">テナント情報</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">LINE機能の許可</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {localTenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{tenant.name || "名称未設定"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono"> 管理ＩＤ: {tenant.id} <div className="text-xs text-gray-500">テナント: {tenant.schoolCode}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleTenantAllowance(tenant.id, !!tenant.lineFeatureAllowed)}
                        disabled={isSaving}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${tenant.lineFeatureAllowed ? 'bg-blue-600' : 'bg-gray-200'} disabled:opacity-50`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${tenant.lineFeatureAllowed ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
                {localTenants.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">テナントが見つかりません。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center bg-gray-50">
          <Wrench className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-bold text-gray-900">メンテナンス用ツール</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">システム管理者宛て疎通テスト</label>
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="環境変数 LINE_TEST_USER_ID 宛てにメッセージを強制送信します。"
              rows={3}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 px-4 py-3 text-sm font-medium transition-colors"
            />
          </div>
          <button
            onClick={handleSystemTestMessage}
            disabled={isSaving}
            className="inline-flex items-center px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-70 transition-colors"
          >
            {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            システムテスト実行
          </button>
        </div>
      </div>
    </div>
  );
}