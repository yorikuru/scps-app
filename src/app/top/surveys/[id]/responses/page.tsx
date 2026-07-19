import ClientPage from './ClientPage';

export function generateStaticParams() {
  // Next.jsを納得させるためのダミーIDを1つだけ渡す
  return [{ id: 'dummy' }];
}

export default function Page() {
  return <ClientPage />;
}