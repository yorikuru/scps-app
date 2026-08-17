import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("t");

  if (!path || path.length === 0) {
    return new NextResponse("Invalid Path", { status: 400 });
  }

  const filePath = path.join("/");
  const encodedPath = encodeURIComponent(filePath);

  const bucketName = "scps-portal.firebasestorage.app";
  let firebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;
  if (token) {
    firebaseUrl += `&token=${token}`;
  }

  try {
    const response = await fetch(firebaseUrl);

    if (!response.ok) {
      const errorHtml = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ファイルが見つかりません</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f3f4f6; margin: 0; }
            .container { text-align: center; background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); max-w: 400px; width: 90%; border: 1px solid #e5e7eb; }
            .icon { font-size: 52px; margin-bottom: 20px; line-height: 1; }
            h1 { color: #111827; font-size: 20px; margin-bottom: 12px; font-weight: 900; letter-spacing: -0.5px; }
            p { color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 28px; font-weight: bold; }
            button { background-color: #4f46e5; color: white; border: none; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 900; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3); }
            button:hover { background-color: #4338ca; transform: translateY(-1px); }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>ファイルを表示できません</h1>
            <p>指定されたファイルは既に削除されているか、<br>アクセスする権限がありません。</p>
            <button onclick="window.close()">このタブを閉じる</button>
          </div>
        </body>
        </html>
      `;
      return new NextResponse(errorHtml, {
        status: response.status,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}