'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Timer as StopwatchIcon, 
  Hourglass, 
  Bell, 
  Maximize, 
  Minimize, 
  Play, 
  Pause, 
  Square, 
  Flag, 
  Trash2, 
  Plus, 
  Users, 
  User, 
  RotateCcw,
  Volume2,
  X,
  Edit2,
  Presentation,
  Monitor,
  CircleDashed,
  Type
} from 'lucide-react';

// --- 型定義 ---
type Tab = 'clock' | 'stopwatch' | 'timer' | 'alarm';
type Scope = 'personal' | 'shared';
type TimerViewMode = 'digital' | 'circular';

interface Alarm {
  id: string;
  time: string; // "HH:MM" 形式
  label: string;
  scope: Scope;
  isActive: boolean;
  userId: string;
  tenantId: string;
}

interface TimerPreset {
  id: string;
  label: string;
  totalSeconds: number; // 合計秒数
  scope: Scope;
  userId: string;
  tenantId: string;
}

interface NotificationState {
  show: boolean;
  title: string;
  message: string;
  type: 'alarm' | 'timer';
}

export default function ClockPage() {
  // --- 仮定義データ ---
  const currentUser = { id: 'user_01', name: '生徒会役員' };
  const currentTenantId = 'tenant_school_a';

  // --- 共通ステート ---
  const [activeTab, setActiveTab] = useState<Tab>('clock');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false); // ★プレゼンモード
  const appRef = useRef<HTMLDivElement>(null);

  // 通知・音声用
  const [notification, setNotification] = useState<NotificationState>({ show: false, title: '', message: '', type: 'timer' });
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastTriggeredTimeRef = useRef<string>('');

  const triggerNotification = (title: string, message: string, type: 'alarm' | 'timer') => {
    setNotification({ show: true, title, message, type });
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.loop = true;
      audioRef.current.play().catch(console.warn);
    }
  };

  const dismissNotification = () => {
    setNotification(prev => ({ ...prev, show: false }));
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // --- 1. 時計用 ---
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- 2. ストップウォッチ用 ---
  const [isSwRunning, setIsSwRunning] = useState(false);
  const [swTime, setSwTime] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const swTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- 3. タイマー用 ---
  const [timerPresets, setTimerPresets] = useState<TimerPreset[]>([]);
  const [timerTimeLeft, setTimerTimeLeft] = useState<number>(300);
  const [timerInitialTime, setTimerInitialTime] = useState<number>(300);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [activeTimerLabel, setActiveTimerLabel] = useState('5分タイマー');
  const [timerViewMode, setTimerViewMode] = useState<TimerViewMode>('digital'); // ★円形切替
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // タイマーフォーム用
  const [editingTimerId, setEditingTimerId] = useState<string | null>(null); // ★編集用ID
  const [newTimerMinutes, setNewTimerMinutes] = useState('5');
  const [newTimerSeconds, setNewTimerSeconds] = useState('0');
  const [newTimerLabel, setNewTimerLabel] = useState('');
  const [newTimerScope, setNewTimerScope] = useState<Scope>('personal');

  // --- 4. アラーム用 ---
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null); // ★編集用ID
  const [newAlarmTime, setNewAlarmTime] = useState('');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');
  const [newAlarmScope, setNewAlarmScope] = useState<Scope>('personal');

  // --- 初期化 ---
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // 仮データロード
    setTimerPresets([
      { id: 'tp1', label: 'スピーチ制限（3分）', totalSeconds: 180, scope: 'shared', userId: 'u1', tenantId: currentTenantId },
      { id: 'tp2', label: '役員会 休憩（10分）', totalSeconds: 600, scope: 'personal', userId: currentUser.id, tenantId: currentTenantId }
    ]);
    setAlarms([
      { id: 'a1', time: '17:00', label: '完全下校時間', scope: 'shared', isActive: true, userId: 'u1', tenantId: currentTenantId },
      { id: 'a2', time: '15:30', label: '定例会議終了', scope: 'personal', isActive: false, userId: currentUser.id, tenantId: currentTenantId }
    ]);

    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [currentTenantId, currentUser.id]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- ストップウォッチ処理 ---
  const handleSwStartStop = () => {
    if (isSwRunning) {
      if (swTimerRef.current) clearInterval(swTimerRef.current);
    } else {
      const startTime = Date.now() - swTime;
      swTimerRef.current = setInterval(() => setSwTime(Date.now() - startTime), 10);
    }
    setIsSwRunning(!isSwRunning);
  };
  const handleSwReset = () => {
    if (swTimerRef.current) clearInterval(swTimerRef.current);
    setIsSwRunning(false); setSwTime(0); setLaps([]);
  };
  const handleSwLap = () => setLaps((prev) => [swTime, ...prev]);

  const formatTimeMs = (ms: number) => {
    const m = Math.floor(ms / 60000).toString().padStart(2, '0');
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${m}:${s}.${cs}`;
  };

  // --- タイマー処理 ---
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            setIsTimerRunning(false);
            triggerNotification('タイマー終了', `「${activeTimerLabel}」の時間になりました！`, 'timer');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current!);
  }, [isTimerRunning, activeTimerLabel]);

  const handleTimerStartStop = () => timerTimeLeft > 0 && setIsTimerRunning(!isTimerRunning);
  const handleTimerReset = () => { setIsTimerRunning(false); setTimerTimeLeft(timerInitialTime); };
  const selectTimerPreset = (preset: TimerPreset) => {
    setIsTimerRunning(false);
    setTimerInitialTime(preset.totalSeconds);
    setTimerTimeLeft(preset.totalSeconds);
    setActiveTimerLabel(preset.label);
  };

  // ★タイマー保存（新規・編集共通）
  const saveTimerPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const totalSecs = (parseInt(newTimerMinutes) || 0) * 60 + (parseInt(newTimerSeconds) || 0);
    if (totalSecs <= 0) return;

    if (editingTimerId) {
      setTimerPresets(timerPresets.map(p => p.id === editingTimerId ? {
        ...p, label: newTimerLabel || '無題タイマー', totalSeconds: totalSecs, scope: newTimerScope
      } : p));
      setEditingTimerId(null);
    } else {
      const newPreset: TimerPreset = {
        id: Date.now().toString(),
        label: newTimerLabel || `${newTimerMinutes}分タイマー`,
        totalSeconds: totalSecs, scope: newTimerScope, userId: currentUser.id, tenantId: currentTenantId
      };
      setTimerPresets([...timerPresets, newPreset]);
    }
    resetTimerForm();
  };

  const editTimer = (preset: TimerPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTimerId(preset.id);
    setNewTimerMinutes(Math.floor(preset.totalSeconds / 60).toString());
    setNewTimerSeconds((preset.totalSeconds % 60).toString());
    setNewTimerLabel(preset.label);
    setNewTimerScope(preset.scope);
  };

  const deleteTimerPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); setTimerPresets(timerPresets.filter(p => p.id !== id));
  };

  const resetTimerForm = () => {
    setEditingTimerId(null); setNewTimerMinutes('5'); setNewTimerSeconds('0'); setNewTimerLabel(''); setNewTimerScope('personal');
  };

  const formatTimerDisplay = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- アラーム処理 ---
  useEffect(() => {
    const hhmm = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sec = currentTime.getSeconds();
    alarms.forEach(alarm => {
      if (alarm.isActive && alarm.time === hhmm && sec === 0) {
        const key = `${alarm.id}-${hhmm}`;
        if (lastTriggeredTimeRef.current !== key) {
          lastTriggeredTimeRef.current = key;
          triggerNotification('アラーム', `「${alarm.label}」の時間です`, 'alarm');
        }
      }
    });
  }, [currentTime, alarms]);

  // ★アラーム保存（新規・編集共通）
  const saveAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlarmTime) return;

    if (editingAlarmId) {
      setAlarms(alarms.map(a => a.id === editingAlarmId ? {
        ...a, time: newAlarmTime, label: newAlarmLabel || '無題のアラーム', scope: newAlarmScope
      } : a));
      setEditingAlarmId(null);
    } else {
      const newAlarm: Alarm = {
        id: Date.now().toString(),
        time: newAlarmTime, label: newAlarmLabel || '無題のアラーム',
        scope: newAlarmScope, isActive: true, userId: currentUser.id, tenantId: currentTenantId
      };
      setAlarms([...alarms, newAlarm]);
    }
    resetAlarmForm();
  };

  const editAlarm = (alarm: Alarm) => {
    setEditingAlarmId(alarm.id);
    setNewAlarmTime(alarm.time);
    setNewAlarmLabel(alarm.label);
    setNewAlarmScope(alarm.scope);
  };

  const toggleAlarmActive = (id: string, status: boolean) => setAlarms(alarms.map(a => a.id === id ? { ...a, isActive: !status } : a));
  const deleteAlarm = (id: string) => setAlarms(alarms.filter(a => a.id !== id));
  const resetAlarmForm = () => { setEditingAlarmId(null); setNewAlarmTime(''); setNewAlarmLabel(''); setNewTimerScope('personal'); };


  // --- フルスクリーン制御 ---
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) appRef.current?.requestFullscreen().catch(console.error);
    else document.exitFullscreen();
  };


  // --- UI レンダー用 ---
  const MainPanelWidth = isPresentationMode ? "w-full" : "lg:w-[55%]";
  const SettingsPanelWidth = "lg:w-[45%]";
  const nextActiveAlarm = alarms.filter(a => a.isActive).sort((a, b) => a.time.localeCompare(b.time))[0];

  return (
    <div className="p-4 md:p-6 w-full flex justify-center items-center min-h-[calc(100vh-80px)] relative">
      <audio ref={audioRef} src="/alarm.mp3" preload="auto" />

      {/* 通知モーダル */}
      {notification.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-slate-800 border-2 border-blue-500 rounded-2xl shadow-[0_0_40px_rgba(59,130,246,0.5)] p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center animate-pulse-slow">
            <div className={`p-4 rounded-full mb-4 ${notification.type === 'alarm' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {notification.type === 'alarm' ? <Bell size={48} /> : <Hourglass size={48} />}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{notification.title}</h2>
            <p className="text-slate-300 text-lg mb-8">{notification.message}</p>
            <button onClick={dismissNotification} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center text-lg">
              <X size={24} className="mr-2" />確認して音を止める
            </button>
          </div>
        </div>
      )}

      <div ref={appRef} className={`flex flex-col bg-slate-900 text-white font-sans ${isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen rounded-none' : 'w-full max-w-5xl h-[700px] rounded-2xl shadow-2xl border border-slate-800'} overflow-hidden transition-all duration-300`}>
        
        {/* ヘッダー */}
        <div className="flex items-center justify-between bg-slate-800/80 backdrop-blur-md p-4 border-b border-slate-700/50">
          <div className="flex space-x-1 md:space-x-2">
            {[
              { id: 'clock', icon: Clock, label: '時計' },
              { id: 'stopwatch', icon: StopwatchIcon, label: '計測' },
              { id: 'timer', icon: Hourglass, label: 'タイマー' },
              { id: 'alarm', icon: Bell, label: 'アラーム' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={`flex items-center px-3 md:px-4 py-2 rounded-xl font-medium text-xs md:text-sm transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}>
                <tab.icon size={16} className="mr-1.5" /> <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={() => {if(audioRef.current){audioRef.current.loop=false;audioRef.current.play()}}} className="p-2 bg-slate-700/40 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors" title="サウンドテスト">
              <Volume2 size={18} />
            </button>
            <button onClick={() => setIsPresentationMode(!isPresentationMode)} className={`p-2 rounded-xl transition-colors ${isPresentationMode ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700'}`} title="プレゼンモード（設定非表示）">
              {isPresentationMode ? <Presentation size={18} /> : <Monitor size={18} />}
            </button>
            <button onClick={toggleFullscreen} className="p-2 bg-slate-700/60 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>

        {/* メインコンテンツエリア */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-y-auto">
          
          {/* --- タブ 1: 時計 --- */}
          {activeTab === 'clock' && (
            <div className="flex flex-col items-center justify-center w-full h-full">
              <div className={`font-mono font-bold tracking-wider ${isFullscreen ? 'text-[16vw]' : 'text-7xl md:text-9xl'} text-white drop-shadow-[0_0_20px_rgba(59,130,246,0.3)] select-none`}>
                {currentTime.toLocaleTimeString('ja-JP', { hour12: false })}
              </div>
              <div className={`mt-6 text-slate-400 font-medium ${isFullscreen ? 'text-[3.5vw]' : 'text-xl md:text-2xl'}`}>
                {currentTime.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              </div>
            </div>
          )}

          {/* --- タブ 2: ストップウォッチ --- */}
          {activeTab === 'stopwatch' && (
            <div className="flex flex-col items-center w-full max-w-2xl h-full justify-between py-4">
              <div className={`font-mono font-bold tracking-tight ${isFullscreen ? 'text-[12vw]' : 'text-7xl md:text-8xl'} text-blue-400 my-4 select-none`}>{formatTimeMs(swTime)}</div>
              <div className="flex space-x-6 my-4">
                <button onClick={handleSwStartStop} className={`flex items-center justify-center w-20 h-20 rounded-full text-white shadow-xl transition-all hover:scale-105 active:scale-95 ${isSwRunning ? 'bg-red-500/20 text-red-400 border-red-500' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500'} border-2`}>
                  {isSwRunning ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                </button>
                <button onClick={isSwRunning ? handleSwLap : handleSwReset} className="flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-600 text-slate-300 shadow-xl hover:bg-slate-700 transition-all hover:scale-105">
                  {isSwRunning ? <Flag size={28} /> : <Square size={28} />}
                </button>
              </div>
              {!isPresentationMode && (
                <div className="w-full flex-1 overflow-y-auto border-t border-slate-800 pt-4 px-2 max-h-[200px]">
                  {laps.length === 0 ? <div className="text-center text-slate-600 py-8 text-sm">ラップタイムがここに記録されます</div> : laps.map((lt, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-800/60 text-slate-300">
                      <span className="text-slate-500 text-sm font-medium">ラップ {laps.length - i}</span>
                      <span className="font-mono text-lg">{formatTimeMs(lt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- タブ 3: タイマー --- */}
          {activeTab === 'timer' && (
            <div className="w-full h-full flex flex-col lg:flex-row gap-6 transition-all duration-500">
              {/* メインディスプレイ */}
              <div className={`${MainPanelWidth} flex flex-col items-center justify-center bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 transition-all relative`}>
                
                {/* 円形・デジタル切替ボタン */}
                <div className="absolute top-4 right-4 flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                  <button onClick={() => setTimerViewMode('digital')} className={`p-1.5 rounded-md transition-colors ${timerViewMode === 'digital' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-white'}`}><Type size={16}/></button>
                  <button onClick={() => setTimerViewMode('circular')} className={`p-1.5 rounded-md transition-colors ${timerViewMode === 'circular' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-white'}`}><CircleDashed size={16}/></button>
                </div>

                <div className="text-slate-400 text-lg font-medium mb-4">{activeTimerLabel}</div>
                
                {/* タイム表示（デジタル or サークル） */}
                {timerViewMode === 'circular' ? (
                  <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center my-4">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                      <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="8" fill="transparent"
                        strokeDasharray="283%" /* 2 * pi * 45 = 282.7 */
                        strokeDashoffset={`${283 - (timerTimeLeft / timerInitialTime) * 283}%`}
                        className={`transition-all duration-1000 ease-linear ${timerTimeLeft < 60 ? 'text-red-500' : 'text-amber-500'}`} />
                    </svg>
                    <div className="font-mono font-bold text-5xl md:text-6xl text-white select-none">{formatTimerDisplay(timerTimeLeft)}</div>
                  </div>
                ) : (
                  <div className={`font-mono font-bold tracking-tight ${isFullscreen ? 'text-[16vw]' : 'text-8xl md:text-9xl'} ${timerTimeLeft < 60 && timerTimeLeft > 0 ? 'text-red-400' : 'text-amber-400'} my-4 select-none`}>
                    {formatTimerDisplay(timerTimeLeft)}
                  </div>
                )}

                {/* コントロール */}
                <div className="flex space-x-6 mt-6">
                  <button onClick={handleTimerStartStop} className={`flex items-center justify-center w-20 h-20 rounded-full text-white shadow-xl transition-all hover:scale-105 active:scale-95 ${isTimerRunning ? 'bg-amber-500/20 text-amber-400 border-amber-500' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500'} border-2`}>
                    {isTimerRunning ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                  </button>
                  <button onClick={handleTimerReset} className="flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-600 text-slate-300 shadow-xl hover:bg-slate-700 transition-all hover:scale-105" title="リセット">
                    <RotateCcw size={28} />
                  </button>
                </div>
              </div>

              {/* 設定・リストサイドバー (プレゼンモード時は非表示) */}
              {!isPresentationMode && (
                <div className={`${SettingsPanelWidth} flex flex-col gap-4 overflow-y-auto pr-1`}>
                  {/* フォーム */}
                  <div className={`p-4 rounded-2xl border ${editingTimerId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-800/50 border-slate-700/60'}`}>
                    <h3 className="text-sm font-bold mb-3 flex items-center text-white">
                      {editingTimerId ? <><Edit2 size={16} className="mr-1.5 text-blue-400"/>タイマー編集</> : <><Plus size={16} className="mr-1.5 text-amber-400"/>タイマー追加</>}
                    </h3>
                    <form onSubmit={saveTimerPreset} className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">分</label>
                          <input type="number" min="0" max="180" value={newTimerMinutes} onChange={(e) => setNewTimerMinutes(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-center font-mono text-sm focus:border-amber-500" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">秒</label>
                          <input type="number" min="0" max="59" value={newTimerSeconds} onChange={(e) => setNewTimerSeconds(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-center font-mono text-sm focus:border-amber-500" />
                        </div>
                      </div>
                      <input type="text" value={newTimerLabel} onChange={(e) => setNewTimerLabel(e.target.value)} placeholder="ラベル（例：スピーチ3分）" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:border-amber-500" />
                      <div className="flex gap-2">
                        <button type="submit" className={`flex-1 ${editingTimerId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-amber-600 hover:bg-amber-500'} text-white font-bold py-2 rounded-lg transition-all text-xs`}>
                          {editingTimerId ? '更新する' : '保存する'}
                        </button>
                        {editingTimerId && (
                          <button type="button" onClick={resetTimerForm} className="px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs transition-colors">キャンセル</button>
                        )}
                      </div>
                    </form>
                  </div>
                  {/* リスト */}
                  <div className="space-y-2">
                    <div className="text-xs text-slate-400 font-medium px-1">登録済みタイマー</div>
                    {timerPresets.map(preset => (
                      <div key={preset.id} onClick={() => selectTimerPreset(preset)} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 cursor-pointer transition-all group">
                        <div>
                          <div className="text-xs font-medium text-slate-200">{preset.label}</div>
                          <div className="text-lg font-mono text-amber-400 font-bold">{formatTimerDisplay(preset.totalSeconds)}</div>
                        </div>
                        <div className="flex opacity-50 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => editTimer(preset, e)} className="text-slate-400 hover:text-blue-400 p-1.5 rounded-lg"><Edit2 size={16} /></button>
                          <button onClick={(e) => deleteTimerPreset(preset.id, e)} className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- タブ 4: アラーム --- */}
          {activeTab === 'alarm' && (
            <div className="w-full h-full flex flex-col lg:flex-row gap-6 transition-all duration-500">
              
              {/* メインディスプレイ（タイマーUIに合わせる） */}
              <div className={`${MainPanelWidth} flex flex-col items-center justify-center bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 transition-all`}>
                <Clock size={48} className="text-slate-600 mb-6 opacity-50"/>
                <div className="text-slate-400 text-lg font-medium mb-2">現在時刻</div>
                <div className={`font-mono font-bold tracking-tight ${isFullscreen ? 'text-[12vw]' : 'text-6xl md:text-8xl'} text-white my-2 select-none`}>
                  {currentTime.toLocaleTimeString('ja-JP', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                </div>
                
                {/* 次のアラーム表示 */}
                <div className="mt-10 w-full max-w-sm">
                  <div className="text-slate-500 text-sm font-medium mb-3 text-center">次に鳴るアラーム</div>
                  {nextActiveAlarm ? (
                    <div className="bg-slate-800/80 border border-blue-500/50 rounded-xl p-4 flex items-center justify-between shadow-lg shadow-blue-900/20">
                      <div>
                        <div className="text-blue-400 text-xs font-bold mb-1">{nextActiveAlarm.label}</div>
                        <div className="text-3xl font-mono text-white">{nextActiveAlarm.time}</div>
                      </div>
                      <Bell className="text-blue-500/50" size={32}/>
                    </div>
                  ) : (
                    <div className="text-center text-slate-600 py-4 bg-slate-800/30 rounded-xl border border-slate-800">
                      有効なアラームはありません
                    </div>
                  )}
                </div>
              </div>

              {/* 設定・リストサイドバー (プレゼンモード時は非表示) */}
              {!isPresentationMode && (
                <div className={`${SettingsPanelWidth} flex flex-col gap-4 overflow-y-auto pr-1`}>
                  {/* フォーム */}
                  <div className={`p-4 rounded-2xl border ${editingAlarmId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-800/50 border-slate-700/60'}`}>
                    <h3 className="text-sm font-bold mb-3 flex items-center text-white">
                      {editingAlarmId ? <><Edit2 size={16} className="mr-1.5 text-blue-400"/>アラーム編集</> : <><Plus size={16} className="mr-1.5 text-blue-400"/>アラーム追加</>}
                    </h3>
                    <form onSubmit={saveAlarm} className="space-y-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">設定時刻</label>
                        <input type="time" value={newAlarmTime} onChange={(e) => setNewAlarmTime(e.target.value)} required className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-lg focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">アラーム名</label>
                        <input type="text" value={newAlarmLabel} onChange={(e) => setNewAlarmLabel(e.target.value)} placeholder="例：完全下校リマインド" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:border-blue-500" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="submit" className={`flex-1 ${editingAlarmId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold py-2 rounded-lg transition-all text-xs`}>
                          {editingAlarmId ? '更新する' : '保存する'}
                        </button>
                        {editingAlarmId && (
                          <button type="button" onClick={resetAlarmForm} className="px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs transition-colors">キャンセル</button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* リスト */}
                  <div className="space-y-2">
                    <div className="text-xs text-slate-400 font-medium px-1">登録済みアラーム</div>
                    {alarms.map(alarm => (
                      <div key={alarm.id} className={`flex items-center justify-between p-3 rounded-xl border-l-4 shadow-md transition-all group ${alarm.isActive ? 'bg-slate-800/80 border-blue-500' : 'bg-slate-800/30 opacity-60 border-slate-700'}`}>
                        <div className="flex-1 cursor-pointer" onClick={() => toggleAlarmActive(alarm.id, alarm.isActive)}>
                          <div className="text-xs font-medium text-slate-300">{alarm.label}</div>
                          <div className="font-mono text-2xl text-white mt-0.5">{alarm.time}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => toggleAlarmActive(alarm.id, alarm.isActive)} className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${alarm.isActive ? 'bg-blue-600' : 'bg-slate-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full transform transition-transform ${alarm.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                          <div className="flex opacity-50 group-hover:opacity-100 transition-opacity flex-col gap-1">
                            <button onClick={() => editAlarm(alarm)} className="text-slate-400 hover:text-blue-400 p-1 rounded"><Edit2 size={14} /></button>
                            <button onClick={() => deleteAlarm(alarm.id)} className="text-slate-400 hover:text-red-400 p-1 rounded"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `@keyframes pulse-slow { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } } .animate-pulse-slow { animation: pulse-slow 2s infinite ease-in-out; }`}} />
    </div>
  );
}