export function generateStaticParams() {
  return [];
}

// （以下、元からあるコード）
// 

"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  AlertCircle, CheckCircle, Send, Loader2, FileText, Lock, Globe, User, UserX, Info
} from "lucide-react";

// --- 型定義 ---
type QuestionType = "text" | "radio" | "checkbox";

type Question = {
  id: string;
  type: QuestionType;
  title: string;
  options: string[];
  required: boolean;
};

type Survey = {
  id: string;
  title: string;
  description: string;
  tenantId: string;
  isPublic: boolean;
  isActive: boolean;
  isAnonymous: boolean;
  questions: Question[];
};

type UserData = {
  id: string;
  name: string;
  schoolId: string;
};

export default function SurveyAnsweringPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [alert, setAlert] = useState<{ type: "error" | "success", message: string } | null>(null);

  useEffect(() => {
    const fetchSurveyAndAuth = async () => {
      try {
        const surveyRef = doc(db, "surveys", surveyId);
        const surveySnap = await getDoc(surveyRef);

        if (!surveySnap.exists()) {
          setErrorMsg("指定されたアンケートは見つかりませんでした。");
          setIsLoading(false);
          return;
        }

        const surveyData = { id: surveySnap.id, ...surveySnap.data() } as Survey;
        setSurvey(surveyData);

        if (!surveyData.isActive) {
          setErrorMsg("このアンケートの回答受付は終了しました。");
          setIsLoading(false);
          return;
        }

        onAuthStateChanged(auth, async (user) => {
          if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const uData = { id: user.uid, ...userDoc.data() } as UserData;
              setCurrentUser(uData);

              if (!surveyData.isPublic && uData.schoolId !== surveyData.tenantId) {
                setErrorMsg("このアンケートに回答する権限がありません。");
              }
            }
          } else {
            if (!surveyData.isPublic) {
              router.push("/login");
              return;
            }
          }
          setIsLoading(false);
        });

      } catch (error) {
        console.error("Fetch error:", error);
        setErrorMsg("データの取得に失敗しました。");
        setIsLoading(false);
      }
    };

    fetchSurveyAndAuth();
  }, [surveyId, router]);

  const showAlert = (type: "error" | "success", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleTextChange = (qId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleRadioChange = (qId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleCheckboxChange = (qId: string, value: string, checked: boolean) => {
    setAnswers(prev => {
      const current = (prev[qId] as string[]) || [];
      if (checked) {
        return { ...prev, [qId]: [...current, value] };
      } else {
        return { ...prev, [qId]: current.filter(v => v !== value) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;

    for (const q of survey.questions) {
      if (q.required) {
        const ans = answers[q.id];
        if (!ans || (Array.isArray(ans) && ans.length === 0)) {
          showAlert("error", "必須項目が未入力です。すべての必須質問に回答してください。");
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const formattedContent = survey.questions.map(q => {
        const ans = answers[q.id];
        let ansStr = "未回答";
        if (ans) {
          ansStr = Array.isArray(ans) ? ans.join(", ") : ans;
        }
        return `【${q.title}】\n${ansStr}`;
      }).join("\n\n");

      // 記名か匿名かはフォームの設定（survey.isAnonymous）に依存する
      const isNamed = !survey.isPublic && !survey.isAnonymous && currentUser;
      const finalRespondentName = isNamed ? currentUser.name : "匿名";
      const finalRespondentId = isNamed ? currentUser.id : null;

      await addDoc(collection(db, "survey_responses"), {
        surveyId: survey.id,
        respondentName: finalRespondentName,
        respondentId: finalRespondentId,
        content: formattedContent,
        createdAt: serverTimestamp(),
      });

      setIsSuccess(true);
    } catch (error) {
      console.error("Submit error:", error);
      showAlert("error", "回答の送信に失敗しました。通信環境を確認してください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-purple-600" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white shadow-sm sm:rounded-xl max-w-md w-full p-8 text-center border-t-4 border-gray-400">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
            <AlertCircle className="h-6 w-6 text-gray-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">アクセスできません</h2>
          <p className="text-sm text-gray-600 mb-6">{errorMsg}</p>
          <button onClick={() => router.push("/")} className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            トップページへ戻る
          </button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white shadow-sm sm:rounded-xl max-w-md w-full p-8 text-center border-t-4 border-purple-600">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 mb-4">
            <CheckCircle className="h-8 w-8 text-purple-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">回答を送信しました</h2>
          <p className="text-sm font-medium text-gray-600 mb-8">
            ご協力ありがとうございました。<br />あなたの回答は正常に記録されました。
          </p>
          {currentUser ? (
            <button onClick={() => router.push("/top")} className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors">
              ポータルに戻る
            </button>
          ) : (
            <div className="text-xs text-gray-400">このウィンドウを閉じて終了してください。</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2f7] pb-20">
      
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center text-purple-600 font-extrabold text-lg">
            <FileText className="h-5 w-5 mr-2" />
            回答フォーム
          </div>
          <div className="flex items-center text-xs font-bold text-gray-500">
            {survey?.isPublic ? (
              <span className="flex items-center bg-blue-50 text-blue-700 px-2 py-1 rounded"><Globe className="h-3 w-3 mr-1" /> 一般公開</span>
            ) : (
              <span className="flex items-center bg-gray-100 px-2 py-1 rounded"><Lock className="h-3 w-3 mr-1" /> 限定公開</span>
            )}
          </div>
        </div>
      </header>

      {alert && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className={`p-4 rounded-lg shadow-lg flex items-center border-l-4 ${alert.type === "success" ? "bg-white border-green-500 text-green-800" : "bg-white border-red-500 text-red-800"}`}>
            {alert.type === "success" ? <CheckCircle className="h-6 w-6 text-green-500 mr-3" /> : <AlertCircle className="h-6 w-6 text-red-500 mr-3" />}
            <span className="font-bold text-sm">{alert.message}</span>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-t-8 border-t-purple-600 p-6 sm:p-8 mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4">{survey?.title}</h1>
          {survey?.description && (
            <p className="text-sm font-medium text-gray-600 whitespace-pre-wrap leading-relaxed">
              {survey.description}
            </p>
          )}
          
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center text-xs text-gray-500 font-medium">
            <span className="text-red-500 mr-1">*</span> は必須の質問です
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {survey?.questions.map((q) => (
            <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-start">
                <span className="mr-2">{q.title}</span>
                {q.required && <span className="text-red-500 text-lg leading-none">*</span>}
              </h3>

              <div className="space-y-3">
                {q.type === "text" && (
                  <textarea
                    required={q.required}
                    value={(answers[q.id] as string) || ""}
                    onChange={e => handleTextChange(q.id, e.target.value)}
                    placeholder="回答を入力してください"
                    rows={4}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-200 px-4 py-3 transition-colors text-sm font-medium"
                  />
                )}

                {q.type === "radio" && q.options.map((opt, i) => (
                  <label key={i} className="flex items-center p-3 border border-transparent rounded-lg hover:bg-purple-50 cursor-pointer transition-colors group">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      required={q.required && !answers[q.id]}
                      checked={answers[q.id] === opt}
                      onChange={() => handleRadioChange(q.id, opt)}
                      className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 mr-3"
                    />
                    <span className="text-sm font-bold text-gray-700 group-hover:text-purple-900">{opt}</span>
                  </label>
                ))}

                {q.type === "checkbox" && q.options.map((opt, i) => {
                  const isChecked = ((answers[q.id] as string[]) || []).includes(opt);
                  return (
                    <label key={i} className="flex items-center p-3 border border-transparent rounded-lg hover:bg-purple-50 cursor-pointer transition-colors group">
                      <input
                        type="checkbox"
                        value={opt}
                        checked={isChecked}
                        onChange={(e) => handleCheckboxChange(q.id, opt, e.target.checked)}
                        className="h-5 w-5 rounded text-purple-600 focus:ring-purple-500 border-gray-300 mr-3"
                      />
                      <span className="text-sm font-bold text-gray-700 group-hover:text-purple-900">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 送信前の注意書き（記名式か匿名式かを明示） */}
          <div className={`rounded-xl shadow-sm border p-6 mt-6 flex items-start ${
            survey?.isPublic || survey?.isAnonymous 
              ? "bg-gray-50 border-gray-200" 
              : "bg-blue-50 border-blue-200"
          }`}>
            <Info className={`h-6 w-6 mr-3 flex-shrink-0 ${
              survey?.isPublic || survey?.isAnonymous ? "text-gray-400" : "text-blue-500"
            }`} />
            <div>
              <h4 className={`text-sm font-bold mb-1 ${
                survey?.isPublic || survey?.isAnonymous ? "text-gray-700" : "text-blue-900"
              }`}>
                {survey?.isPublic || survey?.isAnonymous ? "このアンケートは匿名式です" : "このアンケートは記名式です"}
              </h4>
              <p className={`text-xs ${
                survey?.isPublic || survey?.isAnonymous ? "text-gray-500" : "text-blue-700"
              }`}>
                {survey?.isPublic 
                  ? "一般公開されているため、誰が送信したかは記録されません。" 
                  : survey?.isAnonymous 
                    ? "誰が送信したかは管理者にも分からないようになっています。" 
                    : `送信すると、あなたのアカウント名（${currentUser?.name || "未取得"}）が管理者に記録・表示されます。`}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
            <div className="text-xs font-bold text-gray-400 mb-4 sm:mb-0 text-center sm:text-left">
              回答内容は管理者にのみ送信されます。<br className="hidden sm:block" />送信後は内容の変更ができません。
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent rounded-full shadow-sm text-base font-extrabold text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
              ) : (
                <Send className="h-5 w-5 mr-2" />
              )}
              回答を送信する
            </button>
          </div>
          
        </form>
      </main>
    </div>
  );
}