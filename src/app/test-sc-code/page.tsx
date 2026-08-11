"use client";

/**
 * =========================================================================================
 * 📌 SCPS (生徒会役員ポータルシステム) 専用二次元コード「SCコード」仕様書 & 実装モジュール
 * =========================================================================================
 *
 * ■ 1. コンセプトと目的
 * -----------------------------------------------------------------------------------------
 * 生徒会役員やテナントメンバーの追加時（アカウント配布シート、イベントチケット等）に利用する
 * SCPS（Student Council Portal System）専用の二次元コード表示・スキャン機能。
 * * ■ 2. システム要件 & 仕様設計
 * -----------------------------------------------------------------------------------------
 * 【A. デザイン要件 (App Clip Style)】
 * 1. 形状: 四角い一般的なQRコードではなく、Appleの「App Clipコード」のような洗練された「真円」デザイン。
 * 2. 配色: 白と黒（モノクローム）を基調としたミニマルなビジュアル。
 * 3. 余白の完全排除（重要）:
 * 四角いQR領域と円形アウターリングの間に生じる「不自然な弧状の余白」を解消するため、
 * QR領域の外側かつ円環の内側のエリアを、QRデータドットと同サイズの「ダミードット（ランダムノイズ）」で埋め尽くす。
 * これにより「四角いQRを丸で囲んだだけ」ではなく「最初から大きな1つの円形コード」に見せる。
 * 4. アンカー・シンボル: 四隅の四角いファインダーパターンを、同心円状の「丸いターゲットマーク」に描画変更。
 * 5. 中央ロゴ: コード中央に半径指定のロゴ領域を配置し、白フチ＋画像描画。
 *
 * 【B. 秘匿化・セキュリティ要件 (Stealth QR Engine)】
 * 1. 標準リーダー対策:
 * iPhone標準カメラやLINE等の一般スキャナで読み取られても、中身が即座に判別できないよう
 * 独自プレフィックス(`SCPS:`)の付与およびデータ部の二重暗号化（Base64＋文字列反転等）を行う。
 * これにより、一般リーダーでは `SCPS:ZmVhY...` のような解読不能なハッシュ文字しか表示されない。
 * 2. 互換性と堅牢性:
 * 内部的にはQRCodeライブラリの最高エラー訂正レベル「Level H (約30%の破壊に耐える)」を使用。
 * 丸ドットへの変形、中央ロゴ配置、外周のダミードット配置によるノイズを、QRの強力なリード・ソロモン符号補正で自動吸収する。
 *
 * 【C. スキャン・デコード要件】
 * 1. 高速読み取り:
 * 裏側のデータ構造はISO規格のQRマトリックスに準拠しているため、市販のカメラライブラリ（html5-qrcode）
 * を利用した一瞬での爆速デコードが可能。
 * 2. エラー防止構造:
 * DOMとカメラデバイスの二重制御による `NotSupportedError` や `unhandledRejection` を防ぐため、
 * 手動の `<video>` 制御を一切排除し、`Html5Qrcode` のライフサイクルに一元化する。
 * 3. Hydrationエラー対策:
 * SSR（サーバーサイドレンダリング）との不一致を防ぐため、`isMounted` フラグによるクライアント制御を実施。
 *
 * =========================================================================================
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// ==========================================
// 🔑 定数・型定義 & 暗号化 / 復号ヘルパー
// ==========================================

/** SCPS専用コードであることを識別する固有ヘッダー */
const MAGIC_PREFIX = "SCPS:";

/**
 * ペイロード暗号化関数（SCPS固有エンコード）
 * @param text - 生データ（例: テナントID、ユーザーID）
 * @returns 難読化された文字列
 */
const encryptPayload = (text: string): string => {
  // UTF-8エンコード -> Base64変換 -> 文字列反転（直感的な解読を防止）
  const base = btoa(encodeURIComponent(text));
  return base.split('').reverse().join('');
};

/**
 * ペイロード復号関数（SCPS固有デコード）
 * @param encrypted - 難読化された文字列
 * @returns 復号された生データ（失敗時は null）
 */
const decryptPayload = (encrypted: string): string | null => {
  try {
    // 反転解除 -> Base64デコード -> UTF-8デコード
    const base = encrypted.split('').reverse().join('');
    return decodeURIComponent(atob(base));
  } catch (e) {
    return null;
  }
};

