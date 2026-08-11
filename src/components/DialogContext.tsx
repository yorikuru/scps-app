"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

type AlertType = "success" | "error" | "info" | "warning";
type ConfirmType = "danger" | "warning" | "info";

interface DialogContextProps {
  showAlert: (message: string, type?: AlertType) => void;
  showConfirm: (message: string, onConfirm: () => void, type?: ConfirmType, title?: string) => void;
}

const DialogContext = createContext<DialogContextProps | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
};

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [alertConfig, setAlertConfig] = useState<{ show: boolean; message: string; type: AlertType }>({ show: false, message: "", type: "info" });
  const [confirmConfig, setConfirmConfig] = useState<{ show: boolean; message: string; title: string; type: ConfirmType; onConfirm: () => void }>({ show: false, message: "", title: "", type: "info", onConfirm: () => {} });

  const showAlert = (message: string, type: AlertType = "info") => {
    setAlertConfig({ show: true, message, type });
  };

  const showConfirm = (message: string, onConfirm: () => void, type: ConfirmType = "danger", title: string = "確認") => {
    setConfirmConfig({ show: true, message, title, type, onConfirm });
  };

  const closeAlert = () => setAlertConfig({ ...alertConfig, show: false });
  const closeConfirm = () => setConfirmConfig({ ...confirmConfig, show: false });

  const handleConfirm = () => {
    confirmConfig.onConfirm();
    closeConfirm();
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {/* ▼ 共通 Alert モーダル (showAlert() の代わり) ▼ */}
      {alertConfig.show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all border border-gray-100">
            <div className="p-6 flex flex-col items-center text-center">
              {alertConfig.type === "success" && <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-4" />}
              {alertConfig.type === "error" && <AlertCircle className="w-14 h-14 text-red-500 mb-4" />}
              {alertConfig.type === "warning" && <AlertTriangle className="w-14 h-14 text-amber-500 mb-4" />}
              {alertConfig.type === "info" && <Info className="w-14 h-14 text-blue-500 mb-4" />}
              
              <p className="text-sm font-bold text-gray-800 leading-relaxed whitespace-pre-wrap">{alertConfig.message}</p>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-center">
              <button onClick={closeAlert} className="w-full py-3 bg-gray-900 text-white text-xs font-black rounded-2xl shadow-md hover:bg-black transition-all active:scale-[0.98]">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ▼ 共通 Confirm モーダル (showConfirm() の代わり) ▼ */}
      {confirmConfig.show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all border border-gray-100">
            <div className={`p-4 border-b ${confirmConfig.type === 'danger' ? 'bg-red-50 border-red-100' : confirmConfig.type === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'} flex justify-between items-center`}>
              <h3 className={`text-sm font-black flex items-center ${confirmConfig.type === 'danger' ? 'text-red-800' : confirmConfig.type === 'warning' ? 'text-amber-800' : 'text-blue-800'}`}>
                {confirmConfig.type === 'danger' ? <AlertTriangle className="w-4 h-4 mr-2" /> : confirmConfig.type === 'warning' ? <AlertTriangle className="w-4 h-4 mr-2" /> : <Info className="w-4 h-4 mr-2" />}
                {confirmConfig.title}
              </h3>
              <button onClick={closeConfirm} className="p-1 text-gray-500 hover:bg-black/10 rounded-md transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6">
              <p className="text-sm font-bold text-gray-700 leading-relaxed whitespace-pre-wrap">{confirmConfig.message}</p>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={closeConfirm} className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 text-xs font-black rounded-2xl hover:bg-gray-50 transition-all active:scale-[0.98]">
                キャンセル
              </button>
              <button 
                onClick={handleConfirm} 
                className={`flex-1 py-3 text-white text-xs font-black rounded-2xl shadow-md transition-all active:scale-[0.98] ${confirmConfig.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : confirmConfig.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};