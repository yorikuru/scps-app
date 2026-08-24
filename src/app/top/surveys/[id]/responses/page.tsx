"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AlertCircle, CheckCircle, Loader2, BarChart3, List, Download, Edit3 } from "lucide-react";
import Link from "next/link"; 

import { Survey, UserData, sanitizeSurveyData, getDefaultSurveySettings } from "../../types";
import ResponsesHeader from "./components/ResponsesHeader";
import DeleteConfirmModal from "./components/DeleteConfirmModal";
import ResponsesList from "./components/ResponsesList";
import ResponsesSummary from "./components/ResponsesSummary";
import ResponsesGrading from "./components/ResponsesGrading";

export type ResponseData = {
  id: string;
  respondentName: string;
  respondentId?: string | null;
  email?: string | null;
  content: string;
  rawAnswers: Record<string, any>;
  manualScores?: Record<string, number>;
  timeTaken?: number;
  createdAt: Date | null;
};

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function SurveyResponsesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const surveyId = params.id as string;

  const [userData, setUserData] = useState<UserData | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [viewTab, setViewTab] = useState<"summary" | "individual" | "grading">("summary");

  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [responseToDelete, setResponseToDelete] = useState<string | null>(null);

  // ★ URLの変更を監視してタブ状態を同期させる
  useEffect(() => {
    const tabParam = searchParams.get("tab") as "summary" | "individual" | "grading";
    if (tabParam && ["summary", "individual", "grading"].includes(tabParam)) {
      setViewTab(tabParam);
    } else {
      setViewTab("summary");
    }
  }, [searchParams]);

  useEffect(() => {
    let unsubscribeResponses: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const myData = userDocSnap.data() as UserData;
            setUserData(myData);

            const surveyDocRef = doc(db, "surveys", surveyId);
            const surveyDocSnap = await getDoc(surveyDocRef);
            if (surveyDocSnap.exists()) {
              const rawData = surveyDocSnap.data();
              if (rawData.schoolId !== myData.schoolId && rawData.tenantId !== myData.schoolId) {
                router.push("/top/surveys");
                return;
              }
              setSurvey(sanitizeSurveyData({ id: surveyDocSnap.id, ...rawData }, getDefaultSurveySettings()));
            } else {
              router.push("/top/surveys");
              return;
            }

            const responsesRef = collection(db, "survey_responses");
            const q = query(
              responsesRef,
              where("surveyId", "==", surveyId),
              orderBy("createdAt", "desc")
            );

            unsubscribeResponses = onSnapshot(q, (snapshot) => {
              const fetchedResponses: ResponseData[] = [];
              snapshot.forEach((docSnap) => {
                const docData = docSnap.data();
                fetchedResponses.push({
                  id: docSnap.id,
                  respondentName: docData.respondentName,
                  respondentId: docData.respondentId || null,
                  email: docData.email || null,
                  content: docData.content,
                  rawAnswers: docData.rawAnswers || {},
                  manualScores: docData.manualScores || {}, 
                  timeTaken: docData.timeTaken || 0,
                  createdAt: docData.createdAt ? docData.createdAt.toDate() : null,
                });
              });
              setResponses(fetchedResponses);
              setIsLoading(false);
            });

          } else {
            router.push("/login");
          }
        } catch (error) {
          console.error("Error fetching data:", error);
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeResponses) unsubscribeResponses();
    };
  }, [surveyId, router]);

  useEffect(() => {
    if (survey && !survey.settings.isQuiz && viewTab === "grading") {
      setViewTab("summary");
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "summary");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [survey, viewTab, pathname, router, searchParams]);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 5000);
  };

  const handleDeleteResponse = async () => {
    if (!responseToDelete) return;
    try {
      const responseRef = doc(db, "survey_responses", responseToDelete);
      await deleteDoc(responseRef);
      showAlert("success", "回答を削除しました。");
    } catch (error) {
      console.error("Error deleting response:", error);
      showAlert("error", "回答の削除に失敗しました。");
    } finally {
      setResponseToDelete(null);
    }
  };

  const handleTabChange = (tab: "summary" | "individual" | "grading") => {
    setViewTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleDownloadExcel = () => {
    if (!survey || responses.length === 0) {
      showAlert("error", "ダウンロードするデータがありません。");
      return;
    }
    
    const questions = survey.questions.filter(q => q.type !== "section" && q.type !== "description");
    const header = ["回答日時", "所要時間(秒)", "回答者", "メールアドレス", ...questions.map(q => q.title)];
    
    if (survey.settings.isQuiz) {
      header.splice(4, 0, "合計得点");
    }
    
    const rows = responses.map(r => {
      const row = [
        r.createdAt ? r.createdAt.toLocaleString('ja-JP') : "",
        r.timeTaken || "",
        r.respondentName,
        r.email || ""
      ];

      if (survey.settings.isQuiz) {
        let score = 0;
        questions.forEach(q => {
           if (["radio", "checkbox", "select"].includes(q.type) || (q.type === "text" && q.correctAnswers && q.correctAnswers.length > 0)) {
             const ans = r.rawAnswers[q.id];
             let isCorrect = false;
             if (q.type === "radio" || q.type === "select") isCorrect = q.correctAnswers?.[0] === ans;
             else if (q.type === "checkbox") {
                const arr = Array.isArray(ans) ? ans : [];
                if (q.quizScoringType === "partial_match") isCorrect = arr.some(c => q.correctAnswers?.includes(c));
                else isCorrect = q.correctAnswers?.length === arr.length && q.correctAnswers.every(c => arr.includes(c));
             } else if (q.type === "text") {
                isCorrect = q.correctAnswers?.some(c => c.trim().toLowerCase() === String(ans || "").trim().toLowerCase()) || false;
             }
             if (isCorrect) score += (q.points || 0);
           } else {
             score += (r.manualScores?.[q.id] || 0);
           }
        });
        row.push(String(score));
      }
      
      questions.forEach(q => {
        const val = r.rawAnswers[q.id];
        if (val === undefined || val === null) {
          row.push("");
        } else if (Array.isArray(val)) {
          row.push(`"${val.join(" | ").replace(/"/g, '""')}"`);
        } else if (typeof val === "object") {
          row.push(`"${JSON.stringify(val).replace(/"/g, '""')}"`);
        } else {
          row.push(`"${String(val).replace(/"/g, '""')}"`);
        }
      });
      return row.join(",");
    });

    const csvContent = "\uFEFF" + header.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${survey.title}_回答結果.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const showGradingTab = survey?.settings.isQuiz;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-20 relative font-sans">
      
      <DeleteConfirmModal 
        isOpen={!!responseToDelete} 
        onCancel={() => setResponseToDelete(null)} 
        onConfirm={handleDeleteResponse} 
      />

      <ResponsesHeader title={survey?.title} />

      <div className="flex justify-center pt-8 pb-4">
        <div className="bg-white rounded-full p-1 shadow-sm border border-gray-200 inline-flex items-center">
          <Link href={`/top/surveys?tab=builder&editTab=questions&id=${surveyId}`} className="px-6 py-2 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">質問</Link>
          
          <div className="px-6 py-2 rounded-full text-sm font-bold bg-purple-100 text-purple-700 transition-colors flex items-center">
            結果 <span className="ml-1.5 bg-purple-200 px-2 py-0.5 rounded-full text-[10px]">{responses.length}</span>
          </div>

          <Link href={`/top/surveys?tab=builder&editTab=settings&id=${surveyId}`} className="px-6 py-2 rounded-full text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">設定</Link>
        </div>
      </div>

      {alert.show && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className={`p-4 rounded-lg shadow-lg flex items-center border-l-4 ${alert.type === "success" ? "bg-white border-green-500 text-green-800" : "bg-white border-red-500 text-red-800"}`}>
            {alert.type === "success" ? <CheckCircle className="h-6 w-6 text-green-500 mr-3" /> : <AlertCircle className="h-6 w-6 text-red-500 mr-3" />}
            <span className="font-bold text-sm">{alert.message}</span>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <div className="flex flex-wrap bg-gray-200/60 p-1 rounded-xl shadow-inner text-sm font-bold w-full sm:w-auto">
            <button 
              onClick={() => handleTabChange("summary")} 
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${viewTab === "summary" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <BarChart3 className="w-4 h-4" /> 概要レポート
            </button>
            <button 
              onClick={() => handleTabChange("individual")} 
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${viewTab === "individual" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <List className="w-4 h-4" /> 個別リスト
            </button>

            {showGradingTab && (
              <button 
                onClick={() => handleTabChange("grading")} 
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${viewTab === "grading" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-amber-700"}`}
              >
                <Edit3 className="w-4 h-4" /> 手動採点
              </button>
            )}
          </div>

          <button 
            onClick={handleDownloadExcel}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Excel(CSV)出力
          </button>
        </div>

        {viewTab === "summary" ? (
          <ResponsesSummary survey={survey} responses={responses} />
        ) : viewTab === "individual" ? (
          <ResponsesList 
            survey={survey} 
            responses={responses} 
            onDeleteRequest={(id) => setResponseToDelete(id)} 
          />
        ) : (
          <ResponsesGrading survey={survey} responses={responses} showAlert={showAlert} />
        )}

      </main>
    </div>
  );
}