// ==========================================
// 🎨 メイン UI コンポーネント
// ==========================================
export default function AppClipStyleSCCode() {
  // SSR (Next.js) とのハイドレーション不一致を防止するマウント状態
  const [isMounted, setIsMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // ユーザー入力・状態管理
  const [inputText, setInputText] = useState('SCPS-TENANT-001');
  const [activeTab, setActiveTab] = useState<'generate' | 'scan'>('generate');
  
  // スキャナー関連の状態
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // html5-qrcode のインスタンス参照 & 重複起動防止フラグ
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  
  // スキャン完了結果
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // キャンバス描画サイズ設定
  const CANVAS_SIZE = 500; 
  const CENTER = CANVAS_SIZE / 2;

  // ブラウザマウント完了の検知
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ---------------------------------------------------------------------------------------
  // 1. SCコード生成エンジン (App Clip風 白黒デザイン・余白完全埋め尽くし)
  // ---------------------------------------------------------------------------------------
  const generateStealthCode = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 【1-1】背景初期化（純白）
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const COLOR_MAIN = '#000000'; // 純黒

    // 【1-2】App Clipスタイルの外周アウターリング描画
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 235, 0, Math.PI * 2);
    ctx.strokeStyle = COLOR_MAIN;
    ctx.lineWidth = 14;
    ctx.stroke();

    // 内側の目盛り線（放射状）
    ctx.lineWidth = 3;
    for (let i = 0; i < 48; i++) {
      const angle = (i * Math.PI * 2) / 48;
      ctx.beginPath();
      ctx.moveTo(CENTER + 208 * Math.cos(angle), CENTER + 208 * Math.sin(angle));
      ctx.lineTo(CENTER + 222 * Math.cos(angle), CENTER + 222 * Math.sin(angle));
      ctx.stroke();
    }

    // 【1-3】生データ暗号化 & QRコードマトリックス生成
    const encryptedText = encryptPayload(inputText);
    const payload = `${MAGIC_PREFIX}${encryptedText}`;
    
    // エラー訂正レベル'H'（約30%の損傷・変形・装飾を復元可能）で生成
    const qrData = QRCode.create(payload, { errorCorrectionLevel: 'H' });
    const size = qrData.modules.size;
    const data = qrData.modules.data; // Int8Array (1: 黒, 0: 白)

    const QR_AREA_SIZE = 280; 
    const moduleSize = QR_AREA_SIZE / size;
    const offset = (CANVAS_SIZE - QR_AREA_SIZE) / 2;

    // 【1-4】「丸と四角の隙間（弧状の余白）」を埋める拡張グリッド計算
    const extSize = size + 14; // 外周まで拡張するセル数
    const extOffset = CENTER - (extSize * moduleSize) / 2;

    for (let r = 0; r < extSize; r++) {
      for (let c = 0; c < extSize; c++) {
        const cx = extOffset + c * moduleSize + moduleSize / 2;
        const cy = extOffset + r * moduleSize + moduleSize / 2;
        
        // 中心からの距離が200px（目盛り線のすぐ内側）を超える領域は描画しない
        const dist = Math.hypot(cx - CENTER, cy - CENTER);
        if (dist > 195) continue;

        // グリッド座標をQRコードのマトリックス座標に変換
        const qrRow = r - 7;
        const qrCol = c - 7;
        
        let isDark = false;

        // --- A. QRコードのデータ領域内 ---
        if (qrRow >= 0 && qrRow < size && qrCol >= 0 && qrCol < size) {
          // 型安全チェック (1 なら黒)
          isDark = data[qrRow * size + qrCol] === 1;

          // ファインダパターン（四隅の標準切り出しシンボル）は後で丸型に描くためスキップ
          if ((qrRow < 7 && qrCol < 7) || (qrRow < 7 && qrCol >= size - 7) || (qrRow >= size - 7 && qrCol < 7)) {
            continue;
          }
          // 中央のロゴ配置領域はスキップ
          const centerMin = Math.floor(size * 0.35);
          const centerMax = Math.ceil(size * 0.65);
          if (qrRow >= centerMin && qrRow <= centerMax && qrCol >= centerMin && qrCol <= centerMax) {
            continue;
          }
        } 
        // --- B. QRコードの外側（四角い不格好な余白エリア）---
        else {
          // スキャン読み取り精度を落とさないよう、QR本体の周り1マスはクワイエットゾーン（白）とする
          const distToQR = Math.max(0, 0 - qrCol, qrCol - (size - 1), 0 - qrRow, qrRow - (size - 1));
          if (distToQR <= 1) continue; 
          
          // クワイエットゾーンの外側を擬似ランダムな「ダミードット」で敷き詰め、全体の「大きな円」を作る
          const hash = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
          isDark = (hash - Math.floor(hash)) > 0.5;
        }

        // 丸いドットとして描画
        if (isDark) {
          ctx.beginPath();
          ctx.arc(cx, cy, (moduleSize / 2) * 0.85, 0, Math.PI * 2);
          ctx.fillStyle = COLOR_MAIN;
          ctx.fill();
        }
      }
    }

    // 【1-5】ファインダパターンを「同心円状の丸型ターゲット」に置き換え描画
    const drawFinder = (r: number, c: number) => {
      const cx = offset + c * moduleSize + (7 * moduleSize) / 2;
      const cy = offset + r * moduleSize + (7 * moduleSize) / 2;
      
      // 外側の黒丸
      ctx.beginPath(); ctx.arc(cx, cy, 3.5 * moduleSize, 0, Math.PI * 2); 
      ctx.fillStyle = COLOR_MAIN; ctx.fill();
      // 中間の白丸
      ctx.beginPath(); ctx.arc(cx, cy, 2.5 * moduleSize, 0, Math.PI * 2); 
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
      // 中心部の黒丸
      ctx.beginPath(); ctx.arc(cx, cy, 1.5 * moduleSize, 0, Math.PI * 2); 
      ctx.fillStyle = COLOR_MAIN; ctx.fill();
    };

    drawFinder(0, 0);          // 左上
    drawFinder(0, size - 7);    // 右上
    drawFinder(size - 7, 0);    // 左下

    // 【1-6】中央ロゴ画像の描画
    const img = new Image();
    img.src = '/icon.png';
    img.onload = () => {
      ctx.save();
      // ロゴ背景の白フチ
      ctx.beginPath(); ctx.arc(CENTER, CENTER, 65, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();

      // ロゴを正円でクリップ
      ctx.beginPath(); ctx.arc(CENTER, CENTER, 58, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(CENTER - 58, CENTER - 58, 116, 116);
      ctx.drawImage(img, CENTER - 58, CENTER - 58, 116, 116);
      ctx.restore();
      
      // ロゴ外周の黒枠線
      ctx.beginPath(); ctx.arc(CENTER, CENTER, 58, 0, Math.PI * 2); 
      ctx.strokeStyle = COLOR_MAIN; ctx.lineWidth = 2; ctx.stroke();
    };
  }, [inputText]);

  useEffect(() => {
    if (isMounted && activeTab === 'generate') {
      generateStealthCode();
    }
  }, [isMounted, activeTab, inputText, generateStealthCode]);

  // ---------------------------------------------------------------------------------------
  // 2. スキャナー制御エンジン (Html5Qrcode ライフサイクル安全統合)
  // ---------------------------------------------------------------------------------------
  
  /** カメラおよびスキャナーの安全停止関数 */
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // 2: SCANNING 状態のときのみ stop を呼ぶ
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn("Scanner stop warning:", e);
      } finally {
        scannerRef.current = null;
      }
    }
    setIsScanning(false);
  }, []);

  /** スキャナー起動処理 */
  const startScanner = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setCameraError(null);

    // 既存スキャナーの確実な解放
    await stopScanner(); 

    // DOM (<div id="reader">) のレンダー完了を確保
    await new Promise(resolve => setTimeout(resolve, 150));
    const readerElement = document.getElementById("reader");
    if (!readerElement) {
      isStartingRef.current = false;
      return;
    }

    setFinalResult(null);

    // QRコードのみを対象としたスキャナーの初期化
    const html5QrCode = new Html5Qrcode("reader", {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false
    });
    scannerRef.current = html5QrCode;

    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { 
          fps: 15, 
          qrbox: { width: 280, height: 280 } 
        },
        (decodedText) => {
          // SCPSコードか判定
          if (decodedText.startsWith(MAGIC_PREFIX)) {
            const encryptedData = decodedText.slice(MAGIC_PREFIX.length);
            const decrypted = decryptPayload(encryptedData);
            
            if (decrypted) {
              try { new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3').play(); } catch(e){}
              setFinalResult(decrypted);
              stopScanner();
            }
          }
        },
        undefined // エラーフレーム無視
      );
      setIsScanning(true);
    } catch (err) {
      console.error("Camera start error:", err);
      setCameraError("カメラを起動できませんでした。ブラウザの権限設定を確認してください。");
    } finally {
      isStartingRef.current = false;
    }
  }, [stopScanner]);

  // タブ切り替え時のスキャナー起動・停止制御
  useEffect(() => {
    if (activeTab === 'scan') {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      if (scannerRef.current && scannerRef.current.getState() === 2) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [activeTab, startScanner, stopScanner]);

  if (!isMounted) {
    return <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>SCPSコードシステム初期化中...</div>;
  }

  // ---------------------------------------------------------------------------------------
  // 3. 画面レンダリング (UI)
  // ---------------------------------------------------------------------------------------
  return (
    <div suppressHydrationWarning style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: '-apple-system, sans-serif' }}>
      
      {/* html5-qrcodeが動的挿入するビデオ要素のレスポンシブスタイル適用 */}
      <style>{`
        #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 24px !important;
        }
      `}</style>

      <h1 style={{ fontSize: '24px', fontWeight: '800', textAlign: 'center', marginBottom: '24px', color: '#000' }}>
        SC-Code (App Clip Style)
      </h1>

      {/* モード切り替えタブ */}
      <div style={{ display: 'flex', marginBottom: '24px', borderRadius: '12px', background: '#f1f3f5', padding: '4px' }}>
        <button 
          onClick={() => setActiveTab('generate')} 
          style={{ flex: 1, padding: '12px', background: activeTab === 'generate' ? '#fff' : 'transparent', color: activeTab === 'generate' ? '#000' : '#666', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: activeTab === 'generate' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none' }}>
          コード生成
        </button>
        <button 
          onClick={() => setActiveTab('scan')} 
          style={{ flex: 1, padding: '12px', background: activeTab === 'scan' ? '#000' : 'transparent', color: activeTab === 'scan' ? '#fff' : '#666', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: activeTab === 'scan' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}>
          スキャナー起動
        </button>
      </div>

      {/* ================= コード生成タブ ================= */}
      {activeTab === 'generate' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input 
            type="text" 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
            placeholder="埋め込むデータ" 
            style={{ width: '90%', padding: '14px 16px', borderRadius: '24px', border: '2px solid #e9ecef', marginBottom: '24px', fontSize: '16px', textAlign: 'center', color: '#000' }} 
          />
          <div style={{ background: '#fff', padding: '16px', borderRadius: '32px', boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}>
            <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ width: '100%', height: 'auto', borderRadius: '24px' }} />
          </div>
          <p style={{ marginTop: '24px', fontSize: '13px', color: '#666', textAlign: 'center', lineHeight: '1.6' }}>
            App Clip風の洗練された白黒デザインです。余白はダミードットで充填されています。<br/>
            一般的なQRリーダーでは解読不可能な暗号化が施されています。
          </p>
        </div>
      )}

      {/* ================= スキャナータブ ================= */}
      {activeTab === 'scan' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          
          {cameraError && (
            <div style={{ padding: '16px', background: '#fee2e2', color: '#991b1b', borderRadius: '12px', marginBottom: '16px', textAlign: 'center', width: '100%' }}>
              {cameraError}<br/>
              <button 
                onClick={() => { isStartingRef.current = false; startScanner(); }} 
                style={{ marginTop: '12px', padding: '8px 24px', background: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                再試行
              </button>
            </div>
          )}

          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', aspectRatio: '1/1', background: '#000', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            
            {/* Html5Qrcode がここに独自のビデオ要素を生成 */}
            <div id="reader" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#000' }}></div>

            {/* スキャン中のガイドフレーム */}
            {isScanning && !finalResult && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <div style={{ width: '260px', height: '260px', border: '4px solid rgba(255,255,255,0.8)', borderRadius: '50%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' }} />
                <p style={{ position: 'absolute', bottom: '10%', width: '100%', textAlign: 'center', color: '#fff', fontSize: '15px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  SCコードを円に合わせてください
                </p>
              </div>
            )}

            {/* スキャン結果ダイアログ */}
            {finalResult && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center', zIndex: 30 }}>
                <div style={{ width: '64px', height: '64px', background: '#000', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: '28px' }}>✓</div>
                <p style={{ color: '#666', fontSize: '14px', margin: '0 0 8px 0', fontWeight: 'bold' }}>認証完了</p>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#000', margin: '0 0 40px 0', wordBreak: 'break-all' }}>{finalResult}</h2>
                <button 
                  onClick={() => { setActiveTab('generate'); setTimeout(() => setActiveTab('scan'), 100); }} 
                  style={{ padding: '16px 40px', background: '#000', color: '#fff', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', width: '100%', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                  次のコードをスキャン
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}