"use client";

import React from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  LayoutDashboard, 
  MessageSquare, 
  FileText, 
  CheckSquare,
  Shield,
  Zap,
  Users,
  Smartphone,
  ChevronRight
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-gray-900 selection:bg-blue-100 selection:text-blue-900">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <img 
                src="/icon.png" 
                alt="SCPS Icon" 
                className="h-8 w-8 object-cover rounded-full border border-gray-200"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <span className="font-extrabold text-xl tracking-tight text-gray-900">
                SCPS
              </span>
            </div>
            
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">機能</a>
              <a href="#benefits" className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">メリット</a>
              <a href="#security" className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors">セキュリティ</a>
            </nav>

            <div className="flex items-center gap-4">
              <Link 
                href="/login" 
                className="inline-flex items-center justify-center px-5 py-2 border border-transparent text-sm font-bold rounded-full text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all hover:shadow-md"
              >
                ログイン
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden bg-gradient-to-b from-blue-50/50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-6 border border-blue-200">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2 animate-pulse"></span>
              次世代の生徒会活動プラットフォーム
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6 leading-tight">
              生徒会活動を、<br className="md:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                もっとスマートに。
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-gray-600 mx-auto mb-10 leading-relaxed font-medium">
              SCPS（Student Council Portal System）は、役員間の連携から全校生徒への情報発信までをワンストップでサポート。ペーパーレス化と業務効率化を実現し、新しい生徒会活動の形を創造します。
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link 
                href="/login" 
                className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-base font-bold rounded-full text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:scale-105"
              >
                システムにログイン
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <a 
                href="#features" 
                className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-gray-200 text-base font-bold rounded-full text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                機能を見る
              </a>
            </div>
          </div>
          
          {/* 装飾用背景グラデーション */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-blue-100 to-cyan-50 rounded-full blur-3xl opacity-50 -z-10 pointer-events-none"></div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">あらゆる活動をデジタルで完結</h2>
              <p className="mt-4 text-gray-500 font-medium max-w-2xl mx-auto">
                煩雑な紙のやり取りや情報共有の遅れを解消し、より創造的な活動に時間を注ぐための機能が揃っています。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Feature 1 */}
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                  <LayoutDashboard className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">お知らせボード</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  全校生徒への連絡や、役員内での共有事項をリアルタイムに発信。既読状況の確認も可能です。
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-6">
                  <CheckSquare className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">タスク・プロジェクト</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  文化祭や体育祭などの大規模行事から日常業務まで、進捗状況を可視化しチームで共有します。
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">電子承認・稟議</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  企画書や予算案の申請から承認までをペーパーレス化。どこからでもスピーディに決裁が完了します。
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-6">
                  <MessageSquare className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">アンケート・目安箱</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  生徒の声を簡単に集約。集計は自動で行われ、グラフ化されるため現状分析がスムーズになります。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="py-24 bg-gray-900 text-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight mb-6">
                  次世代リーダーのための<br />強固なインフラストラクチャ
                </h2>
                <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                  学校ごとの独立したテナント環境により、安全かつ柔軟な運用を実現。スマートフォンのLINE連携にも対応し、現代の生徒に最適な体験を提供します。
                </p>
                <ul className="space-y-6">
                  <li className="flex items-start">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700">
                      <Zap className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-4">
                      <h4 className="text-base font-bold">圧倒的な効率化</h4>
                      <p className="mt-1 text-sm text-gray-400">ルーチンワークを自動化し、企画や議論など、本来の「生徒会らしい」活動に集中できます。</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700">
                      <Users className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="ml-4">
                      <h4 className="text-base font-bold">確実な引き継ぎ</h4>
                      <p className="mt-1 text-sm text-gray-400">すべての活動履歴がクラウドに蓄積されるため、次年度への引き継ぎがシームレスに行われます。</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700">
                      <Smartphone className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="ml-4">
                      <h4 className="text-base font-bold">マルチデバイス＆LINE連携</h4>
                      <p className="mt-1 text-sm text-gray-400">スマホ、タブレット、PCに完全対応。使い慣れたLINEからの通知受け取りや操作も可能です。</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="relative">
                <div className="aspect-w-5 aspect-h-4 bg-gradient-to-tr from-gray-800 to-gray-700 rounded-2xl border border-gray-600 shadow-2xl overflow-hidden flex items-center justify-center relative">
                  {/* ダミーのUIモックアップ */}
                  <div className="w-full h-full p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="flex-1 bg-gray-900 rounded-xl border border-gray-700 p-4 flex flex-col gap-4">
                      <div className="h-8 bg-gray-800 rounded w-1/3"></div>
                      <div className="flex gap-4">
                        <div className="w-1/4 h-24 bg-blue-900/30 border border-blue-800/50 rounded-lg"></div>
                        <div className="w-1/4 h-24 bg-emerald-900/30 border border-emerald-800/50 rounded-lg"></div>
                        <div className="w-1/4 h-24 bg-purple-900/30 border border-purple-800/50 rounded-lg"></div>
                        <div className="w-1/4 h-24 bg-amber-900/30 border border-amber-800/50 rounded-lg"></div>
                      </div>
                      <div className="flex-1 bg-gray-800 rounded-lg mt-2"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-blue-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-extrabold text-white mb-6 tracking-tight">
              SCPSで、学校をアップグレードしよう。
            </h2>
            <p className="text-blue-100 text-lg mb-10 font-medium">
              すでにアカウントをお持ちの場合は、今すぐポータルにアクセスして活動を始めましょう。
            </p>
            <Link 
              href="/login" 
              className="inline-flex items-center justify-center px-8 py-4 text-base font-bold rounded-full text-blue-600 bg-white hover:bg-gray-50 shadow-lg transition-transform hover:scale-105"
            >
              ログインページへ
              <ChevronRight className="ml-2 h-5 w-5 text-blue-500" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <img 
              src="/icon.png" 
              alt="SCPS Icon" 
              className="h-6 w-6 object-cover rounded-full grayscale opacity-60"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="text-gray-500 font-bold tracking-wider text-sm">SCPS</span>
          </div>
          
          <div className="flex space-x-6 text-sm font-medium text-gray-500">
            <a href="#" className="hover:text-gray-900 transition-colors">利用規約</a>
            <a href="#" className="hover:text-gray-900 transition-colors">プライバシーポリシー</a>
            <a href="#" className="hover:text-gray-900 transition-colors">サポート</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 text-center md:text-left text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Student Council Portal System. All rights reserved.
        </div>
      </footer>
    </div>
  );
}