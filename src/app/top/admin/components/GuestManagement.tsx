"use client";

import React, { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserPlus, Clock, Loader2 } from "lucide-react";
import { SchoolData, SYSTEM_MODULES } from "../page";

type Props = {
  schoolData: SchoolData | null;
  fetchUsers: (schoolId: string) => Promise<void>;
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function GuestManagement({ schoolData, fetchUsers, showAlert }: Props) {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestExpiresAt, setGuestExpiresAt] = useState("");
  const [guestModules, setGuestModules] = useState<string[]>([]);
  const [isProcessingGuest, setIsProcessingGuest] = useState(false);

  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolData) return;
    setIsProcessingGuest(true);

    try {
      const guestId = "guest_" + Date.now();
      await setDoc(doc(db, "users", guestId), {
        name: guestName + " (ゲスト)",
        email: guestEmail,
        role: "guest",
        schoolId: schoolData.id,
        accountStatus: "active",
        allowedModules: guestModules,
        expiresAt: guestExpiresAt,
        createdAt: new Date().toISOString()
      });

      showAlert("success", "ゲストアカウントを発行しました。");
      setGuestName("");
      setGuestEmail("");
      setGuestExpiresAt("");
      setGuestModules([]);
      fetchUsers(schoolData.id);
    } catch (error) {
      showAlert("error", "ゲストの発行に失敗しました。");
    } finally {
      setIsProcessingGuest(false);
    }
  };

  const toggleGuestModule = (moduleId: string) => {
    if (guestModules.includes(moduleId)) {
      setGuestModules(guestModules.filter(m => m !== moduleId));
    } else {
      setGuestModules([...guestModules, moduleId]);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-xl font-extrabold text-gray-900 flex items-center">
          <UserPlus className="h-6 w-6 mr-2 text-emerald-600" /> ゲストアカウントの発行
        </h3>
        <p className="text-sm text-gray-500 mt-1">外部講師や期間限定の委員など、一時的にシステムへアクセスできるアカウントを作成します。</p>
      </div>

      <form onSubmit={handleCreateGuest} className="bg-white shadow rounded-lg p-6 border border-gray-200 space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-bold text-gray-700">ゲスト氏名</label>
            <input type="text" required value={guestName} onChange={e => setGuestName(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="山田 太郎" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700">メールアドレス</label>
            <input type="email" required value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-emerald-500 focus:border-emerald-500 text-sm" placeholder="guest@example.com" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 flex items-center">
            <Clock className="h-4 w-4 mr-1 text-gray-400" /> 有効期限
          </label>
          <input type="date" required value={guestExpiresAt} onChange={e => setGuestExpiresAt(e.target.value)} className="mt-1 block w-full sm:w-1/2 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-emerald-500 focus:border-emerald-500 text-sm" />
          <p className="text-xs text-gray-500 mt-1">この日付を過ぎるとログインできなくなります。</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">許可する機能</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SYSTEM_MODULES.map(mod => (
              <label key={mod.id} className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${guestModules.includes(mod.id) ? "bg-emerald-50 border-emerald-300" : "bg-white hover:bg-gray-50"}`}>
                <input type="checkbox" checked={guestModules.includes(mod.id)} onChange={() => toggleGuestModule(mod.id)} className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded" />
                <span className="ml-3 text-sm font-bold text-gray-900">{mod.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button type="submit" disabled={isProcessingGuest} className={`w-full sm:w-auto inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-bold rounded-md text-white transition-colors ${isProcessingGuest ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"}`}>
            {isProcessingGuest ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <UserPlus className="h-5 w-5 mr-2" />}
            ゲストを発行する
          </button>
        </div>
      </form>
    </div>
  );
}