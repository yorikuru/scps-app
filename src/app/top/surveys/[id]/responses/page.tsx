export function generateStaticParams() {
  return [];
}

"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  ArrowLeft, Trash2, AlertCircle, CheckCircle, 
  MessageSquare, Clock, User, UserX, Loader2, FileText, Globe, Lock
} from "lucide-react";

// ユーザーデータ
type UserData = {
  name: string;
  schoolId: string;
  role: string;
};

// アンケートデータ
type Survey = {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  isAnonymous: boolean;
};

// 回答データ
type ResponseData = {
  id: string;
  respondentName: string;
  respondentId?: string | null;
  content: string;
  createdAt: Date | null;
};

// UIアラート
type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
};

export default function SurveyResponsesPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;

  const [userData, setUserData] = useState<UserData | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UIアラート・削除モーダル用ステート
  const [alert, setAlert] = useState<AlertState>({ show: false, type: "success", message: "" });
  const [responseToDelete, setResponseToDelete] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeResponses: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. ユーザーデータ取得
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const myData = userDocSnap.data() as UserData;
            setUserData(myData);

            // 2. アンケート詳細取得
            const surveyDocRef = doc(db, "surveys", surveyId);
            const surveyDocSnap = await getDoc(surveyDocRef);
            if (surveyDocSnap.exists()) {
              const surveyData = surveyDocSnap.data();
              if (surveyData.schoolId !== myData.schoolId && surveyData.tenantId !== myData.schoolId) {
                router.push("/top/surveys");
                return;
              }
              setSurvey({ 
                id: surveyDocSnap.id, 
                title: surveyData.title,
                description: surveyData.description,
                isPublic: surveyData.isPublic ?? false,
                isAnonymous: surveyData.isAnonymous ?? false
              } as Survey);
            } else {
              router.push("/top/surveys");
              return;
            }

            // 3. このアンケートに対する回答一覧をリアルタイム取得
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
                  content: docData.content,
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

  const formatDate = (date: Date | null) => {
    if (!date) return "同期中...";
    return new Intl.DateTimeFormat("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20 relative">
      
      {/* 削除確認モーダル */}
      {responseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
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
                onClick={() => setResponseToDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteResponse}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center overflow-hidden">
            <button
              onClick={() => router.push("/top/surveys")}
              className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
              title="管理に戻る"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="truncate">
              <div className="flex items-center text-xs font-bold text-purple-600 mb-0.5">
                <FileText className="h-3 w-3 mr-1" /> 回答ビューア
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                {survey?.title}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* UIアラート表示部 */}
      {alert.show && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className={`p-4 rounded-lg shadow-lg flex items-center border-l-4 ${alert.type === "success" ? "bg-white border-green-500 text-green-800" : "bg-white border-red-500 text-red-800"}`}>
            {alert.type === "success" ? <CheckCircle className="h-6 w-6 text-green-500 mr-3" /> : <AlertCircle className="h-6 w-6 text-red-500 mr-3" />}
            <span className="font-bold text-sm">{alert.message}</span>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* アンケート要約情報 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-8">
          <div className="flex items-center flex-wrap gap-2 mb-3">
            {survey?.isPublic ? (
              <span className="flex items-center text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-xs font-bold"><Globe className="h-3 w-3 mr-1" /> 一般公開</span>
            ) : (
              <span className="flex items-center text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100 text-xs font-bold"><Lock className="h-3 w-3 mr-1" /> 限定公開</span>
            )}
            {survey?.isAnonymous ? (
              <span className="flex items-center text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-xs font-bold"><UserX className="h-3 w-3 mr-1" /> 匿名式</span>
            ) : (
              <span className="flex items-center text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 text-xs font-bold"><User className="h-3 w-3 mr-1" /> 記名式</span>
            )}
          </div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap mb-6">{survey?.description || "説明はありません。"}</p>
          <div className="border-t border-gray-100 pt-4 flex justify-between items-end">
            <span className="text-sm font-bold text-gray-500">集まった回答の総数</span>
            <div className="text-3xl font-extrabold text-purple-600 flex items-baseline">
              {responses.length} <span className="text-sm font-bold text-gray-500 ml-1">件</span>
            </div>
          </div>
        </div>

        {/* 回答一覧 */}
        <div className="space-y-4">
          <h3 className="text-lg font-extrabold text-gray-900 flex items-center mb-4">
            <MessageSquare className="h-5 w-5 mr-2 text-gray-500" /> 回収された意見一覧
          </h3>
          
          {responses.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-500">回答はまだ届いていません。</p>
            </div>
          ) : (
            <div className="space-y-4">
              {responses.map((response, index) => {
                const isAnonymous = response.respondentName === "匿名";
                
                return (
                  <div key={response.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="px-4 py-3 sm:px-6 bg-gray-50 flex justify-between items-center border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-extrabold text-gray-400">
                          #{responses.length - index}
                        </span>
                        <div className={`flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          isAnonymous 
                            ? "bg-gray-200 text-gray-600" 
                            : "bg-blue-100 text-blue-800 border border-blue-200 shadow-sm"
                        }`}>
                          {isAnonymous ? <UserX className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                          {response.respondentName}
                          {!isAnonymous && response.respondentId && (
                            <span className="ml-1 opacity-60 font-normal"> (認証済)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center text-xs font-medium text-gray-500">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        {formatDate(response.createdAt)}
                      </div>
                    </div>
                    <div className="p-4 sm:p-6">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap font-medium leading-relaxed">
                        {response.content}
                      </p>
                      <div className="mt-4 pt-3 border-t border-gray-50 flex justify-end">
                        <button
                          onClick={() => setResponseToDelete(response.id)}
                          className="inline-flex items-center text-xs font-bold text-red-500 hover:text-red-700 bg-white hover:bg-red-50 px-3 py-1.5 rounded-md border border-transparent hover:border-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> この回答を削除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}