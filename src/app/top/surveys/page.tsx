"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ArrowLeft, FileText, Loader2, Save, Settings, PencilLine } from "lucide-react";
import { useDialog } from "@/components/DialogContext";

import { UserData, Survey, Question, SurveySettings, getDefaultSurveySettings, sanitizeSurveyData } from "./types";
import SurveyRespondList from "./components/SurveyRespondList";
import SurveyList from "./components/SurveyList";
import SurveyBuilder from "./components/SurveyBuilder";
import SurveyDefaultSettings from "./components/SurveyDefaultSettings";

export default function SurveysManagementPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showAlert, showConfirm } = useDialog();

  const [view, setView] = useState<"respond" | "list" | "builder" | "defaults">("respond");

  const [userData, setUserData] = useState<UserData | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserData[]>([]);
  const [schoolData, setSchoolData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [myRespondedIds, setMyRespondedIds] = useState<Set<string>>(new Set());
  const [isLoadingSurveys, setIsLoadingSurveys] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("無題のフォーム");
  const [formDescription, setFormDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<SurveySettings>(getDefaultSurveySettings());
  const [responsesCount, setResponsesCount] = useState(0);
  
  const [isSaving, setIsSaving] = useState(false);

  const canManageDefaults = userData?.role === "admin" || userData?.role === "system_admin" || userData?.isITManager;

  // ★ URLの変更を監視してタブ状態を常に同期させる
  useEffect(() => {
    const tabParam = searchParams.get("tab") as "respond" | "list" | "builder" | "defaults";
    if (tabParam && ["respond", "list", "builder", "defaults"].includes(tabParam)) {
      setView(tabParam);
    } else {
      setView("respond");
    }
  }, [searchParams]);

  const changeTab = (newTab: "respond" | "list" | "builder" | "defaults") => {
    setView(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    if (newTab !== "builder") {
      params.delete("editTab");
      params.delete("id");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const uData = { id: user.uid, ...userDoc.data() } as UserData;
            setUserData(uData);
            
            const schoolDoc = await getDoc(doc(db, "schools", uData.schoolId));
            let sData: any = {};
            if (schoolDoc.exists()) {
              sData = { id: schoolDoc.id, ...schoolDoc.data() };
              setSchoolData(sData);
            }
            
            fetchSurveysAndResponses(uData.schoolId, uData.id, sData.surveyDefaults);

            const qUsers = query(collection(db, "users"), where("schoolId", "==", uData.schoolId));
            const snapUsers = await getDocs(qUsers);
            const users: UserData[] = [];
            snapUsers.forEach(d => users.push({ id: d.id, ...d.data() } as UserData));
            setTenantUsers(users);

          } else {
            router.push("/login");
          }
        } catch (error) {
          showAlert("ユーザー情報の取得に失敗しました。", "error");
        } finally {
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchSurveysAndResponses = async (tenantId: string, userId: string, defaults?: SurveySettings) => {
    setIsLoadingSurveys(true);
    try {
      const q = query(collection(db, "surveys"), where("tenantId", "==", tenantId));
      const snap = await getDocs(q);
      const sData: Survey[] = [];
      const defaultSet = defaults || getDefaultSurveySettings();

      for (const d of snap.docs) {
        const surveyInfo = sanitizeSurveyData({ id: d.id, ...d.data() }, defaultSet);
        const rQ = query(collection(db, "survey_responses"), where("surveyId", "==", d.id));
        const rSnap = await getDocs(rQ);
        surveyInfo.responsesCount = rSnap.size;
        sData.push(surveyInfo);
      }
      
      sData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setSurveys(sData);

      // URLパラメータに id があればエディタにロードする
      const targetId = searchParams.get("id");
      const tab = searchParams.get("tab");
      if (tab === "builder" && targetId) {
        const target = sData.find(s => s.id === targetId);
        if (target) {
          setEditingId(target.id);
          setFormTitle(target.title);
          setFormDescription(target.description);
          setSettings(target.settings);
          setQuestions(target.questions || []);
          setResponsesCount(target.responsesCount || 0);
        }
      }

      const myRQ = query(collection(db, "survey_responses"), where("respondentId", "==", userId));
      const myRSnap = await getDocs(myRQ);
      const myIds = new Set<string>();
      myRSnap.forEach(d => myIds.add(d.data().surveyId));
      setMyRespondedIds(myIds);

    } catch (error) {
      showAlert("データの取得に失敗しました。", "error");
    } finally {
      setIsLoadingSurveys(false);
    }
  };

  const copyToClipboard = (id: string) => {
    const url = `${window.location.origin}/s/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      showAlert("共有URLをコピーしました", "success");
    }).catch(() => {
      showAlert("コピーに失敗しました", "error");
    });
  };

  const openBuilderNew = () => {
    setEditingId(null);
    setFormTitle("無題のフォーム");
    setFormDescription("");
    setSettings(schoolData?.surveyDefaults ? { ...getDefaultSurveySettings(), ...schoolData.surveyDefaults } : getDefaultSurveySettings());
    setQuestions([{ id: Math.random().toString(36).substring(2,9), type: "radio", title: "無題の質問", options: ["選択肢 1"], required: false }]);
    setResponsesCount(0);
    changeTab("builder");
  };

  const openBuilderEdit = (survey: Survey, editTab: "questions" | "settings" = "questions") => {
    setEditingId(survey.id);
    setFormTitle(survey.title);
    setFormDescription(survey.description);
    setSettings(survey.settings);
    setQuestions(survey.questions || []);
    setResponsesCount(survey.responsesCount || 0);
    
    setView("builder");
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "builder");
    params.set("editTab", editTab);
    params.set("id", survey.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSaveSurvey = async () => {
    if (!userData) return;
    if (!formTitle.trim()) { showAlert("フォームのタイトルを入力してください。", "error"); return; }
    if (questions.length === 0) { showAlert("最低1つの質問を追加してください。", "error"); return; }

    for (const q of questions) {
      if (!q.title.trim()) { showAlert("タイトルが未入力の質問があります。", "error"); return; }
      if (q.type !== "text" && q.options.some(opt => !opt.trim())) { showAlert("空の選択肢が含まれています。", "error"); return; }
    }

    setIsSaving(true);
    const now = new Date().toISOString();

    try {
      const surveyData = {
        title: formTitle,
        description: formDescription,
        tenantId: userData.schoolId,
        settings,
        questions,
        updatedAt: now,
      };

      if (editingId) {
        await updateDoc(doc(db, "surveys", editingId), surveyData);
        showAlert("フォームを更新しました。", "success");
      } else {
        await addDoc(collection(db, "surveys"), {
          ...surveyData,
          createdBy: userData.id,
          createdAt: now,
        });
        showAlert("新しいフォームを作成しました。", "success");
      }
      
      fetchSurveysAndResponses(userData.schoolId, userData.id, schoolData?.surveyDefaults);
      changeTab("list");
    } catch (error) {
      showAlert("フォームの保存に失敗しました。", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const executeDeleteSurvey = async (id: string) => {
    try {
      await deleteDoc(doc(db, "surveys", id));
      setSurveys(surveys.filter(s => s.id !== id));
      showAlert("フォームを削除しました。", "success");
    } catch (error) {
      showAlert("フォームの削除に失敗しました。", "error");
    }
  };

  const handleDeleteSurvey = (id: string) => {
    showConfirm("このフォームを削除しますか？\n関連する回答データがある場合はアクセスできなくなります。", () => executeDeleteSurvey(id), "danger", "アンケート削除の確認");
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin h-10 w-10 text-purple-600" /></div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-20 font-sans">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            {view !== "respond" && view !== "list" && (
              <button onClick={() => changeTab("list")} className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
            )}
            <FileText className="h-6 w-6 text-purple-600 mr-2" />
            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">
              {view === "list" ? "フォーム管理・作成" : view === "builder" ? "フォームエディタ" : view === "defaults" ? "テナントデフォルト設定" : "配信されたフォーム"}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">

          {view === "list" && canManageDefaults && (
              <button onClick={() => changeTab("defaults")} className="hidden sm:inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-bold rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                <Settings className="w-4 h-4 mr-1.5" /> デフォルト設定
              </button>
            )}

            
            {(view === "respond" || view === "list") && (
              <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner text-xs font-bold">
                <button 
                  onClick={() => changeTab("respond")} 
                  className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors ${view === "respond" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <PencilLine className="w-4 h-4" /> 回答
                </button>
                <button 
                  onClick={() => changeTab("list")} 
                  className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors ${view === "list" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <FileText className="w-4 h-4" /> 管理
                </button>
              </div>
            )}

            {view === "builder" && (
              <button onClick={handleSaveSurvey} disabled={isSaving} className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-bold rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none transition-colors">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}保存する
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {view === "respond" && (
          <SurveyRespondList 
            surveys={surveys}
            myRespondedIds={myRespondedIds}
            currentUserId={userData!.id}
          />
        )}

        {view === "list" && (
          <SurveyList 
            surveys={surveys} isLoading={isLoadingSurveys} 
            onNew={openBuilderNew} onEdit={openBuilderEdit} onDelete={handleDeleteSurvey} onCopyUrl={copyToClipboard}
            currentUserId={userData!.id}
          />
        )}

        {view === "builder" && (
          <SurveyBuilder 
            formTitle={formTitle} setFormTitle={setFormTitle} formDescription={formDescription} setFormDescription={setFormDescription}
            questions={questions} setQuestions={setQuestions} settings={settings} setSettings={setSettings}
            tenantUsers={tenantUsers} surveyId={editingId} responsesCount={responsesCount}
          />
        )}

        {view === "defaults" && schoolData && (
          <SurveyDefaultSettings schoolId={schoolData.id} tenantUsers={tenantUsers} />
        )}
      </main>
    </div>
  );
}