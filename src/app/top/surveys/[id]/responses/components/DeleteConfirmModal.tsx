"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

type Props = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteConfirmModal({ isOpen, onCancel, onConfirm }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm transform transition-all">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4 mx-auto">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-center text-gray-900 mb-2">回答の削除</h3>
        <p className="text-sm text-center text-gray-500 mb-6">
          この回答をシステムから永久に削除します。<br />よろしいですか？
        </p>
        <div className="flex justify-center space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 border border-transparent rounded-md text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none transition-colors"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}