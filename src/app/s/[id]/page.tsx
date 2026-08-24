"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

import { Survey, UserData, sanitizeSurveyForAnswer, ExistingResponse, getDefaultSurveySettings } from "./types";
import SurveyHeader from "./components/SurveyHeader";
import SurveyError from "./components/SurveyError";
import SurveySuccess from "./components/SurveySuccess";
import SurveyForm from "./components/SurveyForm";

export default function SurveyAnsweringPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [existingResponse, setExistingResponse] = useState<ExistingResponse | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasRespondedLocally, setHasRespondedLocally] = useState(false); 
  const [alert, setAlert] = useState<{ type: "error" | "success", message: string } | null>(null);

  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, any> | null>(null);
  const [hasResponded, setHasResponded] = useState(false);

  useEffect(() => {
    const fetchSurveyAndAuth = async () => {
      try {
        const surveyRef = doc(db, "surveys", surveyId);
        const surveySnap = await getDoc(surveyRef);

        if (!surveySnap.exists()) {
          setErrorMsg("【エラー】\n指定されたアンケートは見つかりませんでした。\nURLが間違っているか、すでに削除された可能性があります。");
          setIsLoading(false);
          return;
        }

        const surveyData = sanitizeSurveyForAnswer(
          { id: surveySnap.id, ...surveySnap.data() }, 
          getDefaultSurveySettings()
        );
        setSurvey(surveyData);

        if (!surveyData.settings.acceptingResponses) {
          setErrorMsg("【受付終了】\nこのアンケートの回答受付は終了しました。");
          setIsLoading(false);
          return;
        }

        const nowTime = Date.now();
        if (surveyData.settings.startDate) {
          const startTime = new Date(surveyData.settings.startDate).getTime();
          if (nowTime < startTime) {
            const formattedStart = new Date(surveyData.settings.startDate).toLocaleString('ja-JP', { year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
            setErrorMsg(`【受付前】\nこのアンケートはまだ開始されていません。\n開始予定日時: ${formattedStart}`);
            setIsLoading(false);
            return;
          }
        }
        if (surveyData.settings.endDate) {
          const endTime = new Date(surveyData.settings.endDate).getTime();
          if (nowTime > endTime) {
            setErrorMsg("【受付終了】\n回答の締切日時を過ぎているため、現在回答を受け付けていません。");
            setIsLoading(false);
            return;
          }
        }

        // ★修正: 先に認証状態を確認し、一般公開であってもログイン済みならユーザー情報を取得する
        onAuthStateChanged(auth, async (user) => {
          try {
            let uData: UserData | null = null;
            if (user) {
              const userDoc = await getDoc(doc(db, "users", user.uid));
              if (userDoc.exists()) {
                uData = { id: user.uid, ...userDoc.data() } as UserData;
              } else {
                const qExt = query(collection(db, "external_users"), where("authUid", "==", user.uid));
                const extDocs = await getDocs(qExt);
                if (!extDocs.empty) {
                  uData = { id: extDocs.docs[0].id, ...extDocs.docs[0].data() } as UserData;
                }
              }
            }

            // 一般公開の場合
            if (surveyData.settings.accessTarget === "public") {
              if (uData) setCurrentUser(uData); // ログインしていれば情報をセット

              if (surveyData.settings.limitToOneResponse) {
                // 1回制限がある場合、ローカルストレージを確認
                if (localStorage.getItem(`survey_responded_${surveyId}`)) {
                  setHasRespondedLocally(true);
                  setHasResponded(true);
                } else if (uData) {
                  // ログインしていればDBも確認する
                  const qResp = query(collection(db, "survey_responses"), where("surveyId", "==", surveyId), where("respondentId", "==", uData.id));
                  const respSnap = await getDocs(qResp);
                  if (!respSnap.empty) {
                    setHasRespondedLocally(true);
                    setHasResponded(true);
                  }
                }
              }
              setIsLoading(false);
              return; // 権限チェックは不要なので終了
            }

            // ここから下は一般公開ではない（限定公開）場合の処理
            if (!uData) {
              router.push("/login"); // ログインしていない場合は弾く
              return;
            }

            setCurrentUser(uData);
            const { accessTarget, respondentIds, limitToOneResponse, allowEditResponse } = surveyData.settings;
            
            if (uData.schoolId !== surveyData.tenantId) {
              setErrorMsg(`【所属エラー】\nこのアンケートは別のテナント向けに作成されているため、あなたのアカウントでは回答できません。`);
            } else if (accessTarget === "tenant_members" && "category" in uData) {
              setErrorMsg(`【権限エラー: 内部メンバー限定】\nこのアンケートは組織内のメンバー専用です。\nあなたのアカウント（外部連携ユーザー）には回答権限がありません。`);
            } else if (accessTarget === "selected_users" && !respondentIds.includes(uData.id)) {
              setErrorMsg(`【権限エラー: 指定回答者のみ】\nこのアンケートは一部の指定されたユーザーのみが回答可能です。\nあなたのアカウントは回答の対象に含まれていません。`);
            } else {
              const qResp = query(collection(db, "survey_responses"), where("surveyId", "==", surveyId), where("respondentId", "==", uData.id));
              const respSnap = await getDocs(qResp);
              
              if (!respSnap.empty) {
                setHasResponded(true);
                if (limitToOneResponse) {
                  setHasRespondedLocally(true);
                } else if (allowEditResponse) {
                  const rData = respSnap.docs[0].data();
                  setExistingResponse({
                    id: respSnap.docs[0].id,
                    rawAnswers: rData.rawAnswers || {},
                    manualScores: rData.manualScores || {},
                    email: rData.email || "",
                    respondentName: rData.respondentName || ""
                  });
                }
              }
            }
            setIsLoading(false);

          } catch (err) {
            console.error("Auth check error:", err);
            setErrorMsg("【システムエラー】\n認証情報の確認中にエラーが発生しました。");
            setIsLoading(false);
          }
        });

      } catch (error: any) {
        console.error("Survey fetch error:", error);
        // ★修正: Firestoreのルールで弾かれた場合のエラーを具体的に表示
        if (error.code === 'permission-denied') {
          setErrorMsg("【アクセス権限エラー】\nこのアンケートを読み込む権限がありません。");
        } else {
          setErrorMsg(`【通信エラー】\nデータの取得に失敗しました。\nネットワーク環境を確認し、再度お試しください。\n(${error.message})`);
        }
        setIsLoading(false);
      }
    };

    fetchSurveyAndAuth();
  }, [surveyId, router]);

  const showAlert = (type: "error" | "success", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleSuccess = (finalAnswers?: Record<string, any>, manualScores?: Record<string, number>) => {
    if (survey?.settings.limitToOneResponse) {
      localStorage.setItem(`survey_responded_${survey.id}`, "true");
    }
    if (!survey?.settings.disableAutosave) {
      const storageKey = currentUser ? `survey_draft_${survey?.id}_${currentUser.id}` : `survey_draft_${survey?.id}_guest`;
      localStorage.removeItem(storageKey);
    }
    setHasResponded(true);
    if (finalAnswers) setSubmittedAnswers(finalAnswers);
    setIsSuccess(true);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin h-10 w-10 text-purple-600" /></div>;

  if (errorMsg) return <SurveyError errorMsg={errorMsg} />;
  
  if (hasRespondedLocally && !isSuccess) {
    return <SurveyError errorMsg="【回答済み】\nすでに回答済みです。このフォームは1回のみ回答可能です。" />;
  }

  // ★ 既存の manualScores を SurveySuccess に渡す
  const currentManualScores = existingResponse?.manualScores || undefined;

  if (isSuccess) return <SurveySuccess survey={survey} currentUser={currentUser} submittedAnswers={submittedAnswers} manualScores={currentManualScores} onReset={() => setIsSuccess(false)} />;

  return (
    <div className="min-h-screen bg-[#f3f2f7] pb-20 font-sans">
      
      <SurveyHeader survey={survey} />

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
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 leading-tight">{survey?.title}</h1>
          {survey?.description && (
            <p className="text-sm font-medium text-gray-600 whitespace-pre-wrap leading-relaxed">
              {survey.description}
            </p>
          )}
          
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-bold">
            <div><span className="text-red-500 mr-1 text-base leading-none">*</span> は必須の質問です</div>
            {!survey?.settings.disableAutosave && (
              <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> 自動保存が有効</span>
            )}
          </div>
        </div>

        {survey && (
          <SurveyForm 
            survey={survey} 
            currentUser={currentUser} 
            existingResponse={existingResponse}
            hasResponded={hasResponded}
            onSuccess={handleSuccess} 
            showAlert={showAlert} 
          />
        )}
      </main>
    </div>
  );
}