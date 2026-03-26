# Solo Nutrition ⬡

一個基於 AI (Gemini) 的智能飲食追蹤 Web App，專為香港用戶設計。

## ✨ 功能亮點

*   **智能分析**：使用 Gemini 3 Flash 模型，從文字或圖片中自動估算卡路里、蛋白質、碳水等營養數據。
*   **本地化**：針對香港飲食習慣優化（識別叉燒飯、凍檸茶等），並使用香港時區。
*   **數據可視化**：每週營養攝取趨勢圖表與健康建議。
*   **雙模式**：
    *   **Demo Mode**: 即使沒有 Firebase Key 也能立即體驗（使用 LocalStorage）。
    *   **Production Mode**: 設定環境變數後自動切換至 Firebase (Auth/Firestore/Storage)。

## 🚀 快速開始 (Development)

本專案使用 React + Tailwind + TypeScript。

### 1. 安裝依賴

```bash
npm install
# 必需依賴：
# react, react-dom, react-router-dom
# firebase, @google/genai, recharts, lucide-react
# typescript, @types/node, @types/react, @types/react-dom, tailwindcss
```

### 2. 環境變數設定

複製 `.env.example` 為 `.env`。

**重要**：若您只是想在本機快速測試 UI，可以**不設定** Firebase 相關變數，App 會自動進入「演示模式 (Demo Mode)」，使用 LocalStorage 儲存資料。但 **Google Gemini API Key 是必須的**。

```env
# Gemini API (必須)
REACT_APP_GOOGLE_API_KEY=your_gemini_api_key_here

# Firebase (若留空則進入 Demo Mode)
REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_AUTH_DOMAIN=
REACT_APP_FIREBASE_PROJECT_ID=
REACT_APP_FIREBASE_STORAGE_BUCKET=
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=
REACT_APP_FIREBASE_APP_ID=
```

### 3. 啟動

```bash
npm start
```

---

## ☁️ 部署 (Deployment)

建議使用 Vercel 或 Firebase Hosting。

### Vercel (推薦)

1.  將代碼推送到 GitHub。
2.  在 Vercel Dashboard Import Project。
3.  **關鍵步驟**：在 Vercel 的 Environment Variables 設定頁面，填入上述 `.env` 中的所有變數。
4.  Deploy!

### Firebase Setup (Production)

若要啟用雲端同步：

1.  前往 [Firebase Console](https://console.firebase.google.com/) 建立專案。
2.  啟用 **Authentication** -> Google Sign-in。
3.  啟用 **Firestore Database**。
4.  啟用 **Storage** (用於存圖片)。
5.  將專案設定中的 Keys 填入 `.env`。

---

## ⚠️ 注意事項

*   AI 估算僅供參考，不具醫療效力。
*   Google AI Studio 預覽環境中，Firebase Auth 可能因 Domain 限制無法正常運作，系統會自動 fallback 至 Demo 帳號模式。