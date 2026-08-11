"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, ScanLine, AlertTriangle, Loader2 } from "lucide-react";

type Props = {
  onScan: (data: string) => void;
  onClose: () => void;
};

export default function QRScannerModal({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // QR解析ライブラリの読み込み
    if (!document.getElementById("jsqr-script")) {
      const script = document.createElement("script");
      script.id = "jsqr-script";
      script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationId: number;
    let isMounted = true;

    const start = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("お使いのブラウザはカメラ機能に対応していません。");
        }

        // ★修正: PC等で背面カメラ(environment)が無い場合のエラーを防ぐためのフォールバック処理
        try {
          // 1. まずはスマホなどの「背面カメラ」を要求
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        } catch (err) {
          // 2. 背面カメラが無ければ、PCのWebカメラなど「利用可能なカメラ」を要求
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true"); // iOS Safari対策
          
          try {
            await videoRef.current.play();
            setIsInitializing(false); // 再生開始できたらローディング解除
            
            if (isMounted) {
              requestAnimationFrame(tick);
            }
          } catch (playError: any) {
            // AbortErrorは無視してOK
            if (playError.name !== "AbortError") {
              throw new Error("カメラ映像の再生に失敗しました。");
            }
          }
        }
      } catch (err: any) {
        console.error("Camera initialization error:", err);
        if (isMounted) {
          setIsInitializing(false);
          setErrorMsg(err.message || "カメラへのアクセスが拒否されたか、カメラが見つかりません。ブラウザの権限設定を確認してください。");
        }
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        canvas.height = videoRef.current.videoHeight;
        canvas.width = videoRef.current.videoWidth;
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          if (imageData && (window as any).jsQR) {
            const code = (window as any).jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
            if (code && code.data) {
              onScan(code.data);
              return; // スキャン成功でループ停止
            }
          }
        }
      }
      animationId = requestAnimationFrame(tick);
    };

    start();

    return () => {
      isMounted = false;
      if (stream) stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animationId);
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="bg-white p-4 rounded-3xl w-full max-w-sm relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full z-10 transition-colors">
          <X className="w-5 h-5"/>
        </button>
        <h3 className="text-center font-black text-gray-900 mb-4 flex items-center justify-center gap-2">
          <ScanLine className="w-5 h-5 text-indigo-600"/> QRコードで返却
        </h3>
        
        <div className="relative w-full aspect-square overflow-hidden rounded-2xl bg-black mb-4 flex items-center justify-center">
          
          {/* ローディング表示 */}
          {isInitializing && !errorMsg && (
            <div className="flex flex-col items-center text-white font-bold text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              カメラを起動中...
            </div>
          )}
          
          {/* エラー時の表示 */}
          {errorMsg && (
            <div className="flex flex-col items-center text-red-400 font-bold text-xs gap-2 p-4 text-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              {errorMsg}
            </div>
          )}
          
          {/* カメラ映像 */}
          <video 
            ref={videoRef} 
            className={`w-full h-full object-cover ${errorMsg || isInitializing ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`} 
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* ガイド枠 (正常稼働時のみ表示) */}
          {!errorMsg && !isInitializing && (
            <>
              <div className="absolute inset-1/4 border-2 border-white/50 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 rounded-2xl pointer-events-none opacity-50 animate-pulse"></div>
            </>
          )}
        </div>
        <p className="text-center text-xs font-bold text-gray-500">
          貸出票に印字されたQRコードを枠内に映してください。<br/>自動で読み取り、返却画面が開きます。
        </p>
      </div>
    </div>
  );
}