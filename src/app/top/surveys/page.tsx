"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { 
  Plus, Trash2, Save, Share2, Copy, AlertCircle, CheckCircle, 
  ArrowLeft, Edit2, FileText, Globe, Lock, Loader2, Eye, LayoutList, Settings, User, UserX
} from "lucide-react";
import Link from "next/link";

// --- 型定義 ---
type UserData = {
  id: string;
  name: string;
  schoolId: string;
  role: string;
};

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
  createdBy: string;
  isPublic: boolean;
  isActive: boolean;
  isAnonymous: boolean; // ★追加: 匿名式かどうか
  questions: Question[];
  createdAt: string;
  updatedAt: string;
};

export default function SurveysManagementPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // UIアラート用ステート
  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "error", message: string } | null>(null);

  // 画面遷移ステート: 'list' = 一覧, 'builder' = 作成・編集
  const [view, setView] = useState<"list" | "builder">("list");

  // データ一覧用ステート
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoadingSurveys, setIsLoadingSurveys] = useState(false);

  // ビルダー用ステート
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("無題のフォーム");
  const [formDescription, setFormDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false); // ★追加
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // --- 初期化・データ取得 ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const uData = { id: userDoc.id, ...userDoc.data() } as UserData;
            setUserData(uData);
            fetchSurveys(uData.schoolId);
          } else {
            router.push("/login");
          }
        } catch (error) {
          console.error("User fetch error:", error);
          showAlert("error", "ユーザー情報の取得に失敗しました。");
        } finally {
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchSurveys = async (tenantId: string) => {
    setIsLoadingSurveys(true);
    try {
      const q = query(collection(db, "surveys"), where("tenantId", "==", tenantId));
      const snap = await getDocs(q);
      const sData: Survey[] = [];
      snap.forEach(doc => sData.push({ id: doc.id, ...doc.data() } as Survey));
      
      // 作成日時の降順でソート
      sData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSurveys(sData);
    } catch (error) {
      console.error("Survey fetch error:", error);
      showAlert("error", "アンケート一覧の取得に失敗しました。");
    } finally {
      setIsLoadingSurveys(false);
    }
  };

  // --- UIアラート ---
  const showAlert = (type: "success" | "error", message: string) => {
    setAlertInfo({ type, message });
    setTimeout(() => setAlertInfo(null), 5000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showAlert("success", "クリップボードにコピーしました");
    }).catch(() => {
      showAlert("error", "コピーに失敗しました");
    });
  };

  // --- ビルダー操作 ---
  const openBuilderNew = () => {
    setEditingId(null);
    setFormTitle("無題のフォーム");
    setFormDescription("");
    setIsPublic(false);
    setIsActive(true);
    setIsAnonymous(false);
    setQuestions([{ id: generateId(), type: "radio", title: "無題の質問", options: ["選択肢 1"], required: false }]);
    setView("builder");
  };

  const openBuilderEdit = (survey: Survey) => {
    setEditingId(survey.id);
    setFormTitle(survey.title);
    setFormDescription(survey.description);
    setIsPublic(survey.isPublic);
    setIsActive(survey.isActive);
    setIsAnonymous(survey.isAnonymous ?? false);
    setQuestions(survey.questions || []);
    setView("builder");
  };

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions, 
      { id: generateId(), type: "radio", title: "", options: ["選択肢 1"], required: false }
    ]);
  };

  const handleUpdateQuestion = (qId: string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, [field]: value } : q));
  };

  const handleDeleteQuestion = (qId: string) => {
    setQuestions(questions.filter(q => q.id !== qId));
  };

  const handleAddOption = (qId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        return { ...q, options: [...q.options, `選択肢 ${q.options.length + 1}`] };
      }
      return q;
    }));
  };

  const handleUpdateOption = (qId: string, optIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const handleDeleteOption = (qId: string, optIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptions = q.options.filter((_, idx) => idx !== optIndex);
        if (newOptions.length === 0) newOptions.push("選択肢 1");
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  // --- 保存・削除処理 ---
  const handleSaveSurvey = async () => {
    if (!userData) return;
    if (!formTitle.trim()) {
      showAlert("error", "フォームのタイトルを入力してください。");
      return;
    }
    if (questions.length === 0) {
      showAlert("error", "最低1つの質問を追加してください。");
      return;
    }

    for (const q of questions) {
      if (!q.title.trim()) {
        showAlert("error", "タイトルが未入力の質問があります。");
        return;
      }
      if (q.type !== "text" && q.options.some(opt => !opt.trim())) {
        showAlert("error", "空の選択肢が含まれています。");
        return;
      }
    }

    setIsSaving(true);
    const now = new Date().toISOString();

    try {
      const surveyData = {
        title: formTitle,
        description: formDescription,
        tenantId: userData.schoolId,
        isPublic,
        isActive,
        isAnonymous: isPublic ? true : isAnonymous, // 一般公開なら強制的に匿名
        questions,
        updatedAt: now,
      };

      if (editingId) {
        await updateDoc(doc(db, "surveys", editingId), surveyData);
        showAlert("success", "フォームを更新しました。");
      } else {
        await addDoc(collection(db, "surveys"), {
          ...surveyData,
          createdBy: userData.id,
          createdAt: now,
        });
        showAlert("success", "新しいフォームを作成しました。");
      }
      
      fetchSurveys(userData.schoolId);
      setView("list");
    } catch (error) {
      console.error("Save error:", error);
      showAlert("error", "フォームの保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSurvey = async (id: string) => {
    if (!window.confirm("このフォームを削除しますか？\n関連する回答データがある場合はアクセスできなくなります。")) return;
    try {
      await deleteDoc(doc(db, "surveys", id));
      setSurveys(surveys.filter(s => s.id !== id));
      showAlert("success", "フォームを削除しました。");
    } catch (error) {
      console.error("Delete error:", error);
      showAlert("error", "フォームの削除に失敗しました。");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            {view === "builder" && (
              <button onClick={() => setView("list")} className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
            )}
            <FileText className="h-6 w-6 text-purple-600 mr-2" />
            <h1 className="text-xl font-bold text-gray-900">
              {view === "list" ? "アンケート・投票管理" : "フォームエディタ"}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {view === "builder" && (
              <button 
                onClick={handleSaveSurvey} 
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-bold rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none transition-colors"
              >
                {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                保存する
              </button>
            )}
          </div>
        </div>
      </header>

      {/* UIアラート表示部 */}
      {alertInfo && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className={`p-4 rounded-lg shadow-lg flex items-center border-l-4 ${alertInfo.type === "success" ? "bg-white border-green-500 text-green-800" : "bg-white border-red-500 text-red-800"}`}>
            {alertInfo.type === "success" ? <CheckCircle className="h-6 w-6 text-green-500 mr-3" /> : <AlertCircle className="h-6 w-6 text-red-500 mr-3" />}
            <span className="font-bold text-sm">{alertInfo.message}</span>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        
        {/* ===================== 一覧ビュー ===================== */}
        {view === "list" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">作成済みのフォーム</h2>
                <p className="text-sm text-gray-500 mt-1">アンケートや投票を作成・管理します。</p>
              </div>
              <button 
                onClick={openBuilderNew}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-bold rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-1" /> 新規作成
              </button>
            </div>

            {isLoadingSurveys ? (
              <div className="text-center py-12"><Loader2 className="animate-spin h-8 w-8 text-purple-600 mx-auto" /></div>
            ) : surveys.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <LayoutList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">フォームがありません</h3>
                <p className="text-gray-500 text-sm mb-6">新しいアンケートや投票を作成して、意見を集めましょう。</p>
                <button onClick={openBuilderNew} className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-bold rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                  <Plus className="h-5 w-5 mr-1" /> はじめてのフォームを作成
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {surveys.map(survey => (
                  <div key={survey.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-extrabold text-gray-900 line-clamp-2">{survey.title}</h3>
                        <div className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ml-2 ${survey.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {survey.isActive ? '受付中' : '終了'}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-4">{survey.description || "説明なし"}</p>
                      <div className="flex items-center flex-wrap gap-2 text-xs font-medium mb-1">
                        {survey.isPublic ? (
                          <span className="flex items-center text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100"><Globe className="h-3 w-3 mr-1" /> 一般公開</span>
                        ) : (
                          <span className="flex items-center text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100"><Lock className="h-3 w-3 mr-1" /> 限定公開</span>
                        )}
                        {survey.isAnonymous ? (
                          <span className="flex items-center text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200"><UserX className="h-3 w-3 mr-1" /> 匿名式</span>
                        ) : (
                          <span className="flex items-center text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100"><User className="h-3 w-3 mr-1" /> 記名式</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">作成: {new Date(survey.createdAt).toLocaleDateString()}</div>
                    </div>
                    
                    <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex space-x-2">
                        <button onClick={() => openBuilderEdit(survey)} className="text-purple-600 hover:text-purple-900 p-2 rounded-md hover:bg-purple-50 transition-colors" title="編集">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteSurvey(survey.id)} className="text-red-600 hover:text-red-900 p-2 rounded-md hover:bg-red-50 transition-colors" title="削除">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex space-x-2">
                        <Link href={`/top/surveys/${survey.id}/responses`} className="inline-flex items-center px-3 py-1.5 border border-purple-200 text-xs font-bold rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors" title="回答を見る">
                          <Eye className="h-3 w-3 mr-1" /> 結果
                        </Link>
                        <button onClick={() => copyToClipboard(`${window.location.origin}/s/${survey.id}`)} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-bold rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors" title="共有URLをコピー">
                          <Share2 className="h-3 w-3 mr-1" /> URL
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== ビルダービュー ===================== */}
        {view === "builder" && (
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* 設定パネル */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-purple-200">
              <h3 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center">
                <Settings className="h-4 w-4 mr-2 text-gray-500" /> フォームの設定
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-5 w-5 rounded text-purple-600 focus:ring-purple-500 border-gray-300" />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">回答を受付中</span>
                    <span className="block text-xs text-gray-500">オフで回答停止</span>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={isPublic} onChange={e => {
                    setIsPublic(e.target.checked);
                    if (e.target.checked) setIsAnonymous(true); // 一般公開時は強制匿名
                  }} className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                  <div>
                    <span className="block text-sm font-bold text-gray-900 text-blue-800 flex items-center">
                      {isPublic ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                      一般公開する
                    </span>
                    <span className="block text-xs text-gray-500">外部の人も回答可能</span>
                  </div>
                </label>

                <label className={`flex items-center space-x-3 p-3 border border-gray-200 rounded-lg transition-colors ${isPublic ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                  <input 
                    type="checkbox" 
                    checked={isAnonymous} 
                    onChange={e => setIsAnonymous(e.target.checked)} 
                    disabled={isPublic}
                    className="h-5 w-5 rounded text-gray-600 focus:ring-gray-500 border-gray-300" 
                  />
                  <div>
                    <span className="block text-sm font-bold text-gray-900 flex items-center">
                      {isAnonymous ? <UserX className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                      匿名式にする
                    </span>
                    <span className="block text-xs text-gray-500">{isPublic ? '一般公開は匿名固定です' : 'オフでアカウント名を記録'}</span>
                  </div>
                </label>
              </div>
            </div>

            {/* フォームヘッダー */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-t-8 border-t-purple-600 p-6 sm:p-8">
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="フォームのタイトル"
                className="w-full text-3xl font-extrabold text-gray-900 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-purple-600 focus:ring-0 px-0 py-2 mb-4 transition-colors bg-transparent placeholder-gray-400"
              />
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="フォームの説明（任意）"
                rows={3}
                className="w-full text-sm text-gray-700 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-purple-600 focus:ring-0 px-0 py-2 transition-colors bg-transparent resize-y placeholder-gray-400"
              />
            </div>

            {/* 質問リスト */}
            <div className="space-y-6">
              {questions.map((q, index) => (
                <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 relative group">
                  
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1.5 bg-gray-200 rounded-b-md opacity-0 group-hover:opacity-100 transition-opacity"></div>

                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
                    <input
                      type="text"
                      value={q.title}
                      onChange={e => handleUpdateQuestion(q.id, "title", e.target.value)}
                      placeholder="質問タイトル"
                      className="flex-1 text-base font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-200 px-4 py-3 transition-colors"
                    />
                    
                    <select
                      value={q.type}
                      onChange={e => handleUpdateQuestion(q.id, "type", e.target.value as QuestionType)}
                      className="w-full sm:w-48 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-3 font-bold shadow-sm"
                    >
                      <option value="radio">◉ ラジオボタン</option>
                      <option value="checkbox">☑ チェックボックス</option>
                      <option value="text">✍ 記述式テキスト</option>
                    </select>
                  </div>

                  {q.type !== "text" ? (
                    <div className="space-y-2 mb-6 ml-2">
                      {q.options.map((opt, optIndex) => (
                        <div key={optIndex} className="flex items-center group/opt">
                          <div className="flex-shrink-0 text-gray-400 mr-3">
                            {q.type === "radio" ? <div className="h-4 w-4 rounded-full border-2 border-gray-300"></div> : <div className="h-4 w-4 rounded border-2 border-gray-300"></div>}
                          </div>
                          <input
                            type="text"
                            value={opt}
                            onChange={e => handleUpdateOption(q.id, optIndex, e.target.value)}
                            placeholder={`選択肢 ${optIndex + 1}`}
                            className="flex-1 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:ring-0 px-0 py-1.5 text-sm text-gray-900 font-medium"
                          />
                          <button
                            onClick={() => handleDeleteOption(q.id, optIndex)}
                            className="ml-2 text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover/opt:opacity-100 transition-opacity focus:opacity-100"
                            tabIndex={-1}
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center pt-2">
                        <div className="flex-shrink-0 text-gray-300 mr-3">
                          {q.type === "radio" ? <div className="h-4 w-4 rounded-full border-2 border-gray-300"></div> : <div className="h-4 w-4 rounded border-2 border-gray-300"></div>}
                        </div>
                        <button
                          onClick={() => handleAddOption(q.id)}
                          className="text-sm font-bold text-gray-500 hover:text-purple-600 transition-colors py-1.5"
                        >
                          選択肢を追加
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6 ml-2">
                      <div className="w-[80%] border-b border-dotted border-gray-400 py-2 text-sm text-gray-400">
                        回答（記述式テキスト）
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end items-center pt-4 border-t border-gray-100 gap-4">
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                      title="質問を削除"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <div className="h-6 w-px bg-gray-200"></div>
                    <label className="flex items-center cursor-pointer">
                      <span className="mr-3 text-sm font-bold text-gray-700">必須</span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={q.required}
                          onChange={e => handleUpdateQuestion(q.id, "required", e.target.checked)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${q.required ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${q.required ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                    </label>
                  </div>

                </div>
              ))}
            </div>

            {/* 質問追加ボタン */}
            <div className="flex justify-center pt-4 pb-8">
              <button
                onClick={handleAddQuestion}
                className="flex items-center px-6 py-3 bg-white border border-gray-300 shadow-sm rounded-full text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-purple-600 hover:border-purple-300 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                <Plus className="h-5 w-5 mr-2" /> 質問を追加
              </button>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}