// src/lib/email-template.ts

export type EmailTheme = "primary" | "danger" | "success" | "warning" | "neutral";

export interface EmailTemplateProps {
  title: string;              // メールのタイトル (大見出し)
  greeting?: string;          // 宛名 (例: 〇〇 様)
  leadText?: string;          // 導入文
  bodyText?: string;          // 本文 (改行を自動で<br>に変換)
  bodyHtml?: string;          // 本文 (自由なHTMLを流し込む場合)
  details?: {                 // リスト形式の詳細情報
    label: string;
    value: string;
  }[];
  detailBox?: string;         // 背景色付きの枠で囲む詳細テキスト
  actionButton?: {            // アクションボタン
    label: string;
    url: string;
  };
  footerNotes?: string[];     // 注意書き (例: このメールは送信専用です など)
  theme?: EmailTheme;         // テーマカラー (省略時は primary)
}

const THEME_COLORS: Record<EmailTheme, { main: string; light: string; border: string }> = {
  primary: { main: "#2563eb", light: "#eff6ff", border: "#bfdbfe" }, // 青
  danger:  { main: "#dc2626", light: "#fef2f2", border: "#fecaca" }, // 赤（緊急・警告）
  success: { main: "#059669", light: "#ecfdf5", border: "#a7f3d0" }, // 緑（成功・完了）
  warning: { main: "#d97706", light: "#fffbeb", border: "#fde68a" }, // オレンジ（注意）
  neutral: { main: "#4b5563", light: "#f9fafb", border: "#e5e7eb" }, // グレー（汎用）
};

/**
 * 汎用HTMLメールテンプレートを生成する関数
 */
export function buildHtmlEmail(props: EmailTemplateProps): string {
  const {
    title,
    greeting,
    leadText,
    bodyText,
    bodyHtml,
    details,
    detailBox,
    actionButton,
    footerNotes,
    theme = "primary",
  } = props;

  const colors = THEME_COLORS[theme];

  // 改行を <br> に変換するヘルパー
  const nl2br = (text: string) => text.replace(/\n/g, "<br/>");

  // 要素の構築
  const greetingHtml = greeting 
    ? `<p style="color: #374151; font-size: 15px; font-weight: bold; margin-bottom: 20px;">${greeting}</p>` 
    : "";

  const leadHtml = leadText 
    ? `<p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">${nl2br(leadText)}</p>` 
    : "";

  const textHtml = bodyText 
    ? `<p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">${nl2br(bodyText)}</p>` 
    : "";

  const customHtml = bodyHtml 
    ? `<div style="margin-bottom: 20px; font-size: 14px; line-height: 1.6; color: #4b5563;">${bodyHtml}</div>` 
    : "";

  let detailsListHtml = "";
  if (details && details.length > 0) {
    detailsListHtml = `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">`;
    details.forEach(item => {
      detailsListHtml += `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 30%; font-weight: bold; vertical-align: top;">${item.label}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #111827; vertical-align: top;">${nl2br(item.value)}</td>
        </tr>
      `;
    });
    detailsListHtml += `</table>`;
  }

  const detailBoxHtml = detailBox 
    ? `<div style="background-color: ${colors.light}; border: 1px solid ${colors.border}; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
         <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #374151;">${nl2br(detailBox)}</p>
       </div>` 
    : "";

  const buttonHtml = actionButton 
    ? `<div style="text-align: center; margin: 32px 0;">
         <a href="${actionButton.url}" style="background-color: ${colors.main}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
           ${actionButton.label}
         </a>
       </div>` 
    : "";

  let notesHtml = "";
  if (footerNotes && footerNotes.length > 0) {
    notesHtml = `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">`;
    footerNotes.forEach(note => {
      notesHtml += `<p style="font-size: 12px; color: #6b7280; margin: 0 0 6px 0;">※ ${note}</p>`;
    });
    notesHtml += `</div>`;
  }

  // HTML全体の組み上げ (主要メーラー対応の安全なテーブルベースレイアウト)
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              
              <!-- ヘッダーカラーバー -->
              <tr>
                <td style="height: 6px; background-color: ${colors.main};"></td>
              </tr>
              
              <!-- メインコンテンツ -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: ${colors.main}; font-size: 20px; font-weight: 800; margin: 0 0 24px 0; border-bottom: 2px solid ${colors.light}; padding-bottom: 12px;">
                    ${title}
                  </h2>
                  
                  ${greetingHtml}
                  ${leadHtml}
                  ${textHtml}
                  ${customHtml}
                  ${detailsListHtml}
                  ${detailBoxHtml}
                  ${buttonHtml}
                  ${notesHtml}
                  
                </td>
              </tr>
              
              <!-- フッター -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af; font-weight: bold;">
                    生徒会ポータルシステム SCPS
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 11px; color: #9ca3af;">
                    &copy; ${new Date().getFullYear()} YORIKURU
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}