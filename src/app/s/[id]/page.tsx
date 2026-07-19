// src/app/s/[id]/page.tsx (新しく作成するサーバー用ファイル)
import ClientPage from './ClientPage';

export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <ClientPage />;
}