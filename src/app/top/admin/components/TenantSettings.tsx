"use client";

import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Settings, ShieldAlert, Fingerprint, Wifi, Plus, Trash2, Loader2, Globe, MapPin } from "lucide-react";
import { SchoolData } from "../page";

type Props = {
  schoolData: SchoolData | null;
  showAlert: (type: "success" | "error", message: string) => void;
};

type NetworkInfo = {
  ip: string;
  name: string;
  details?: string;
};

export default function TenantSettings({ schoolData, showAlert }: Props) {
  const [allowGoogle, setAllowGoogle] = useState(false);
  const [allowMicrosoft, setAllowMicrosoft] = useState(false);
  const [requireMfa, setRequireMfa] = useState(false);
  
  const [safeNetworks, setSafeNetworks] = useState<NetworkInfo[]>([]);
  const [showIpForm, setShowIpForm] = useState(false);
  const [isFetchingIp, setIsFetchingIp] = useState(false);
  
  const [currentIp, setCurrentIp] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [networkDetails, setNetworkDetails] = useState("");

  const [mfaMethods, setMfaMethods] = useState({ email: true, sms: false, totp: false, passkey: false });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (schoolData) {
      setAllowGoogle(schoolData.allowedAuthProviders?.includes("google") || schoolData.allowedAuthProviders?.includes("all") || false);
      setAllowMicrosoft(schoolData.allowedAuthProviders?.includes("microsoft") || schoolData.allowedAuthProviders?.includes("all") || false);
      setRequireMfa(schoolData.requireMfa || false);
      
      if (schoolData.safeNetworks && Array.isArray(schoolData.safeNetworks)) {
        setSafeNetworks(schoolData.safeNetworks);
      } else if (schoolData.safeIps && Array.isArray(schoolData.safeIps)) {
        setSafeNetworks(schoolData.safeIps.map(ip => ({ ip, name: "登録済みネットワーク", details: "詳細不明" })));
      } else {
        setSafeNetworks([]);
      }
      
      const methods = schoolData.allowedMfaMethods || ["email"];
      setMfaMethods({
        email: methods.includes("email"),
        sms: methods.includes("sms"),
        totp: methods.includes("totp"),
        passkey: methods.includes("passkey")
      });
    }
  }, [schoolData]);

  // ネットワーク情報の詳細（場所やISP）を取得
  const fetchCurrentIp = async () => {
    setIsFetchingIp(true);
    try {
      // 1. IPと地域・プロバイダ情報を取得 (ipapi.co)
      const res = await fetch("https://ipapi.co/json/");
      if (res.ok) {
        const data = await res.json();
        setCurrentIp(data.ip);
        
        const locationText = [data.region, data.city].filter(Boolean).join(" ");
        const ispText = data.org ? `(${data.org})` : "";
        setNetworkDetails(`${locationText} ${ispText}`.trim());
      } else {
        throw new Error("Detailed API failed");
      }
    } catch (error) {
      // 2. 失敗した場合はIPアドレスのみ取得 (ipify)
      try {
        const backupRes = await fetch("https://api.ipify.org?format=json");
        const backupData = await backupRes.json();
        setCurrentIp(backupData.ip);
        setNetworkDetails("位置情報取得不可");
      } catch (fallbackError) {
        showAlert("error", "現在のネットワーク情報の取得に失敗しました。");
        setIsFetchingIp(false);
        return;
      }
    }
    setShowIpForm(true);
    setIsFetchingIp(false);
  };

  const handleAddNetwork = () => {
    if (!currentIp.trim()) {
      showAlert("error", "IPアドレスが空欄です。");
      return;
    }
    if (!networkName.trim()) {
      showAlert("error", "管理用のネットワーク名を入力してください。");
      return;
    }
    if (safeNetworks.some(net => net.ip === currentIp.trim())) {
      showAlert("error", "このIPアドレスは既に登録されています。");
      return;
    }

    setSafeNetworks([...safeNetworks, { 
      ip: currentIp.trim(), 
      name: networkName.trim(),
      details: networkDetails.trim() || "手動登録"
    }]);
    
    setCurrentIp("");
    setNetworkName("");
    setNetworkDetails("");
    setShowIpForm(false);
  };

  const handleRemoveNetwork = (index: number) => {
    setSafeNetworks(safeNetworks.filter((_, i) => i !== index));
  };

  const handleSaveSettings = async () => {
    if (!schoolData) return;
    setIsSavingSettings(true);
    try {
      const newProviders = ["password"];
      if (allowGoogle) newProviders.push("google");
      if (allowMicrosoft) newProviders.push("microsoft");

      const allowedMethodsArray = Object.entries(mfaMethods).filter(([_, isEnabled]) => isEnabled).map(([key]) => key);
      const safeIpsArray = safeNetworks.map(net => net.ip);

      await updateDoc(doc(db, "schools", schoolData.id), {
        allowedAuthProviders: newProviders,
        requireMfa: requireMfa,
        allowedMfaMethods: allowedMethodsArray,
        safeIps: safeIpsArray,
        safeNetworks: safeNetworks
      });
      
      showAlert("success", "組織設定とセキュリティ設定を保存しました。");
    } catch (error) {
      showAlert("error", "設定の保存に失敗しました。");
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div>
        <h3 className="text-xl font-extrabold text-gray-900 flex items-center">
          <Settings className="h-6 w-6 mr-2 text-gray-600" /> テナント（学校）基本設定
        </h3>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h4 className="text-base font-bold text-gray-900">外部連携ログイン許可</h4>
          <p className="text-xs text-gray-500 mt-1">テナント内の全ユーザーに対する、ソーシャルログインの許可状態を制御します。</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-sm font-bold text-gray-900">Google アカウントログイン</h5>
              <p className="text-xs text-gray-500 mt-1">@gmail.com または Google Workspaceアカウントでの連携を許可</p>
            </div>
            <label className="inline-flex relative items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={allowGoogle} onChange={() => setAllowGoogle(!allowGoogle)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <hr className="border-gray-200" />
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-sm font-bold text-gray-900">Microsoft アカウントログイン</h5>
              <p className="text-xs text-gray-500 mt-1">学校配布のMicrosoft 365 (Entra ID) アカウントでの連携を許可</p>
            </div>
            <label className="inline-flex relative items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={allowMicrosoft} onChange={() => setAllowMicrosoft(!allowMicrosoft)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-b border-gray-200 bg-gray-50">
          <h4 className="text-base font-bold text-gray-900 flex items-center">
            <ShieldAlert className="h-5 w-5 mr-2 text-blue-600" /> セキュリティ・2段階認証 (MFA)
          </h4>
          <p className="text-xs text-gray-500 mt-1">ログイン時の二要素認証に関する強制ルールや許可メソッドを設定します。</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between bg-blue-50/50 p-4 rounded-lg border border-blue-100">
            <div>
              <h5 className="text-sm font-bold text-blue-900">テナント全体でのMFA必須化</h5>
              <p className="text-xs text-blue-700 mt-1">オンにすると、以下のセーフゾーン以外のアクセスでは全ユーザーにMFAが強制されます。</p>
            </div>
            <label className="inline-flex relative items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={requireMfa} onChange={() => setRequireMfa(!requireMfa)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <h5 className="text-sm font-bold text-gray-900 mb-2">許可する認証方式</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center space-x-2 border border-gray-200 p-3 rounded-md cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={mfaMethods.email} onChange={(e) => setMfaMethods({...mfaMethods, email: e.target.checked})} className="text-blue-600 rounded" />
                <span className="text-sm font-bold text-gray-700">メール認証</span>
              </label>
              <label className="flex items-center space-x-2 border border-gray-200 p-3 rounded-md cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={mfaMethods.sms} onChange={(e) => setMfaMethods({...mfaMethods, sms: e.target.checked})} className="text-blue-600 rounded" />
                <span className="text-sm font-bold text-gray-700">SMS認証</span>
              </label>
              <label className="flex items-center space-x-2 border border-gray-200 p-3 rounded-md cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={mfaMethods.totp} onChange={(e) => setMfaMethods({...mfaMethods, totp: e.target.checked})} className="text-blue-600 rounded" />
                <span className="text-sm font-bold text-gray-700">認証アプリ</span>
              </label>
              <label className="flex items-center space-x-2 border border-gray-200 p-3 rounded-md cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={mfaMethods.passkey} onChange={(e) => setMfaMethods({...mfaMethods, passkey: e.target.checked})} className="text-blue-600 rounded" />
                <span className="text-sm font-bold text-gray-700 flex items-center"><Fingerprint className="h-4 w-4 mr-1"/> パスキー</span>
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-2">※ SMSやパスキーを利用するには、別途Identity Platformでの課金設定と有効化が必要です。</p>
          </div>

          <div>
            <h5 className="text-sm font-bold text-gray-900 mb-2">2FA不要ゾーン（許可済みネットワーク）</h5>
            <p className="text-xs text-gray-500 mb-4">
              ここに登録されたネットワーク（Wi-Fi等）からアクセスした場合は、安全な場所とみなされMFAがスキップされます。
            </p>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              {safeNetworks.length > 0 ? (
                <ul className="space-y-3">
                  {safeNetworks.map((net, idx) => (
                    <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-100 gap-2">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{net.name}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center text-xs text-gray-500 mt-1 gap-2">
                          <span className="font-mono flex items-center bg-gray-200/50 px-1.5 py-0.5 rounded">
                            <Globe className="h-3 w-3 mr-1" /> {net.ip}
                          </span>
                          {net.details && (
                            <span className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1 text-gray-400" /> {net.details}
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveNetwork(idx)} 
                        className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors self-end sm:self-auto"
                        title="このネットワークを削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-md border border-dashed border-gray-300">
                  <p className="text-sm text-gray-500">登録されているネットワークはありません。</p>
                </div>
              )}

              <div className="mt-4 border-t border-gray-200 pt-4">
                {!showIpForm ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={fetchCurrentIp} 
                      disabled={isFetchingIp} 
                      className="flex-1 flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      {isFetchingIp ? <Loader2 className="animate-spin h-4 w-4 mr-2 text-blue-600" /> : <Wifi className="h-4 w-4 mr-2 text-blue-600" />}
                      現在のWi-Fiを登録する
                    </button>
                    <button 
                      onClick={() => { setShowIpForm(true); setCurrentIp(""); setNetworkName(""); setNetworkDetails(""); }} 
                      className="flex-1 flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-2 text-gray-600" />
                      手動で追加する
                    </button>
                  </div>
                ) : (
                  <div className="bg-blue-50/50 p-4 rounded-md border border-blue-200 space-y-4 animate-in fade-in zoom-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">IPアドレス</label>
                        <input 
                          type="text" 
                          value={currentIp} 
                          onChange={(e) => setCurrentIp(e.target.value)} 
                          placeholder="例: 192.168.1.1" 
                          className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 font-mono" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">場所 / 接続情報 (自動取得)</label>
                        <input 
                          type="text" 
                          value={networkDetails} 
                          onChange={(e) => setNetworkDetails(e.target.value)} 
                          placeholder="例: Tokyo (NTT)" 
                          className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">ネットワーク名（表示用）</label>
                      <input 
                        type="text" 
                        value={networkName} 
                        onChange={(e) => setNetworkName(e.target.value)} 
                        placeholder="例: 学校のメインWi-Fi" 
                        className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500" 
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        onClick={() => setShowIpForm(false)} 
                        className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        キャンセル
                      </button>
                      <button 
                        onClick={handleAddNetwork} 
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
                      >
                        リストに追加
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button 
            onClick={handleSaveSettings} 
            disabled={isSavingSettings} 
            className={`inline-flex justify-center items-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-bold rounded-md text-white transition-colors ${
              isSavingSettings ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-black focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            }`}
          >
            {isSavingSettings ? (
              <><Loader2 className="animate-spin h-4 w-4 mr-2" /> 保存中...</>
            ) : (
              "設定を保存する"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}