"use client";

import React, { useEffect, useState, useRef } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ScanLine, X, Loader2, AlertCircle, CheckCircle2, Camera, ShieldCheck } from "lucide-react";

const MAGIC_PREFIX = "SCPS:TICKET:";

const decryptPayload = (encrypted: string): string | null => {
  try {
    const base = encrypted.split('').reverse().join('');
    return decodeURIComponent(atob(base));
  } catch (e) {
    return null;
  }
};

type Props = {
  onClose: () => void;
  onLoginSuccess: (email: string) => void;
  showAlert: (type: "success" | "error", message: string) => void;
};

export default function ScCodeScannerModal({ onClose, onLoginSuccess, showAlert }: Props) {
  const [step, setStep] = useState<"intro" | "scanning" | "processing" | "success">("intro");
  const [scanError, setScanError] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);

  const stopScannerSafely = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn("Scanner stop warning:", err);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopScannerSafely();
    };
  }, []);

  const startScanner = async () => {
    setStep("scanning");
    setScanError("");

    if (isStartingRef.current) return;
    isStartingRef.current = true;

    await new Promise(resolve => setTimeout(resolve, 200));

    const html5QrCode = new Html5Qrcode("scps-modal-qr-reader", {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false
    });
    scannerRef.current = html5QrCode;

    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        async (decodedText) => {
          if (decodedText.startsWith(MAGIC_PREFIX)) {
            const encryptedData = decodedText.slice(MAGIC_PREFIX.length);
            const decryptedTicketId = decryptPayload(encryptedData);

            if (decryptedTicketId) {
              await stopScannerSafely();
              setStep("processing");
              setScanError("");

              try {
                // ★ FirebaseからチケットIDをもとにログイン情報を安全に取得
                const ticketRef = doc(db, "scpsTickets", decryptedTicketId);
                const ticketSnap = await getDoc(ticketRef);

                if (!ticketSnap.exists()) {
                  throw new Error("無効または期限切れのSCコードです。");
                }

                const ticketData = ticketSnap.data();

                if (ticketData.isUsed) {
                  throw new Error("このSCコードはすでに使用されています。手動でログインしてください。");
                }

                const email = ticketData.email;
                const password = ticketData.initialPassword;

                if (email && password) {
                  await signInWithEmailAndPassword(auth, email, password);

                  // セキュリティ向上のため、一度使用されたチケットを使用済みにマーク（または削除）
                  await updateDoc(ticketRef, { isUsed: true }).catch(() => {});

                  setStep("success");
                  showAlert("success", "SCコードの認識に成功しました。");
                  onLoginSuccess(email);
                } else {
                  throw new Error("初期パスワードが設定されていないアカウントです。");
                }
              } catch (error: any) {
                console.error("Login error:", error);
                setStep("intro");
                setScanError(error.message || "ログインに失敗しました。");
              }
            } else {
              setScanError("コードの復号に失敗しました。");
            }
          } else {
            setScanError("これはSCPS専用のSCコードではありません。");
          }
        },
        undefined
      );
    } catch (err) {
      console.error("Camera start error:", err);
      setScanError("カメラを起動できませんでした。ブラウザのカメラアクセス権限を「許可」に変更してください。");
      setStep("intro");
    } finally {
      isStartingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative border border-gray-100 max-h-[90vh]">
        
        {/* ヘッダー */}
        <div className="bg-[#312e81] p-4 flex items-center justify-between text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-indigo-300" />
            <h3 className="font-black text-sm tracking-wide">SCコード 初回ログイン</h3>
          </div>
          <button 
            onClick={async () => {
              await stopScannerSafely();
              onClose();
            }}
            className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 flex-1 overflow-y-auto flex flex-col items-center justify-center">
          
          {/* ステップ1: 案内（イントロ）画面 */}
          {step === "intro" && (
            <div className="w-full animate-fade-in flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-indigo-50 text-[#312e81] rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-indigo-100">
                <ScanLine className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2 tracking-tight">
                専用「SCコード」のご準備
              </h3>
              <p className="text-xs font-bold text-gray-600 leading-relaxed mb-5 px-1">
                アカウント発行シートの<span className="text-[#312e81] font-black border-b border-indigo-200">丸いSCコード</span>をかざすと、パスワード入力不要で一瞬で初回ログインできます。
              </p>

              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 mb-5 w-full text-left flex gap-2.5 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] font-bold text-blue-900 leading-relaxed space-y-1">
                  <p>・カメラのアクセス許可ダイアログが出た場合は「許可」を選択してください。</p>
                  <p>・カメラ映像はSCコードの認識処理のみに使用されます。</p>
                </div>
              </div>

              {scanError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl w-full text-left flex gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-red-700 leading-relaxed">{scanError}</p>
                </div>
              )}

              <button
                onClick={startScanner}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                カメラを起動して読み取る
              </button>
            </div>
          )}

          {/* ステップ2: スキャン（カメラ）画面 */}
          {step === "scanning" && (
            <div className="w-full animate-fade-in flex flex-col items-center">
              <p className="text-xs font-bold text-gray-600 text-center mb-3 leading-relaxed">
                シート上の <span className="text-[#312e81] font-black">SCコード</span> をガイド枠に合わせてください
              </p>

              {/* スキャンエリア + SVG ガイドライン */}
              <div className="relative w-full max-w-[280px] aspect-square mx-auto rounded-2xl overflow-hidden shadow-inner bg-black border-2 border-indigo-200">
                
                <div id="scps-modal-qr-reader" className="w-full h-full flex items-center justify-center absolute inset-0">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
                
                {/* SCコードのデザインを再現したガイドライン */}
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 280 280">
                    <defs>
                      <mask id="sc-code-mask">
                        <rect width="280" height="280" fill="white" />
                        <circle cx="140" cy="140" r="105" fill="black" />
                      </mask>
                    </defs>
                    
                    <rect width="280" height="280" fill="rgba(0, 0, 0, 0.5)" mask="url(#sc-code-mask)" />
                    <circle cx="140" cy="140" r="105" fill="none" stroke="rgba(255, 255, 255, 0.9)" strokeWidth="3" />
                    <circle cx="140" cy="140" r="97" fill="none" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" strokeDasharray="4, 3" />
                    <circle cx="140" cy="140" r="28" fill="white" stroke="#312e81" strokeWidth="2" />
                    <text x="140" y="140" textAnchor="middle" dominantBaseline="central" fill="#312e81" fontSize="12" fontWeight="900" fontFamily="sans-serif">
                      SCPS
                    </text>
                  </svg>
                </div>
              </div>

              <style>{`
                #scps-modal-qr-reader video {
                  object-fit: cover !important;
                  width: 100% !important;
                  height: 100% !important;
                }
              `}</style>

              {scanError && (
                <div className="mt-4 p-2.5 bg-red-50 border border-red-200 rounded-xl w-full text-center">
                  <p className="text-[11px] font-bold text-red-700">{scanError}</p>
                </div>
              )}
            </div>
          )}

          {/* ステップ3 & 4: 処理中 / 成功画面 */}
          {(step === "processing" || step === "success") && (
            <div className="flex flex-col items-center py-6 animate-fade-in w-full text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 shadow-inner border border-emerald-200">
                {step === "success" ? (
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-bounce" />
                ) : (
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                )}
              </div>
              <h3 className="text-base font-black text-gray-900 mb-2 tracking-wide">
                {step === "success" ? "認証に成功しました！" : "SCコードを認識しました"}
              </h3>
              <div className="flex items-center justify-center text-gray-500 text-xs font-bold bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 shadow-2xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2 text-indigo-600" /> データベースから認証情報を照会中...
              </div>
            </div>
          )}

        </div>

        <div className="bg-gray-50 p-3 border-t border-gray-200 text-center flex-shrink-0">
          <button 
            onClick={async () => {
              await stopScannerSafely();
              onClose();
            }}
            className="text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
          >
            通常のログインに戻る
          </button>
        </div>
      </div>
    </div>
  );
}