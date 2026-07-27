"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowRight, ShieldAlert, Smartphone, Scan, KeyRound, Loader2, CheckCircle2, Apple, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "firebase/auth";

type Props = {
  currentUser: User | null;
  userData: any;
  setUserData: React.Dispatch<React.SetStateAction<any>>;
  showAlert: (type: "success" | "error", message: string) => void;
  onClose: () => void;
};

export default function TotpSetupModal({ currentUser, userData, setUserData, showAlert, onClose }: Props) {
  const [setupStep, setSetupStep] = useState<number>(0);
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; uri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [deviceType, setDeviceType] = useState<"loading" | "pc" | "ios" | "android">("loading");

  const APP_URLS = {
    ms: {
      ios: "https://apps.apple.com/jp/app/microsoft-authenticator/id983156458",
      android: "https://play.google.com/store/apps/details?id=com.azure.authenticator&hl=ja"
    },
    google: {
      ios: "https://apps.apple.com/jp/app/google-authenticator/id388497605",
      android: "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2&hl=ja"
    }
  };

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDeviceType("ios");
    } else if (/android/.test(ua)) {
      setDeviceType("android");
    } else {
      setDeviceType("pc");
    }
    handleStartTotpSetup();
  }, []);

  const handleStartTotpSetup = async () => {
    if (!currentUser?.email) {
      showAlert("error", "メールアドレスが登録されていないため、設定できません。");
      onClose();
      return;
    }
    
    setSetupStep(1);
    try {
      const res = await fetch('/api/totp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      const data = await res.json();
      
      if (res.ok) {
        setTotpSetupData(data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      showAlert("error", "設定用データの生成に失敗しました。再度お試しください。");
      onClose();
    }
  };

  const handleVerifyTotp = async () => {
    if (!totpSetupData || mfaCode.length !== 6 || !currentUser) return;
    setIsVerifying(true);

    try {
      const res = await fetch('/api/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mfaCode, secret: totpSetupData.secret })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "コードが正しくありません。");
      }

      await updateDoc(doc(db, "users", currentUser.uid), {
        totpSecret: totpSetupData.secret
      });

      setUserData((prev: any) => prev ? { ...prev, totpSecret: totpSetupData.secret } : null);
      
      // セキュリティ通知メールの送信
      await fetch('/api/send-security-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, action: '認証アプリ (TOTP) の連携が設定されました' })
      });

      setSetupStep(4); 
      showAlert("success", "認証アプリの設定が完了しました！");
      
    } catch (error: any) {
      showAlert("error", error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col relative border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white/95 sticky top-0 z-10">
          <div className="flex items-center text-blue-900">
            <ShieldAlert className="h-5 w-5 mr-2 text-blue-600" />
            <h3 className="text-base font-extrabold">認証アプリの設定</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
          <div className="max-w-xl mx-auto mb-10">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full -z-10"></div>
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-blue-500 rounded-full transition-all duration-500 -z-10" style={{ width: `${((setupStep - 1) / 3) * 100}%` }}></div>
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className={`flex items-center justify-center h-8 w-8 rounded-full border-2 text-sm font-bold transition-all duration-300 bg-white shadow-sm ${setupStep >= step ? "border-blue-600 text-blue-600 ring-4 ring-blue-50" : "border-gray-300 text-gray-400"}`}>
                  {step === 4 ? <CheckCircle2 className="h-4 w-4" /> : step}
                </div>
              ))}
            </div>
          </div>

          <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
            {setupStep === 1 && (
              <div className="text-center animate-fade-in">
                <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                  <Smartphone className="h-8 w-8 text-blue-600" />
                </div>
                <h4 className="text-xl font-extrabold text-gray-900 mb-3">アプリを準備する</h4>
                <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                  お手持ちのスマートフォンに <b>Microsoft Authenticator</b> または <b>Google Authenticator</b> などの認証用アプリをインストールしてください。
                </p>

                {deviceType !== "loading" && (
                  <div className="grid gap-6 sm:grid-cols-2 mb-10 text-left">
                    {/* Microsoft */}
                    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-center sm:justify-start mb-4">
                          <svg className="h-6 w-6 mr-2 flex-shrink-0" viewBox="0 0 21 21">
                            <path d="M0 0h10v10H0z" fill="#f25022"/><path d="M11 0h10v10H11z" fill="#7fba00"/><path d="M0 11h10v10H0z" fill="#00a4ef"/><path d="M11 11h10v10H11z" fill="#ffb900"/>
                          </svg>
                          <h6 className="font-bold text-sm text-gray-900">Microsoft<br/>Authenticator</h6>
                        </div>
                        
                        {deviceType === "pc" && (
                          <div className="flex justify-center gap-4 mb-4">
                            <div className="text-center">
                              <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm inline-block">
                                <QRCodeSVG value={APP_URLS.ms.ios} size={70} />
                              </div>
                              <p className="text-[10px] mt-1.5 font-bold text-gray-500 flex items-center justify-center"><Apple className="h-3 w-3 mr-0.5"/>iPhone</p>
                            </div>
                            <div className="text-center">
                              <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm inline-block">
                                <QRCodeSVG value={APP_URLS.ms.android} size={70} />
                              </div>
                              <p className="text-[10px] mt-1.5 font-bold text-gray-500">Android</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 mt-auto">
                        {(deviceType === "pc" || deviceType === "ios") && (
                          <a href={APP_URLS.ms.ios} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full bg-gray-900 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-black transition-colors">
                            <Apple className="h-4 w-4 mr-1.5" /> App Store で入手
                          </a>
                        )}
                        {(deviceType === "pc" || deviceType === "android") && (
                          <a href={APP_URLS.ms.android} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full bg-blue-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                            <Download className="h-4 w-4 mr-1.5" /> Google Play で入手
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Google */}
                    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-center sm:justify-start mb-4">
                          <svg className="h-6 w-6 mr-2 flex-shrink-0" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          <h6 className="font-bold text-sm text-gray-900">Google<br/>Authenticator</h6>
                        </div>

                        {deviceType === "pc" && (
                          <div className="flex justify-center gap-4 mb-4">
                            <div className="text-center">
                              <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm inline-block">
                                <QRCodeSVG value={APP_URLS.google.ios} size={70} />
                              </div>
                              <p className="text-[10px] mt-1.5 font-bold text-gray-500 flex items-center justify-center"><Apple className="h-3 w-3 mr-0.5"/>iPhone</p>
                            </div>
                            <div className="text-center">
                              <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm inline-block">
                                <QRCodeSVG value={APP_URLS.google.android} size={70} />
                              </div>
                              <p className="text-[10px] mt-1.5 font-bold text-gray-500">Android</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 mt-auto">
                        {(deviceType === "pc" || deviceType === "ios") && (
                          <a href={APP_URLS.google.ios} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full bg-gray-900 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-black transition-colors">
                            <Apple className="h-4 w-4 mr-1.5" /> App Store で入手
                          </a>
                        )}
                        {(deviceType === "pc" || deviceType === "android") && (
                          <a href={APP_URLS.google.android} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full bg-blue-600 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                            <Download className="h-4 w-4 mr-1.5" /> Google Play で入手
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="max-w-md mx-auto">
                  <button 
                    onClick={() => setSetupStep(2)}
                    className="px-8 py-3.5 bg-blue-600 text-white text-base font-bold rounded-xl hover:bg-blue-700 transition-all w-full shadow-md hover:shadow-lg flex items-center justify-center"
                  >
                    アプリの準備ができたので次へ <ArrowRight className="h-5 w-5 ml-2" />
                  </button>
                </div>
              </div>
            )}

            {setupStep === 2 && (
              <div className="text-center animate-fade-in">
                <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                  <Scan className="h-8 w-8 text-blue-600" />
                </div>
                <h4 className="text-xl font-extrabold text-gray-900 mb-3">QRコードを読み取る</h4>
                <p className="text-sm text-gray-600 mb-6">
                  認証アプリで「QRコードをスキャン」を選択し、下の画像を読み取ってください。
                </p>
                
                <div className="flex justify-center mb-6">
                  {totpSetupData ? (
                    <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
                      <QRCodeSVG value={totpSetupData.uri} size={180} level="M" />
                    </div>
                  ) : (
                    <div className="w-[216px] h-[216px] bg-gray-50 flex items-center justify-center rounded-2xl border border-gray-100">
                      <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-10 text-left max-w-sm mx-auto">
                  <p className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                    <KeyRound className="h-4 w-4 mr-1 text-gray-500" /> カメラが使えない場合は手動入力
                  </p>
                  <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                    <code className="text-sm font-mono text-gray-800 break-all select-all">
                      {totpSetupData?.secret || "読込中..."}
                    </code>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                  <button 
                    onClick={() => setSetupStep(1)}
                    className="px-6 py-3.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors w-full sm:w-auto"
                  >
                    戻る
                  </button>
                  <button 
                    onClick={() => setSetupStep(3)}
                    className="px-8 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-md transition-colors flex-1 flex items-center justify-center"
                  >
                    読み取ったので次へ <ArrowRight className="h-4 w-4 ml-2" />
                  </button>
                </div>
              </div>
            )}

            {setupStep === 3 && (
              <div className="text-center animate-fade-in">
                <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                  <KeyRound className="h-8 w-8 text-blue-600" />
                </div>
                <h4 className="text-xl font-extrabold text-gray-900 mb-3">認証コードの入力</h4>
                <p className="text-sm text-gray-600 mb-8">
                  アプリに表示されている<b>6桁の数字</b>を入力して、設定を完了させます。
                </p>
                
                <input 
                  type="text" 
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                  className="block w-full max-w-xs mx-auto text-center text-4xl tracking-[0.3em] font-mono border-2 border-gray-300 rounded-xl py-5 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all shadow-inner mb-10 outline-none"
                  autoFocus
                />

                <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                  <button 
                    onClick={() => { setSetupStep(2); setMfaCode(""); }}
                    className="px-6 py-3.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors w-full sm:w-auto"
                    disabled={isVerifying}
                  >
                    戻る
                  </button>
                  <button 
                    onClick={handleVerifyTotp}
                    disabled={mfaCode.length !== 6 || isVerifying}
                    className="px-8 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-1 flex items-center justify-center"
                  >
                    {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "設定を完了する"}
                  </button>
                </div>
              </div>
            )}

            {setupStep === 4 && (
              <div className="text-center animate-fade-in py-6">
                <div className="mx-auto w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-8 border-4 border-green-100">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <h4 className="text-2xl font-extrabold text-gray-900 mb-4">設定が完了しました！</h4>
                <p className="text-base text-gray-600 mb-10 leading-relaxed max-w-md mx-auto">
                  次回以降のログイン時に、登録したアプリから認証コードを入力することでより安全にログインできます。
                </p>
                <button 
                  onClick={onClose}
                  className="px-8 py-4 bg-gray-900 text-white text-base font-bold rounded-xl hover:bg-black w-full max-w-sm mx-auto shadow-md transition-colors flex items-center justify-center"
                >
                  画面を閉じる
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}