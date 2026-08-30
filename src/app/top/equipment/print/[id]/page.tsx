"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Rental, Equipment, UserData, SchoolData } from "../../types";
import { Printer, Download, X, Loader2, FileText } from "lucide-react";

export default function RentalPrintPage() {
  const params = useParams();
  const rentalId = params.id as string;
  const printAreaRef = useRef<HTMLDivElement>(null);
  
  const [rental, setRental] = useState<Rental | null>(null);
  const [eqDetails, setEqDetails] = useState<Record<string, Equipment>>({});
  const [meta, setMeta] = useState<{schoolName: string; userName: string; positionName: string}>({
    schoolName: "", userName: "システムユーザー", positionName: ""
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (!document.getElementById("html2pdf-script")) {
      const script = document.createElement("script");
      script.id = "html2pdf-script";
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      document.head.appendChild(script);
    }

    if (!rentalId) return;

    const fetchData = async () => {
      try {
        const rDoc = await getDoc(doc(db, "rentals", rentalId));
        if (!rDoc.exists()) { setIsLoading(false); return; }
        const rData = { id: rDoc.id, ...rDoc.data() } as Rental;
        setRental(rData);

        let tenantName = "";
        if (rData.schoolId) {
          const sDoc = await getDoc(doc(db, "schools", rData.schoolId));
          if (sDoc.exists()) tenantName = sDoc.data().name || "";
        }

        let issuerName = "システムユーザー";
        let position = "";
        const currentUser = auth.currentUser;
        if (currentUser) {
          const uDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (uDoc.exists()) {
            const uData = uDoc.data() as UserData;
            issuerName = uData.name || "システムユーザー";
            position = uData.positionName || "";
          }
        }

        setMeta({ schoolName: tenantName, userName: issuerName, positionName: position });

        const eqMap: Record<string, Equipment> = {};
        for (const item of (rData.items || [])) {
          const eDoc = await getDoc(doc(db, "equipments", item.equipmentId));
          if (eDoc.exists()) eqMap[item.equipmentId] = { id: eDoc.id, ...eDoc.data() } as Equipment;
        }
        setEqDetails(eqMap);

      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [rentalId]);

  // PDF保存関数
  const handleDownloadPdf = async () => {
    if (!printAreaRef.current || !(window as any).html2pdf) return;
    setIsGeneratingPdf(true);

    const element = printAreaRef.current;
    
    // PDF設定：余白をゼロにし、生成元の要素サイズをそのままA4にフィットさせる
    const opt = {
      margin:       0, 
      filename:     `貸出票_${rental?.borrowerName || '宛名なし'}様_${rentalId.slice(-6)}.pdf`,
      image:        { type: 'jpeg', quality: 1 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak:    { mode: ['avoid-all'] }
    };

    try {
      await (window as any).html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error("PDF生成エラー:", e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-bold text-gray-500">
        <LoadingScreen />
        <p>貸出票データを準備中...</p>
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center font-bold text-gray-500">
        <p>データが見つかりません</p>
        <button onClick={() => window.close()} className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-xl text-xs">閉じる</button>
      </div>
    );
  }

  const qrUrl = typeof window !== "undefined" ? `${window.location.origin}/rentals/${rental.id}` : "";
  const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}&margin=0`;
  const todayStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  // 貸出全体の返却判定（データ構造に合わせて全体、もしくは全アイテムのステータスで判定）
  const isEntirelyReturned = rental.status === "returned";

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col font-sans">
      {/* 印刷用のグローバルCSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body, html { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            width: 100% !important;
            height: auto !important;
          }
          .no-print { display: none !important; }
          .print-reset-scroll {
            overflow: visible !important;
            height: auto !important;
          }
        }
      `}} />

      {/* 操作アクションバー */}
      <div className="no-print sticky top-0 z-50 bg-gray-900 border-b border-gray-700 text-white px-6 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-black">貸出票プレビュー</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Download className="w-3.5 h-3.5"/>}
            PDFを保存
          </button>
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-white text-gray-900 hover:bg-gray-100 text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-gray-800" />
            印刷する
          </button>
          <button onClick={() => window.close()} className="p-2 text-gray-400 hover:text-white rounded-xl ml-2"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {/* 画面プレビュー & PDF生成元 (DOMはこれ一つだけ) */}
      <div className="flex-1 overflow-auto flex justify-center items-start p-4 md:p-8 print-reset-scroll custom-scrollbar">
        
        {/* A4横サイズ固定のコンテナ。高さはA4(210mm)より少し小さい205mmにして2枚目へのはみ出しを防ぐ */}
        <div 
          ref={printAreaRef}
          style={{ backgroundColor: '#ffffff', color: '#000000', width: '297mm', height: '205mm', padding: '10mm', boxSizing: 'border-box' }} 
          className="font-sans flex flex-col overflow-hidden shadow-2xl print:shadow-none bg-white relative"
        >
          {/* 全て返却済みの場合の透かしウォーターマーク */}
          {isEntirelyReturned && (
            <div 
              style={{ color: 'rgba(156, 163, 175, 0.3)', borderColor: 'rgba(156, 163, 175, 0.3)' }} 
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-12 text-[120px] font-black border-[12px] px-12 py-4 rounded-3xl z-0 pointer-events-none select-none"
            >
              返 却 済
            </div>
          )}

          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="text-sm">
              <p style={{ borderColor: '#000000' }} className="text-xl font-bold border-b-2 pb-1 mb-2 pr-12 inline-block">
                {rental.borrowerName} 様
              </p>
            </div>
            <div className="text-right text-xs space-y-1">
              <p className="font-bold">発行日: {todayStr}</p>
              <p className="font-black text-lg mt-1">{meta.schoolName}</p>
              <p style={{ color: '#374151' }} className="font-bold mt-1">発行者: {meta.userName} {meta.positionName ? `(${meta.positionName})` : ''}</p>
            </div>
          </div>

          <h1 style={{ borderColor: '#000000' }} className="text-2xl font-black tracking-widest text-center border-b-2 pb-2 mb-4 relative z-10">
            備 品 貸 出 票
          </h1>

          <p style={{ color: '#1f2937' }} className="text-[11px] mb-4 leading-relaxed relative z-10">
            以下の備品の貸出を許可します。貸出期間を厳守し、又貸しや目的外の使用は絶対に行わないでください。万一破損等の場合は速やかに報告してください。<br/>
            <strong style={{ color: '#000000', borderColor: '#000000' }} className="border-b font-black">
              必ず期限内に返却手続きを終えるようお願いします。その際はこの用紙を持参の上、担当者へご提示ください。
            </strong>
          </p>

          <div style={{ borderColor: '#000000', backgroundColor: '#f9fafb' }} className="flex justify-between items-start mb-4 border-2 p-3 rounded-md relative z-10">
            <div className="text-xs space-y-2 flex-1">
              <div className="flex"><span style={{ color: '#4b5563' }} className="w-20 font-bold">貸出ID:</span><span className="font-mono font-bold">{rental.id.toUpperCase()}</span></div>
              <div className="flex"><span style={{ color: '#4b5563' }} className="w-20 font-bold">使用目的:</span><span className="font-bold">{rental.purpose}</span></div>
              <div className="flex"><span style={{ color: '#4b5563' }} className="w-20 font-bold">使用場所:</span><span className="font-bold">{rental.location}</span></div>
              <div className="flex">
                <span style={{ color: '#4b5563' }} className="w-20 font-bold">貸出期間:</span>
                <span className={`font-black text-base ${isEntirelyReturned ? 'line-through text-gray-500' : ''}`}>
                  {rental.startDate} 〜 {rental.endDate}
                </span>
              </div>
            </div>
            <div style={{ borderColor: '#d1d5db' }} className="flex flex-col items-center justify-center border-l-2 pl-4 ml-4">
              <img src={qrImgSrc} alt="Return QR" style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }} className="w-24 h-24 mb-1 border p-1" />
              <span style={{ color: '#000000' }} className="text-[9px] font-black text-center leading-tight">返却手続き用QR</span>
            </div>
          </div>
          
          <h2 className="text-[11px] font-bold mb-1 relative z-10">【 貸出備品明細 】</h2>
          <div className="flex-1 overflow-hidden relative z-10">
            <table style={{ borderColor: '#000000' }} className="w-full border-collapse border-2 text-left text-[11px]">
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderColor: '#000000' }} className="border-b-2">
                  <th style={{ borderColor: '#000000' }} className="border-r p-1.5 w-1/4">管理ID</th>
                  <th style={{ borderColor: '#000000' }} className="border-r p-1.5">備品名・付属品</th>
                  <th style={{ borderColor: '#000000' }} className="border-r p-1.5 w-1/4">貸出時状態</th>
                  <th className="p-1.5 w-20 text-center">返却確認</th>
                </tr>
              </thead>
              <tbody>
                {(rental.items || []).map(item => {
                  const eq = eqDetails[item.equipmentId];
                  // rental全体か、item単体がreturnedの場合
                  const isItemReturned = isEntirelyReturned || (item as any).status === "returned";

                  return (
                    <tr 
                      key={item.equipmentId} 
                      style={{ borderColor: '#000000', backgroundColor: isItemReturned ? '#f9fafb' : '#ffffff' }} 
                      className={`border-b ${isItemReturned ? 'text-gray-500' : ''}`}
                    >
                      <td style={{ borderColor: '#000000' }} className="border-r p-1.5 font-mono font-bold text-[10px]">
                        {item.managementId}
                      </td>
                      <td style={{ borderColor: '#000000' }} className="border-r p-1.5 font-bold text-[10px]">
                        <div className="flex items-center">
                          {item.equipmentName}
                          {isItemReturned && (
                            <span style={{ borderColor: '#9ca3af' }} className="ml-2 px-1 py-0.5 bg-gray-200 text-gray-700 text-[8px] rounded border">
                              返却済
                            </span>
                          )}
                        </div>
                        {eq?.accessories && eq.accessories.length > 0 && (
                          <div style={{ color: '#6b7280' }} className="text-[9px] font-normal mt-0.5 leading-none">
                            [付属品] {eq.accessories.map(a => `${a.name}(${a.count})`).join(", ")}
                          </div>
                        )}
                      </td>
                      <td style={{ borderColor: '#000000' }} className="border-r p-1.5 text-[10px]">
                        {eq?.conditionNote || "良好"}
                      </td>
                      <td className="p-1.5 text-center text-lg leading-none font-bold">
                        {isItemReturned ? "☑" : "□"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div style={{ borderColor: '#9ca3af', color: '#4b5563' }} className="mt-2 pt-2 border-t text-[9px] font-bold text-right relative z-10">
            システム発行元: SCPS (Student Council Portal System)
          </div>
        </div>
      </div>
    </div>
  );
}