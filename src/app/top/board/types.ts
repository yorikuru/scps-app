import * as LucideIcons from "lucide-react";

export type UserData = { 
  id: string; 
  name: string; 
  schoolId: string; 
  role: string; 
  isITManager?: boolean;
  photoURL?: string; 
};

export type Attachment = { name: string; url: string; size?: number; type?: string; };

export type Announcement = {
  id: string; title: string; content: string; authorName: string; authorId: string;
  authorPhotoURL?: string; 
  createdAt: string; categoryId?: string | null; isUrgent?: boolean;
  attachments?: Attachment[];
  publishStartDate?: string | null; 
  publishEndDate?: string | null;   
  isExternal?: boolean; 
  readByExternal?: string[]; // ★追加：外部ユーザーの既読者IDリスト
};

export type Category = { id: string; schoolId: string; name: string; color: string; };

export type AppConfig = { name: string; icon: string; color: string; };

export type AlertState = { show: boolean; type: "success" | "error"; message: string; };

export const COLOR_MAPPINGS: Record<string, { bg: string, text: string, hover: string, border: string, lightBg: string, ring: string }> = {
  indigo: { bg: "bg-indigo-600", text: "text-indigo-600", hover: "hover:bg-indigo-700", border: "border-indigo-200", lightBg: "bg-indigo-100", ring: "focus:ring-indigo-500" },
  blue: { bg: "bg-blue-600", text: "text-blue-600", hover: "hover:bg-blue-700", border: "border-blue-200", lightBg: "bg-blue-100", ring: "focus:ring-blue-500" },
  green: { bg: "bg-emerald-600", text: "text-emerald-600", hover: "hover:bg-emerald-700", border: "border-emerald-200", lightBg: "bg-emerald-100", ring: "focus:ring-emerald-500" },
  purple: { bg: "bg-purple-600", text: "text-purple-600", hover: "hover:bg-purple-700", border: "border-purple-200", lightBg: "bg-purple-100", ring: "focus:ring-purple-500" },
  orange: { bg: "bg-orange-600", text: "text-orange-600", hover: "hover:bg-orange-700", border: "border-orange-200", lightBg: "bg-orange-100", ring: "focus:ring-orange-500" },
  rose: { bg: "bg-rose-600", text: "text-rose-600", hover: "hover:bg-rose-700", border: "border-rose-200", lightBg: "bg-rose-100", ring: "focus:ring-rose-500" },
  amber: { bg: "bg-amber-600", text: "text-amber-600", hover: "hover:bg-amber-700", border: "border-amber-200", lightBg: "bg-amber-100", ring: "focus:ring-amber-500" },
  cyan: { bg: "bg-cyan-600", text: "text-cyan-600", hover: "hover:bg-cyan-700", border: "border-cyan-200", lightBg: "bg-cyan-100", ring: "focus:ring-cyan-500" },
  sky: { bg: "bg-sky-600", text: "text-sky-600", hover: "hover:bg-sky-700", border: "border-sky-200", lightBg: "bg-sky-100", ring: "focus:ring-sky-500" },
  teal: { bg: "bg-teal-600", text: "text-teal-600", hover: "hover:bg-teal-700", border: "border-teal-200", lightBg: "bg-teal-100", ring: "focus:ring-teal-500" },
  violet: { bg: "bg-violet-600", text: "text-violet-600", hover: "hover:bg-violet-700", border: "border-violet-200", lightBg: "bg-violet-100", ring: "focus:ring-violet-500" },
  pink: { bg: "bg-pink-600", text: "text-pink-600", hover: "hover:bg-pink-700", border: "border-pink-200", lightBg: "bg-pink-100", ring: "focus:ring-pink-500" },
  default: { bg: "bg-indigo-600", text: "text-indigo-600", hover: "hover:bg-indigo-700", border: "border-indigo-200", lightBg: "bg-indigo-100", ring: "focus:ring-indigo-500" }
};