import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch("https://www.jma.go.jp/bosai/quake/data/list.json", {
      next: { revalidate: 60 } 
    });

    if (!response.ok) {
      throw new Error(`JMA API Error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Disaster Proxy Error:", error);
    return NextResponse.json({ error: '地震情報の取得に失敗しました' }, { status: 500 });
  }
}