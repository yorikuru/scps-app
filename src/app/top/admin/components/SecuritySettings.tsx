"use client";

import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldAlert, Fingerprint, Wifi, Plus, Trash2, Loader2, Globe, MapPin, Mail, ScanLine } from "lucide-react";
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

type MfaPolicy = {
  allowSetup: boolean;
  forceSetup: boolean;
  allowUsage: boolean;
};

type MfaPolicies = {
  email: MfaPolicy;
  totp: MfaPolicy;
  passkey: MfaPolicy;
};

export default function SecuritySettings({ schoolData, showAlert }: Props) {
  const [requireMfa, setRequireMfa] = useState(false);
  
  const [safeNetworks, setSafeNetworks] = useState<NetworkInfo[]>([]);
  const [showIpForm, setShowIpForm] = useState(false);
  const [isFetchingIp, setIsFetchingIp] = useState(false);
  
  const [currentIp, setCurrentIp] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [networkDetails, setNetworkDetails] = useState("");

  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // MFAの詳細ポリシー状態管理
  const [mfaPolicies, setMfaPolicies] = useState<MfaPolicies>({
    email: { allowSetup: true, forceSetup: false, allowUsage: true },
    totp: { allowSetup: false, forceSetup: false, allowUsage: false },
    passkey: { allowSetup: false, forceSetup: false, allowUsage: false },
  });

  useEffect(() => {
    if (schoolData) {
      setRequireMfa(schoolData.requireMfa || false);
      
      // ネットワークの読み込み
      if (schoolData.safeNetworks && Array.isArray(schoolData.safeNetworks)) {
        setSafeNetworks(schoolData.safeNetworks);
      } else if (schoolData.safeIps && Array.isArray(schoolData.safeIps)) {
        setSafeNetworks(schoolData.safeIps.map(ip => ({ ip, name: "登録済みネットワーク", details: "詳細不明" })));
      } else {
        setSafeNetworks([]);
      }
      
      // MFAポリシーの読み込み（以前の配列データとの後方互換性を含む）
      if (schoolData.mfaPolicies) {
        setMfaPolicies(schoolData.mfaPolicies);
      } else {
        const methods = schoolData.allowedMfaMethods || ["email"];
        setMfaPolicies({
          email: { allowSetup: methods.includes("email"), forceSetup: false, allowUsage: methods.includes("email") },
          totp: { allowSetup: methods.includes("totp"), forceSetup: false, allowUsage: methods.includes("totp") },
          passkey: { allowSetup: methods.includes("passkey"), forceSetup: false, allowUsage: methods.includes("passkey") },
        });
      }
    }
  }, [schoolData]);

  const fetchCurrentIp = async () => {
    setIsFetchingIp(true);
    try {
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
      showAlert("error", "IPアドレスが空欄です。"); return;
    }
    if (!networkName.trim()) {
      showAlert("error", "管理用のネットワーク名を入力してください。"); return;
    }
    if (safeNetworks.some(net => net.ip === currentIp.trim())) {
      showAlert("error", "このIPアドレスは既に登録されています。"); return;
    }

    setSafeNetworks([...safeNetworks, { 
      ip: currentIp.trim(), 
      name: networkName.trim(),
      details: networkDetails.trim() || "手動登録"
    }]);
    
    setCurrentIp(""); setNetworkName(""); setNetworkDetails(""); setShowIpForm(false);
  };

  const handleRemoveNetwork = (index: number) => {
    setSafeNetworks(safeNetworks.filter((_, i) => i !== index));
  };

  const updatePolicy = (methodKey: keyof MfaPolicies, field: keyof MfaPolicy, value: boolean) => {
    setMfaPolicies(prev => {
      const newPolicy = { ...prev[methodKey], [field]: value };
      
      // 矛盾を防ぐロジック
      if (field === 'forceSetup' && value) {
        newPolicy.allowSetup = true; // 強制するなら設定許可もON
      }
      if (field === 'allowSetup' && !value) {
        newPolicy.forceSetup = false; // 許可しないなら強制もOFF
      }
      
      return { ...prev, [methodKey]: newPolicy };
    });
  };

  const handleSaveSettings = async () => {
    if (!schoolData) return;
    setIsSavingSettings(true);
    try {
      const safeIpsArray = safeNetworks.map(net => net.ip);

      await updateDoc(doc(db, "schools", schoolData.id), {
        requireMfa: requireMfa,
        mfaPolicies: mfaPolicies, // 新しい詳細ポリシー構造で保存
        safeIps: safeIpsArray,
        safeNetworks: safeNetworks
      });
      
      showAlert("success", "セキュリティと認証の設定を保存しました。");
    } catch (error) {
      showAlert("error", "設定の保存に失敗しました。");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // メソッドごとのカードをレンダリングする内部コンポーネント
  const PolicyCard = ({ methodKey, name, icon: Icon, description }: { methodKey: keyof MfaPolicies, name: string, icon: any, description: string }) => {
    const policy = mfaPolicies[methodKey];
    return (
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <div className="flex items-center mb-2">
          <div className="bg-blue-50 p-2 rounded-lg mr-3">
            <Icon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h5 className="font-bold text-gray-900">{name}</h5>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-5 ml-12 leading-relaxed">{description}</p>
        
        <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg ml-12 border border-gray-100">
          <label className="flex flex-col items-center cursor-pointer">
            <span className="text-xs font-bold text-gray-700 mb-2">設定を許可</span>
            <div className="relative">
              <input type="checkbox" className="sr-only peer" checked={policy.allowSetup} onChange={(e) => updatePolicy(methodKey, 'allowSetup', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </div>
          </label>
          <label className="flex flex-col items-center cursor-pointer border-l border-r border-gray-200 px-2">
            <span className="text-xs font-bold text-gray-700 mb-2">設定を強制</span>
            <div className="relative">
              <input type="checkbox" className="sr-only peer" checked={policy.forceSetup} onChange={(e) => updatePolicy(methodKey, 'forceSetup', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
            </div>
          </label>
          <label className="flex flex-col items-center cursor-pointer">
            <span className="text-xs font-bold text-gray-700 mb-2 text-center">ログイン利用</span>
            <div className="relative">
              <input type="checkbox" className="sr-only peer" checked={policy.allowUsage} onChange={(e) => updatePolicy(methodKey, 'allowUsage', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </div>
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div>
        <h3 className="text-xl font-extrabold text-gray-900 flex items-center">
          <ShieldAlert className="h-6 w-6 mr-2 text-blue-600" /> セキュリティと認証設定
        </h3>
        <p className="text-sm text-gray-500 mt-2">組織全体のログインセキュリティレベルと、2段階認証（MFA）のポリシーを管理します。</p>
      </div>

      <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
          <h4 className="text-base font-bold text-gray-900">2段階認証 (MFA) ポリシー</h4>
          <p className="text-xs text-gray-500 mt-1">認証方法ごとに、設定の許可や強制ルールを細かく設定します。</p>
        </div>
        <div className="p-6 space-y-8">
          
          <div className="flex items-center justify-between bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <div>
              <h5 className="text-sm font-bold text-blue-900">テナント全体でのMFA必須化</h5>
              <p className="text-xs text-blue-700 mt-1">ONにすると、許可ネットワーク（セーフゾーン）以外のアクセスでは全ユーザーにMFAが強制されます。</p>
            </div>
            <label className="inline-flex relative items-center cursor-pointer flex-shrink-0 ml-4">
              <input type="checkbox" className="sr-only peer" checked={requireMfa} onChange={() => setRequireMfa(!requireMfa)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="space-y-4">
            <PolicyCard 
              methodKey="email" 
              name="メールアドレス認証" 
              icon={Mail} 
              description="登録されているメールアドレスにワンタイムコードを送信する基本的な認証方法です。"
            />
            <PolicyCard 
              methodKey="totp" 
              name="認証アプリ (TOTP)" 
              icon={ScanLine} 
              description="Google AuthenticatorやMicrosoft Authenticatorなどのアプリを使ったセキュアな認証です。"
            />
            <PolicyCard 
              methodKey="passkey" 
              name="パスキー (生体認証)" 
              icon={Fingerprint} 
              description="Touch ID、Face ID、Windows Helloなどの端末機能を使ったパスワードレスで最も安全な認証です。"
            />
          </div>
        </div>

        <div className="px-6 py-5 border-t border-b border-gray-200 bg-gray-50">
          <h4 className="text-base font-bold text-gray-900">2FA不要ゾーン（許可済みネットワーク）</h4>
          <p className="text-xs text-gray-500 mt-1">ここに登録された学校のWi-Fi等からのアクセスは安全とみなされ、MFAがスキップされます。</p>
        </div>
        <div className="p-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            {safeNetworks.length > 0 ? (
              <ul className="space-y-3">
                {safeNetworks.map((net, idx) => (
                  <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100 gap-2">
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
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-sm font-bold text-gray-500">登録されているネットワークはありません</p>
              </div>
            )}

            <div className="mt-5 border-t border-gray-100 pt-5">
              {!showIpForm ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={fetchCurrentIp} 
                    disabled={isFetchingIp} 
                    className="flex-1 flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    {isFetchingIp ? <Loader2 className="animate-spin h-4 w-4 mr-2 text-blue-600" /> : <Wifi className="h-4 w-4 mr-2 text-blue-600" />}
                    現在のWi-Fiを登録する
                  </button>
                  <button 
                    onClick={() => { setShowIpForm(true); setCurrentIp(""); setNetworkName(""); setNetworkDetails(""); }} 
                    className="flex-1 flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2 text-gray-600" />
                    手動でIPを追加する
                  </button>
                </div>
              ) : (
                <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 space-y-4 animate-in fade-in zoom-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">IPアドレス</label>
                      <input 
                        type="text" 
                        value={currentIp} 
                        onChange={(e) => setCurrentIp(e.target.value)} 
                        placeholder="例: 192.168.1.1" 
                        className="block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 font-mono" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">場所 / 接続情報 (自動取得)</label>
                      <input 
                        type="text" 
                        value={networkDetails} 
                        onChange={(e) => setNetworkDetails(e.target.value)} 
                        placeholder="例: Tokyo (NTT)" 
                        className="block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">ネットワーク名（表示用）</label>
                    <input 
                      type="text" 
                      value={networkName} 
                      onChange={(e) => setNetworkName(e.target.value)} 
                      placeholder="例: 職員室のWi-Fi" 
                      className="block w-full border border-gray-300 rounded-lg py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500" 
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      onClick={() => setShowIpForm(false)} 
                      className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      キャンセル
                    </button>
                    <button 
                      onClick={handleAddNetwork} 
                      className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                    >
                      リストに追加
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button 
            onClick={handleSaveSettings} 
            disabled={isSavingSettings} 
            className={`inline-flex justify-center items-center py-2.5 px-8 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white transition-colors ${
              isSavingSettings ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-black focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            }`}
          >
            {isSavingSettings ? (
              <><Loader2 className="animate-spin h-4 w-4 mr-2" /> 保存中...</>
            ) : (
              "セキュリティ設定を保存"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}