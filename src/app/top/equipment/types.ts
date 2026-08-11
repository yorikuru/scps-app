// src/app/top/equipment/types.ts

export type UserData = { id: string; name: string; schoolId: string; schoolName: string; positionName?: string; };
export type SchoolData = { id: string; name: string; };

export type EquipCondition = "good" | "needs_repair" | "lost";
export type EquipStatus = "available" | "rented";

export type Category = { id: string; name: string; color: string; icon: string; schoolId: string; };
export type Location = { id: string; name: string; schoolId: string; };
export type Accessory = { id: string; name: string; count: number; description: string; };

export type Equipment = {
  id: string; managementId: string; name: string; categoryId: string; locationId: string;
  usage: string; accessories: Accessory[]; acquiredAt: string; condition: EquipCondition; 
  conditionNote: string; status: EquipStatus; createdAt: string; schoolId: string;
};

export type RentalItem = { equipmentId: string; equipmentName: string; managementId: string; status: "active" | "returned"; conditionAtReturn?: string; conditionNote?: string; };

export type Rental = {
  id: string; items: RentalItem[]; borrowerName: string; purpose: string; location: string;
  startDate: string; endDate: string; status: "active" | "returned" | "partial"; schoolId: string; createdAt: string;
};

export type Borrowing = {
  id: string; name: string; owner: string; dueDate: string; status: "active" | "returned"; note: string; createdAt: string;
};

export const CONDITION_CONF: Record<EquipCondition, { label: string, color: string }> = {
  good: { label: "良好", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  needs_repair: { label: "要修理/異常", color: "text-red-700 bg-red-50 border-red-200" },
  lost: { label: "紛失", color: "text-gray-700 bg-gray-100 border-gray-300" },
};

export const COLOR_THEMES: Record<string, { lightBg: string, text: string, mainBg: string }> = {
  slate: { lightBg: "bg-slate-100", text: "text-slate-600", mainBg: "#64748b" },
  gray: { lightBg: "bg-gray-100", text: "text-gray-600", mainBg: "#6b7280" },
  red: { lightBg: "bg-red-100", text: "text-red-600", mainBg: "#ef4444" },
  amber: { lightBg: "bg-amber-100", text: "text-amber-600", mainBg: "#f59e0b" },
  green: { lightBg: "bg-green-100", text: "text-green-600", mainBg: "#22c55e" },
  blue: { lightBg: "bg-blue-100", text: "text-blue-600", mainBg: "#3b82f6" },
  indigo: { lightBg: "bg-indigo-100", text: "text-indigo-600", mainBg: "#6366f1" },
  purple: { lightBg: "bg-purple-100", text: "text-purple-600", mainBg: "#a855f7" },
  rose: { lightBg: "bg-rose-100", text: "text-rose-600", mainBg: "#f43f5e" }
};

export const TAILWIND_COLORS = Object.keys(COLOR_THEMES);
export const AVAILABLE_ICONS = ["Box", "Briefcase", "Monitor", "Camera", "Mic", "Speaker", "Book", "PenTool", "Tool", "Scissors", "Truck", "Archive", "Cable", "Battery"];