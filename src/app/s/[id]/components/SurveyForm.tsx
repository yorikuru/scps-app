"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Send, Info, Mail, User, Clock, Play, ChevronRight, ChevronLeft, BarChart3 } from "lucide-react";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase"; 
import { Survey, UserData, Question, ExistingResponse } from "../types";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import CustomSelect from "@/components/CustomSelect";

type Props = {
  survey: Survey;
  currentUser: UserData | null;
  existingResponse: ExistingResponse | null;
  hasResponded?: boolean;
  onSuccess: (answers?: Record<string, any>, manualScores?: Record<string, number>) => void;
  showAlert: (type: "error" | "success", message: string) => void;
};

export default function SurveyForm({ survey, currentUser, existingResponse, hasResponded = false, onSuccess, showAlert }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [emailAnswer, setEmailAnswer] = useState(""); 
  const [guestName, setGuestName] = useState(""); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isStarted, setIsStarted] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  
  const formRef = useRef<HTMLFormElement>(null);
  const [displayQuestions, setDisplayQuestions] = useState<Question[]>([]);

  const initialPage = Number(searchParams.get("page")) || 0;
  const [currentPageIndex, setCurrentPageIndex] = useState(initialPage);
  const [pages, setPages] = useState<Question[][]>([]);

  const draftKey = currentUser ? `survey_draft_${survey.id}_${currentUser.id}` : `survey_draft_${survey.id}_guest`;
  const timerKey = currentUser ? `survey_timer_${survey.id}_${currentUser.id}` : `survey_timer_${survey.id}_guest`;
  const startAtKey = currentUser ? `survey_startedAt_${survey.id}_${currentUser.id}` : `survey_startedAt_${survey.id}_guest`;

  useEffect(() => {
    if (currentUser && (currentUser as any).email && !emailAnswer) {
      setEmailAnswer((currentUser as any).email);
    } else if (auth.currentUser?.email && !emailAnswer) {
      setEmailAnswer(auth.currentUser.email);
    }

    if (existingResponse) {
      setAnswers(existingResponse.rawAnswers || {});
      setEmailAnswer(existingResponse.email || "");
      if (!currentUser) setGuestName(existingResponse.respondentName || "");
      setIsStarted(true); 
    } else if (!survey.settings.disableAutosave) {
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setAnswers(parsed.answers || {});
          setEmailAnswer(parsed.email || "");
          setGuestName(parsed.guestName || "");
        } catch(e) {}
      }
    }

    if (!survey.settings.timeLimit) {
      setIsStarted(true);
    } else {
      const savedStartTime = localStorage.getItem(timerKey);
      if (savedStartTime) setIsStarted(true);
    }

    const { shuffleQuestions, lockedQuestionRange } = survey.settings;
    let finalQuestions = [...survey.questions];
    if (shuffleQuestions === "all") {
      finalQuestions = finalQuestions.sort(() => Math.random() - 0.5);
    } else if (shuffleQuestions === "except_locked") {
      const lockedIndices = new Set<number>();
      if (lockedQuestionRange) {
        lockedQuestionRange.split(",").forEach(p => {
          if (p.includes("-")) {
            const [start, end] = p.split("-").map(Number);
            for (let i = start; i <= end; i++) lockedIndices.add(i - 1);
          } else {
            lockedIndices.add(Number(p) - 1);
          }
        });
      }
      const locked: { q: Question; i: number }[] = [];
      const unlocked: Question[] = [];
      survey.questions.forEach((q, i) => {
        if (lockedIndices.has(i)) locked.push({ q, i });
        else unlocked.push(q);
      });
      unlocked.sort(() => Math.random() - 0.5);
      const finalQ = new Array(survey.questions.length);
      locked.forEach(l => finalQ[l.i] = l.q);
      let uIdx = 0;
      for (let i = 0; i < finalQ.length; i++) {
        if (!finalQ[i]) finalQ[i] = unlocked[uIdx++];
      }
      finalQuestions = finalQ;
    }
    setDisplayQuestions(finalQuestions);

    const newPages: Question[][] = [];
    let currentPageData: Question[] = [];

    finalQuestions.forEach(q => {
      if (q.type === "section") {
        if (currentPageData.length > 0 || newPages.length === 0) {
          newPages.push(currentPageData);
          currentPageData = [];
        }
      }
      currentPageData.push(q);
    });
    if (currentPageData.length > 0) newPages.push(currentPageData);
    
    setPages(newPages);

  }, [survey, existingResponse, currentUser, draftKey, timerKey, emailAnswer]);

  useEffect(() => {
    if (isStarted && !localStorage.getItem(startAtKey)) {
      localStorage.setItem(startAtKey, Date.now().toString());
    }
  }, [isStarted, startAtKey]);

  useEffect(() => {
    if (!survey.settings.disableAutosave && Object.keys(answers).length > 0 && !existingResponse && isStarted) {
      const safeAnswers = { ...answers };
      for (const k in safeAnswers) {
        if (safeAnswers[k] instanceof Array && safeAnswers[k][0] instanceof File) {
          delete safeAnswers[k];
        }
      }
      const draft = { answers: safeAnswers, email: emailAnswer, guestName };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }
  }, [answers, emailAnswer, guestName, survey.id, survey.settings.disableAutosave, existingResponse, isStarted, draftKey]);

  const validateCurrentPage = () => {
    if (currentPageIndex === 0) {
      if (survey.settings.collectEmail && !emailAnswer.trim()) {
        showAlert("error", "メールアドレスを入力してください。"); return false;
      }
      if (survey.settings.collectRespondentInfo && !currentUser && !guestName.trim()) {
        showAlert("error", "お名前を入力してください。"); return false;
      }
    }
    const currentQ = pages[currentPageIndex] || [];
    for (const q of currentQ) {
      if (q.type === "section" || q.type === "description") continue;
      
      if (q.required) {
        const ans = answers[q.id];
        if (ans === undefined || ans === null || ans === "" || (Array.isArray(ans) && ans.length === 0) || (typeof ans === "object" && !Array.isArray(ans) && Object.keys(ans).length === 0)) {
          showAlert("error", `必須項目（${q.title}）が未入力です。`); return false;
        }
      }
      
      if (q.type === "checkbox") {
        const arr = (answers[q.id] as string[]) || [];
        if (arr.length > 0 && q.checkboxConstraintType && q.checkboxConstraintType !== "none") {
          const limit = q.checkboxConstraintCount || 1;
          if (q.checkboxConstraintType === "exact" && arr.length !== limit) {
            showAlert("error", `「${q.title}」は${limit}個選択してください。`); return false;
          }
          if (q.checkboxConstraintType === "min" && arr.length < limit) {
            showAlert("error", `「${q.title}」は${limit}個以上選択してください。`); return false;
          }
          if (q.checkboxConstraintType === "max" && arr.length > limit) {
            showAlert("error", `「${q.title}」は${limit}個以内で選択してください。`); return false;
          }
        }
      }
    }
    return true;
  };

  const handleNextPage = () => {
    if (validateCurrentPage()) {
      const nextIdx = Math.min(pages.length - 1, currentPageIndex + 1);
      setCurrentPageIndex(nextIdx);
      router.replace(`${pathname}?page=${nextIdx}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    const prevIdx = Math.max(0, currentPageIndex - 1);
    setCurrentPageIndex(prevIdx);
    router.replace(`${pathname}?page=${prevIdx}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLastPage) {
      if (validateCurrentPage()) {
        handleSubmit(undefined, false);
      }
    } else {
      handleNextPage();
    }
  };

  const handleSubmit = useCallback(async (e?: React.FormEvent, isAutoSubmit = false) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (!isAutoSubmit && !validateCurrentPage()) return;

    setIsSubmitting(true);

    try {
      const finalAnswers = { ...answers };
      for (const q of survey.questions) {
        if (q.type === "file" && answers[q.id] && Array.isArray(answers[q.id]) && answers[q.id][0] instanceof File) {
          const files = answers[q.id] as File[];
          const urls = await Promise.all(files.map(async file => {
            const fileRef = ref(storage, `survey_uploads/${survey.id}/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            return await getDownloadURL(fileRef);
          }));
          finalAnswers[q.id] = urls; 
        }
      }

      const finalContent = survey.settings.collectEmail ? `【メールアドレス】\n${emailAnswer}` : "回答内容が記録されました。";
      let finalRespondentName = "匿名";
      let finalRespondentId = null;

      if (survey.settings.collectRespondentInfo) {
        if (currentUser) {
          finalRespondentName = currentUser.name;
          finalRespondentId = currentUser.id;
        } else {
          finalRespondentName = guestName.trim() || "ゲスト";
        }
      }

      let timeTaken = 0;
      const startedAtStr = localStorage.getItem(startAtKey);
      if (startedAtStr) timeTaken = Math.floor((Date.now() - Number(startedAtStr)) / 1000);

      const currentManualScores = existingResponse?.manualScores || {};

      const payload = {
        surveyId: survey.id,
        respondentName: finalRespondentName,
        respondentId: finalRespondentId,
        email: survey.settings.collectEmail ? emailAnswer : null,
        content: finalContent + (isAutoSubmit ? "\n\n(※制限時間超過のため自動送信されました)" : ""),
        rawAnswers: finalAnswers, 
        manualScores: currentManualScores,
        timeTaken: timeTaken,
        updatedAt: serverTimestamp(),
      };

      if (existingResponse) await updateDoc(doc(db, "survey_responses", existingResponse.id), payload);
      else await addDoc(collection(db, "survey_responses"), { ...payload, createdAt: serverTimestamp() });

      localStorage.removeItem(timerKey);
      localStorage.removeItem(startAtKey);
      
      onSuccess(finalAnswers, currentManualScores);

    } catch (error) {
      showAlert("error", "送信に失敗しました。通信環境を確認してください。");
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, currentUser, emailAnswer, existingResponse, guestName, isSubmitting, onSuccess, showAlert, survey, timerKey, startAtKey]);

  useEffect(() => {
    if (!survey.settings.timeLimit || !isStarted) return;
    let startTime = localStorage.getItem(timerKey);
    if (!startTime) {
      startTime = Date.now().toString();
      localStorage.setItem(timerKey, startTime);
    }
    const endTime = Number(startTime) + (survey.settings.timeLimit * 60 * 1000);
    const interval = setInterval(() => {
      const remainingSec = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeftSeconds(remainingSec);
      if (remainingSec <= 0) {
        clearInterval(interval);
        showAlert("error", "制限時間になりました。自動送信します。");
        handleSubmit(undefined, true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [survey.settings.timeLimit, isStarted, timerKey, handleSubmit, showAlert]);

  const updateAns = (qId: string, val: any) => setAnswers(p => ({ ...p, [qId]: val }));

  const formatTimerString = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isAnonymousView = !survey.settings.collectRespondentInfo;
  const answeredCount = survey.questions.filter(q => q.type !== "section" && q.type !== "description" && answers[q.id] && (typeof answers[q.id] !== "object" || Object.keys(answers[q.id]).length > 0)).length;
  const questionCount = survey.questions.filter(q => q.type !== "section" && q.type !== "description").length;
  const progressPercent = questionCount > 0 ? Math.round((answeredCount / questionCount) * 100) : 0;

  const currentQuestions = pages[currentPageIndex] || [];
  const isLastPage = currentPageIndex === pages.length - 1;
  const isFirstPage = currentPageIndex === 0;

  if (survey.settings.timeLimit && !isStarted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-purple-200 p-6 sm:p-8 text-center space-y-4 sm:space-y-6 animate-fade-in font-sans">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto text-purple-600"><Clock className="w-6 h-6 sm:w-8 sm:h-8" /></div>
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2">回答制限時間があります</h2>
          <p className="text-xs sm:text-sm font-bold text-gray-600">このアンケートには制限時間が設定されています。<br />準備ができたら「回答を開始する」ボタンを押してください。</p>
          <div className="mt-4 inline-block px-4 py-2 bg-purple-50 text-purple-700 font-extrabold text-sm sm:text-lg rounded-xl border border-purple-200">制限時間: {survey.settings.timeLimit} 分</div>
        </div>
        <button type="button" onClick={() => { localStorage.setItem(timerKey, Date.now().toString()); localStorage.setItem(startAtKey, Date.now().toString()); setIsStarted(true); }} className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-4 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-sm sm:text-base rounded-full shadow-lg mx-auto flex justify-center items-center"><Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> 回答を開始する</button>
      </div>
    );
  }

  const renderQuestionUI = (q: Question) => {
    const val = answers[q.id];

    switch (q.type) {
      case "text":
        return <input type="text" required={q.required} value={val || ""} onChange={e => updateAns(q.id, e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg focus:border-purple-500 px-3 py-2.5 sm:py-3 outline-none text-xs sm:text-sm font-medium" placeholder="回答を入力" />;
      case "textarea":
        return <textarea required={q.required} value={val || ""} onChange={e => updateAns(q.id, e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg focus:border-purple-500 px-3 py-2.5 sm:py-3 outline-none text-xs sm:text-sm font-medium resize-y" rows={4} placeholder="回答を入力" />;
      case "radio":
        return <div className="space-y-1.5 sm:space-y-2">{q.options.map(o => (
          <label key={o} className="flex items-center p-2.5 sm:p-3 border border-transparent rounded-lg hover:bg-purple-50 cursor-pointer transition-colors group">
            <input type="radio" name={q.id} required={q.required && !val} checked={val === o} onChange={() => updateAns(q.id, o)} className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 border-gray-300 mr-2.5 sm:mr-3" />
            <span className="text-xs sm:text-sm font-bold text-gray-700 group-hover:text-purple-900">{o}</span>
          </label>
        ))}</div>;
      case "checkbox":
        const arr = (val as string[]) || [];
        const limit = q.checkboxConstraintCount || 1;
        const cType = q.checkboxConstraintType;
        const isMaxReached = (cType === "exact" || cType === "max") && arr.length >= limit;
        let constraintText = "";
        if (cType === "exact") constraintText = `※ ${limit} 個選択してください`;
        else if (cType === "min") constraintText = `※ ${limit} 個以上選択してください`;
        else if (cType === "max") constraintText = `※ ${limit} 個以内で選択してください`;

        return (
          <div className="space-y-1.5 sm:space-y-2">
            {constraintText && <p className="text-[10px] sm:text-xs font-bold text-amber-600 mb-1.5 sm:mb-2">{constraintText}</p>}
            {q.options.map(o => {
              const isChecked = arr.includes(o);
              const disabled = !isChecked && isMaxReached;
              return (
                <label key={o} className={`flex items-center p-2.5 sm:p-3 border border-transparent rounded-lg transition-colors group ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-50 cursor-pointer'}`}>
                  <input type="checkbox" disabled={disabled} checked={isChecked} onChange={e => {
                    if (disabled && e.target.checked) return;
                    updateAns(q.id, e.target.checked ? [...arr, o] : arr.filter((x:string) => x !== o));
                  }} className="h-4 w-4 sm:h-5 sm:w-5 rounded text-purple-600 border-gray-300 mr-2.5 sm:mr-3" />
                  <span className="text-xs sm:text-sm font-bold text-gray-700 group-hover:text-purple-900">{o}</span>
                </label>
              )
            })}
          </div>
        );
      case "select":
        return (
          <div className="w-full sm:w-1/2">
            <CustomSelect
              value={val || ""}
              onChange={(selectedVal) => updateAns(q.id, selectedVal)}
              options={[
                { value: "", label: "選択してください" },
                ...q.options.map(o => ({ value: o, label: o }))
              ]}
              buttonClassName="w-full flex items-center justify-between bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-gray-700 outline-none focus:border-purple-500 shadow-sm"
            />
          </div>
        );
      case "file":
        return (
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <input 
              type="file" 
              required={q.required && !val} 
              onChange={e => {
                if (e.target.files) {
                  const files = Array.from(e.target.files);
                  const MAX_SIZE = 2 * 1024 * 1024 * 1024;
                  const oversizedFiles = files.filter(f => f.size > MAX_SIZE);
                  if (oversizedFiles.length > 0) {
                    showAlert("error", "1ファイルあたり最大2GBまでアップロード可能です。");
                    e.target.value = ""; return;
                  }
                  updateAns(q.id, files);
                }
              }} 
              multiple 
              className="text-xs sm:text-sm file:mr-3 file:py-1.5 file:px-3 sm:file:mr-4 sm:file:py-2 sm:file:px-4 file:rounded-full file:border-0 file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer" 
            />
            {val && val[0] instanceof File && <span className="text-[10px] sm:text-xs font-bold text-gray-500">{val.length} 個のファイルを選択中</span>}
            {val && typeof val[0] === "string" && <span className="text-[10px] sm:text-xs font-bold text-emerald-600">アップロード済みファイルがあります</span>}
          </div>
        );
      case "scale":
        const min = q.scaleMin || 1; const max = q.scaleMax || 5;
        const range = Array.from({length: max - min + 1}, (_, i) => min + i);
        return (
          <div className="flex items-end gap-3 sm:gap-4 overflow-x-auto pb-3 sm:pb-4 custom-scrollbar">
            {q.scaleMinLabel && <span className="text-[10px] sm:text-xs font-bold text-gray-500 shrink-0 pb-1">{q.scaleMinLabel}</span>}
            <div className="flex gap-3 sm:gap-6">
              {range.map(num => (
                <label key={num} className="flex flex-col items-center gap-1.5 sm:gap-2 cursor-pointer">
                  <span className="text-xs sm:text-sm font-bold text-gray-700">{num}</span>
                  <input type="radio" name={q.id} value={num} checked={Number(val) === num} onChange={() => updateAns(q.id, num)} className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </label>
              ))}
            </div>
            {q.scaleMaxLabel && <span className="text-[10px] sm:text-xs font-bold text-gray-500 shrink-0 pb-1">{q.scaleMaxLabel}</span>}
          </div>
        );
      case "rating":
        const rMax = q.ratingMax || 5;
        const IconLabel = q.ratingIcon === "heart" ? "♥" : q.ratingIcon === "thumb" ? "👍" : "★";
        return (
          <div className="flex gap-1.5 sm:gap-2">
            {Array.from({length: rMax}, (_, i) => i + 1).map(num => (
              <button type="button" key={num} onClick={() => updateAns(q.id, num)} className={`text-2xl sm:text-3xl transition-transform hover:scale-110 ${Number(val) >= num ? 'text-amber-400' : 'text-gray-200'}`}>{IconLabel}</button>
            ))}
          </div>
        );
      case "ranking":
        const currentRankArr = (val as string[]) || [];
        return (
          <div className="space-y-2 sm:space-y-3">
            {q.options.map((_, i) => (
              <div key={i} className="flex items-center gap-2 sm:gap-3">
                <span className="w-8 text-center font-black text-gray-400 text-xs sm:text-sm">{i + 1}位</span>
                <div className="flex-1">
                  <CustomSelect
                    value={currentRankArr[i] || ""}
                    onChange={(selectedVal) => {
                      if (currentRankArr.includes(selectedVal) && currentRankArr[i] !== selectedVal) {
                        showAlert("error", "すでに他の順位で選択されています。");
                        return; 
                      }
                      const arr = [...currentRankArr]; arr[i] = selectedVal; updateAns(q.id, arr);
                    }}
                    options={[
                      { value: "", label: "選択してください" },
                      ...q.options.map(o => {
                        const isUsed = currentRankArr.includes(o) && currentRankArr[i] !== o;
                        return { value: o, label: isUsed ? `${o} (選択済)` : o };
                      })
                    ]}
                    buttonClassName="w-full flex items-center justify-between bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        );
      case "grid_radio":
        const grVal = val || {};
        return (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs sm:text-sm text-left whitespace-nowrap">
              <thead><tr><th className="p-1.5 sm:p-2"></th>{(q.gridCols||[]).map(c=><th key={c} className="p-1.5 sm:p-2 font-bold text-gray-600 text-center min-w-[60px] sm:min-w-[80px]">{c}</th>)}</tr></thead>
              <tbody>
                {(q.gridRows||[]).map((r, i) => (
                  <tr key={r} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="p-2 sm:p-3 font-bold text-gray-800">{r}</td>
                    {(q.gridCols||[]).map(c => (
                      <td key={c} className="p-2 sm:p-3 text-center">
                        <input type="radio" name={`${q.id}_${r}`} checked={grVal[r] === c} onChange={() => updateAns(q.id, {...grVal, [r]: c})} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 cursor-pointer" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "grid_checkbox":
        const gcVal = val || {};
        return (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs sm:text-sm text-left whitespace-nowrap">
              <thead><tr><th className="p-1.5 sm:p-2"></th>{(q.gridCols||[]).map(c=><th key={c} className="p-1.5 sm:p-2 font-bold text-gray-600 text-center min-w-[60px] sm:min-w-[80px]">{c}</th>)}</tr></thead>
              <tbody>
                {(q.gridRows||[]).map((r, i) => {
                  const arr = gcVal[r] || [];
                  return (
                    <tr key={r} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                      <td className="p-2 sm:p-3 font-bold text-gray-800">{r}</td>
                      {(q.gridCols||[]).map(c => (
                        <td key={c} className="p-2 sm:p-3 text-center">
                          <input type="checkbox" checked={arr.includes(c)} onChange={(e) => {
                            const newArr = e.target.checked ? [...arr, c] : arr.filter((x:string) => x !== c);
                            updateAns(q.id, {...gcVal, [r]: newArr});
                          }} className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-purple-600 cursor-pointer" />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        );
      case "date": return <input type="date" required={q.required} value={val || ""} onChange={e => updateAns(q.id, e.target.value)} className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 sm:px-4 outline-none font-bold text-xs sm:text-sm" />;
      case "time": return <input type="time" required={q.required} value={val || ""} onChange={e => updateAns(q.id, e.target.value)} className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 sm:px-4 outline-none font-bold text-xs sm:text-sm" />;
      default: return null;
    }
  };

  return (
    // ★ h-full と overflow-y-auto を追加し、スマートフォンUIでの縦スクロールを有効化
    <div className="relative font-sans animate-fade-in h-full flex flex-col w-full">
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 px-4 pt-4 sm:px-0 sm:pt-0">
        <form ref={formRef} onSubmit={handleFormSubmit} className="space-y-4 sm:space-y-6">
          
          {timeLeftSeconds !== null && (
            <div className="sticky top-0 z-30 bg-purple-900 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-lg flex items-center justify-between font-mono animate-pulse mb-4 sm:mb-6">
              <span className="text-[10px] sm:text-xs font-bold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300" /> 残り回答時間</span>
              <span className={`text-base sm:text-lg font-black ${timeLeftSeconds < 60 ? 'text-red-300 animate-ping' : 'text-amber-300'}`}>
                {formatTimerString(timeLeftSeconds)}
              </span>
            </div>
          )}

          {isFirstPage && survey.settings.collectEmail && (
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1.5 sm:mb-2 flex items-center"><Mail className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-red-500" />メールアドレス <span className="text-red-500 ml-1">*</span></h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mb-3 sm:mb-4">このフォームはメールアドレスを収集します。初期値としてアカウントのメールアドレスが設定されます（変更可能）。</p>
              <input type="email" required value={emailAnswer} onChange={(e) => setEmailAnswer(e.target.value)} placeholder="example@example.com" className="w-full sm:w-1/2 bg-gray-50 border border-gray-300 rounded-lg focus:border-red-500 px-3 py-2.5 sm:px-4 sm:py-3 outline-none text-xs sm:text-sm font-medium" />
            </div>
          )}

          {isFirstPage && survey.settings.collectRespondentInfo && !currentUser && (
            <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1.5 sm:mb-2 flex items-center"><User className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-blue-500" />お名前を入力してください <span className="text-red-500 ml-1">*</span></h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 mb-3 sm:mb-4">このフォームは記名式です。誰が回答したか管理者に通知されます。</p>
              <input type="text" required value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="氏名" className="w-full sm:w-1/2 bg-gray-50 border border-gray-300 rounded-lg focus:border-blue-500 px-3 py-2.5 sm:px-4 sm:py-3 outline-none text-xs sm:text-sm font-medium" />
            </div>
          )}

          {currentQuestions.map((q, index) => {
            if (q.type === "section") {
              return (
                <div key={q.id} className="bg-blue-600 text-white rounded-xl p-4 sm:p-8 shadow-md mt-6 sm:mt-10">
                  <h2 className="text-lg sm:text-2xl font-black">{q.title}</h2>
                  {q.description && <p className="text-xs sm:text-sm text-blue-100 mt-1.5 sm:mt-2 whitespace-pre-wrap">{q.description}</p>}
                </div>
              );
            }
            if (q.type === "description") {
              return (
                <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-8 shadow-sm">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">{q.title}</h3>
                  {q.description && <p className="text-xs sm:text-sm text-gray-600 mt-1.5 sm:mt-2 whitespace-pre-wrap">{q.description}</p>}
                </div>
              );
            }

            let globalIndex = 0;
            for (let p=0; p<currentPageIndex; p++) {
              globalIndex += pages[p].filter(x => x.type !== "section" && x.type !== "description").length;
            }
            const questionIndexInPage = currentQuestions.filter(x => x.type !== "section" && x.type !== "description").findIndex(x => x.id === q.id);
            globalIndex += (questionIndexInPage + 1);

            return (
              <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-8">
                <div className="mb-3 sm:mb-4">
                  <h3 className="text-sm sm:text-lg font-bold text-gray-900 flex items-start">
                    <span className="mr-1.5 sm:mr-2 leading-snug">
                      {survey.settings.showQuestionNumbers && `${globalIndex}. `}
                      {q.title}
                    </span>
                    {q.required && <span className="text-red-500 text-base sm:text-lg leading-none">*</span>}
                  </h3>
                  {q.description && <p className="text-[10px] sm:text-xs font-bold text-gray-500 mt-1 whitespace-pre-wrap">{q.description}</p>}
                  {survey.settings.isQuiz && survey.settings.showPointValues && (
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-400 bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded mt-1.5 sm:mt-2 inline-block">
                      {q.points || 0} 点
                    </span>
                  )}
                </div>
                {renderQuestionUI(q)}
              </div>
            );
          })}

          {isLastPage && (
            <div className={`rounded-xl shadow-sm border p-4 sm:p-6 mt-4 sm:mt-6 flex items-start ${isAnonymousView ? "bg-gray-50 border-gray-200" : "bg-blue-50 border-blue-200"}`}>
              <Info className={`h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 flex-shrink-0 ${isAnonymousView ? "text-gray-400" : "text-blue-500"}`} />
              <div>
                <h4 className={`text-xs sm:text-sm font-bold mb-1 ${isAnonymousView ? "text-gray-700" : "text-blue-900"}`}>
                  {isAnonymousView ? "このアンケートは匿名で記録されます" : "このアンケートは記名式です"}
                </h4>
                <p className={`text-[10px] sm:text-xs leading-relaxed font-bold ${isAnonymousView ? "text-gray-500" : "text-blue-700"}`}>
                  {isAnonymousView ? "誰が送信したかは記録されません。" : `あなたのアカウント情報が管理者に記録・表示されます。`}
                </p>
              </div>
            </div>
          )}

          {survey.settings.showProgressBar && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
              <div className="flex justify-between text-[10px] sm:text-xs font-bold text-gray-500 mb-1.5 sm:mb-2">
                <span>全体の進行状況</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                <div className="bg-purple-600 h-1.5 sm:h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mt-4 sm:mt-6 gap-3 sm:gap-4">
            
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {currentPageIndex > 0 && (
                <button type="button" onClick={handlePrevPage} className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm rounded-full transition-colors flex justify-center items-center">
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" /> 戻る
                </button>
              )}
              
              {!isLastPage ? (
                <button type="submit" className="w-full sm:w-auto px-6 sm:px-10 py-2.5 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-full transition-colors flex justify-center items-center shadow-md">
                  次へ <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1" />
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-6 sm:px-10 py-2.5 sm:py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs sm:text-sm rounded-full transition-colors flex justify-center items-center shadow-md disabled:opacity-70">
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" /> : <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />} 
                  {existingResponse ? "更新する" : "送信する"}
                </button>
              )}
            </div>
            
            {isLastPage && (
              <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 text-center sm:text-right leading-relaxed mt-1 sm:mt-0">
                回答内容は管理者にのみ送信されます。<br className="hidden sm:block" />
                {existingResponse ? "この回答は既に送信されており、現在は編集モードです。" : survey.settings.allowEditResponse ? "送信後も回答の編集が可能です。" : "送信後は内容の変更ができません。"}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}