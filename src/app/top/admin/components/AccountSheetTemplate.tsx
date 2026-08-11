"use client";

import React, { useEffect } from "react";
import QRCode from "qrcode";
import { SchoolData } from "../page";
import { ExtendedUserData } from "./UserManagement";

type Props = {
  sheetUser: ExtendedUserData;
  schoolData: SchoolData;
  getRoleDisplayName: (role: string) => string;
};

// SCコード暗号化関数
const MAGIC_PREFIX = "SCPS:";
const encryptPayload = (text: string): string => {
  const base = btoa(encodeURIComponent(text));
  return base.split('').reverse().join('');
};

const drawSCCode = async (canvas: HTMLCanvasElement, text: string) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const CANVAS_SIZE = 1000;
  const CENTER = CANVAS_SIZE / 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const COLOR_MAIN = '#000000';

  // 外周アウターリング
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, 470, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR_MAIN;
  ctx.lineWidth = 28;
  ctx.stroke();

  ctx.lineWidth = 6;
  for (let i = 0; i < 48; i++) {
    const angle = (i * Math.PI * 2) / 48;
    ctx.beginPath();
    ctx.moveTo(CENTER + 416 * Math.cos(angle), CENTER + 416 * Math.sin(angle));
    ctx.lineTo(CENTER + 444 * Math.cos(angle), CENTER + 444 * Math.sin(angle));
    ctx.stroke();
  }

  const encryptedText = encryptPayload(text);
  const payload = `${MAGIC_PREFIX}${encryptedText}`;
  
  const qrData = await QRCode.create(payload, { errorCorrectionLevel: 'H' });
  const size = qrData.modules.size;
  const data = qrData.modules.data;

  const QR_AREA_SIZE = 560; 
  const moduleSize = QR_AREA_SIZE / size;
  const offset = (CANVAS_SIZE - QR_AREA_SIZE) / 2;
  const extSize = size + 14;
  const extOffset = CENTER - (extSize * moduleSize) / 2;

  for (let r = 0; r < extSize; r++) {
    for (let c = 0; c < extSize; c++) {
      const cx = extOffset + c * moduleSize + moduleSize / 2;
      const cy = extOffset + r * moduleSize + moduleSize / 2;
      
      const dist = Math.hypot(cx - CENTER, cy - CENTER);
      if (dist > 390) continue;

      const qrRow = r - 7;
      const qrCol = c - 7;
      let isDark = false;

      if (qrRow >= 0 && qrRow < size && qrCol >= 0 && qrCol < size) {
        isDark = data[qrRow * size + qrCol] === 1;
        if ((qrRow < 7 && qrCol < 7) || (qrRow < 7 && qrCol >= size - 7) || (qrRow >= size - 7 && qrCol < 7)) continue;
        const centerMin = Math.floor(size * 0.35);
        const centerMax = Math.ceil(size * 0.65);
        if (qrRow >= centerMin && qrRow <= centerMax && qrCol >= centerMin && qrCol <= centerMax) continue;
      } else {
        const distToQR = Math.max(0, 0 - qrCol, qrCol - (size - 1), 0 - qrRow, qrRow - (size - 1));
        if (distToQR <= 1) continue; 
        const hash = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
        isDark = (hash - Math.floor(hash)) > 0.5;
      }

      if (isDark) {
        ctx.beginPath();
        ctx.arc(cx, cy, (moduleSize / 2) * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = COLOR_MAIN;
        ctx.fill();
      }
    }
  }

  const drawFinder = (r: number, c: number) => {
    const cx = offset + c * moduleSize + (7 * moduleSize) / 2;
    const cy = offset + r * moduleSize + (7 * moduleSize) / 2;
    ctx.beginPath(); ctx.arc(cx, cy, 3.5 * moduleSize, 0, Math.PI * 2); ctx.fillStyle = COLOR_MAIN; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 2.5 * moduleSize, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 1.5 * moduleSize, 0, Math.PI * 2); ctx.fillStyle = COLOR_MAIN; ctx.fill();
  };

  drawFinder(0, 0); drawFinder(0, size - 7); drawFinder(size - 7, 0);

  ctx.save();
  ctx.beginPath(); ctx.arc(CENTER, CENTER, 130, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.beginPath(); ctx.arc(CENTER, CENTER, 116, 0, Math.PI * 2); ctx.strokeStyle = COLOR_MAIN; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = COLOR_MAIN;
  ctx.font = '900 64px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCPS', CENTER, CENTER);
  ctx.restore();
};

export default function AccountSheetTemplate({ sheetUser, schoolData, getRoleDisplayName }: Props) {
  useEffect(() => {
    const scpsCanvas = document.getElementById("scps-qr-canvas") as HTMLCanvasElement;
    if (scpsCanvas) {
      const rawData = `${schoolData.id}::${sheetUser.email}::${sheetUser.initialPassword || ""}`;
      drawSCCode(scpsCanvas, rawData);
    }

    const urlCanvas = document.getElementById("url-qr-canvas") as HTMLCanvasElement;
    if (urlCanvas) {
      // ★ 読み取った瞬間にSCコードスキャン画面(カメラ)が開く特別URLを発行
      QRCode.toCanvas(urlCanvas, "https://scps.yorikuru.com/login?scps_scan=true", { width: 100, margin: 0 }, (error) => {
        if (error) console.error(error);
      });
    }
  }, [sheetUser, schoolData]);

  return (
    <div style={{ position: 'fixed', top: 0, left: '-9999px', pointerEvents: 'none', opacity: 0, zIndex: -9999 }}>
      
      <div id="account-sheet-template" style={{ width: '794px', height: '1123px', boxSizing: 'border-box', padding: '40px 50px', backgroundColor: 'white', fontFamily: '"Helvetica Neue", Helvetica, "Noto Sans JP", sans-serif', color: '#111827' }}>
        
        {/* ヘッダーエリア */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #312e81', paddingBottom: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/icon.png" alt="logo" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e7eb' }} />
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 2px 0', color: '#312e81', letterSpacing: '1px', whiteSpace: 'nowrap' }}>生徒会ポータルシステム</h1>
              <p style={{ fontSize: '13px', fontWeight: 'bold', margin: 0, color: '#6b7280' }}>システムアカウント 発行シート</p>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold', paddingBottom: '4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
            ※ログインに必要な個人情報を含みます。<br/>紛失しないよう大切に保管してください。
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px 0', fontWeight: 'bold' }}>テナント名(学校名)</p>
          <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0 }}>{schoolData.name}</h2>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px 0', fontWeight: 'bold' }}>氏名</p>
          <h2 style={{ fontSize: '26px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            {sheetUser.name} <span style={{ fontSize: '18px' }}>様</span>
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 'normal' }}>{sheetUser.nameKana}</span>
          </h2>
        </div>

        {/* 所属情報テーブル */}
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '900', margin: '0 0 8px 0', color: '#374151', borderLeft: '4px solid #4f46e5', paddingLeft: '8px' }}>■ 所属情報</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <tbody>
              <tr>
                <th style={{ padding: '6px 10px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', fontSize: '10px', color: '#4b5563', width: '33.3%' }}>システム権限</th>
                <th style={{ padding: '6px 10px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', fontSize: '10px', color: '#4b5563', width: '33.3%' }}>役職</th>
                <th style={{ padding: '6px 10px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', fontSize: '10px', color: '#4b5563', width: '33.3%' }}>学籍・教職員番号</th>
              </tr>
              <tr>
                <td style={{ padding: '10px', border: '1px solid #d1d5db', fontSize: '13px', fontWeight: 'bold' }}>{getRoleDisplayName(sheetUser.role)}</td>
                <td style={{ padding: '10px', border: '1px solid #d1d5db', fontSize: '13px', fontWeight: 'bold' }}>{sheetUser.positionName || "未設定"}</td>
                <td style={{ padding: '10px', border: '1px solid #d1d5db', fontSize: '13px', fontWeight: 'bold' }}>{sheetUser.studentId || "未設定"}</td>
              </tr>
              <tr>
                <th style={{ padding: '6px 10px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', fontSize: '10px', color: '#4b5563' }}>学年/クラス</th>
                <th style={{ padding: '6px 10px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', fontSize: '10px', color: '#4b5563' }}>所属部署・委員会</th>
                <th style={{ padding: '6px 10px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', fontSize: '10px', color: '#4b5563' }}>部活動</th>
              </tr>
              <tr>
                <td style={{ padding: '10px', border: '1px solid #d1d5db', fontSize: '13px', fontWeight: 'bold' }}>{sheetUser.grade ? `${sheetUser.grade}年` : ""}{sheetUser.classNumber ? `${sheetUser.classNumber}組` : "未設定"}</td>
                <td style={{ padding: '10px', border: '1px solid #d1d5db', fontSize: '13px', fontWeight: 'bold' }}>{sheetUser.department || "未設定"}</td>
                <td style={{ padding: '10px', border: '1px solid #d1d5db', fontSize: '13px', fontWeight: 'bold' }}>{sheetUser.club || "未設定"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2カラムレイアウト（左：手動ログイン、右：SCコード） */}
        <div style={{ display: 'flex', gap: '20px' }}>
          
          {/* 左：手動ログイン情報 */}
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '14px', fontWeight: '900', margin: '0 0 8px 0', color: '#374151', borderLeft: '4px solid #4f46e5', paddingLeft: '8px' }}>■ ログイン情報 (手動入力用)</h3>
            <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '16px', backgroundColor: '#ffffff' }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 2px 0', fontWeight: 'bold' }}>① テナントID (組織コード)</p>
                <p style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, fontFamily: 'monospace' }}>{schoolData.schoolCode || schoolData.id}</p>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 2px 0', fontWeight: 'bold' }}>② システム利用番号 (またはメアド)</p>
                <p style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, fontFamily: 'monospace' }}>{sheetUser.systemId || sheetUser.email}</p>
              </div>
              
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 2px 0', fontWeight: 'bold' }}>③ 初期パスワード</p>
                <p style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#ef4444', letterSpacing: '2px', fontFamily: 'monospace' }}>{sheetUser.initialPassword || "未設定"}</p>
              </div>
              <p style={{ fontSize: '9px', color: '#dc2626', margin: '0 0 12px 0', fontWeight: 'bold' }}>※初回ログイン後に必ず新しいパスワードに変更してください。</p>

              <div style={{ backgroundColor: '#f3f4f6', padding: '8px', borderRadius: '6px' }}>
                <p style={{ fontSize: '10px', color: '#4b5563', margin: '0 0 2px 0', fontWeight: 'bold' }}>外部連携ログイン</p>
                <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0 }}>Google / Microsoft 連携可</p>
              </div>
            </div>
          </div>

          {/* 右：SCコードと手順 */}
          <div style={{ flex: 1.25 }}>
            <h3 style={{ fontSize: '14px', fontWeight: '900', margin: '0 0 8px 0', color: '#374151', borderLeft: '4px solid #10b981', paddingLeft: '8px' }}>■ 初回アクセス手順</h3>
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', height: '100%', boxSizing: 'border-box' }}>
              
              {/* 手順① */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px dashed #cbd5e1' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '11px', color: '#1f2937' }}>① 以下のURLにアクセスします。</p>
                  <p style={{ color: '#4f46e5', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', margin: 0 }}>https://scps.yorikuru.com/login</p>
                </div>
                <canvas id="url-qr-canvas" style={{ width: '56px', height: '56px' }}></canvas>
              </div>

              {/* 手順② (SCコード) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ flex: 1, paddingRight: '12px' }}>
                  <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', fontSize: '12px', color: '#1f2937', lineHeight: '1.5' }}>
                    ② <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: '900' }}>★おすすめ</span><br/>
                    右の「SCコード」を専用画面のカメラで読み取ると、入力不要で一瞬でログインできます！
                  </p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '10px', color: '#6b7280', lineHeight: '1.4' }}>
                    ※カメラが使えない場合は、左記の「システム利用番号」と「初期パスワード」を入力してログインしてください。
                  </p>
                  <div style={{ backgroundColor: '#fee2e2', padding: '8px', borderRadius: '6px', border: '1px solid #f87171' }}>
                    <p style={{ margin: 0, color: '#b91c1c', fontWeight: 'bold', fontSize: '10px', lineHeight: '1.4' }}>
                      ⚠️ SCコードがあれば誰でも初回アクセスできてしまいます。第三者に見られないよう厳重に管理してください。
                    </p>
                  </div>
                </div>
                <div style={{ width: '160px', height: '160px', backgroundColor: 'white', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '2px solid #4f46e5', flexShrink: 0 }}>
                  <canvas id="scps-qr-canvas" width={1000} height={1000} style={{ width: '144px', height: '144px' }}></canvas>
                </div>
              </div>

              {/* 手順③ */}
              <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '11px', color: '#374151', lineHeight: '1.5' }}>
                  ③ 画面の表示に従い、初期パスワードの変更や二要素認証（MFA）の設定を完了させてください。
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}