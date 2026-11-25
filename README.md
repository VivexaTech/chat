# Repair Series Connect – Independent Chat API

A standalone, reusable real-time chat application and TypeScript SDK built with **React + Vite + TypeScript**, **Tailwind CSS**, **Lucide React**, **Firebase Authentication + Cloud Firestore** (state & messaging), and **Cloudinary** (image & voice note media uploads).

> **Local Testing Phase Only:** Keep this project completely separate from your existing Repair Series application, Firebase project, authentication system, and database.

---

## Architecture Overview

- **Firebase Authentication & Firestore (Isolated Named App `repair-series-connect`)**:
  - Email/password login and UID-based identity
  - User profiles (`chat_users/{uid}`)
  - Conversations (`conversations/{conversationId}`)
  - Real-time message streams (`conversations/{conversationId}/messages/{messageId}`)
  - Typing indicators (`conversations/{conversationId}/typing/{uid}`)
  - Delivery & read receipts (`Sent`, `Delivered`, `Read`) and unread counts
  - Zero Firebase Storage dependencies
- **Cloudinary Media Service ([cloudinary.service.ts](file:///d:/chat/src/services/cloudinary.service.ts))**:
  - Uploads images (`resourceType: "image"`) and voice notes (`resourceType: "video"`)
  - Tracks live upload progress (`XMLHttpRequest`) and stores returned `secure_url` + metadata in Firestore
  - Supports unsigned upload presets for local testing and switches seamlessly to server-signed uploads (`signedUploadEndpoint` or `getSignature`) for production without modifying any chat UI component
- **Location Sharing, Pagination & SDK**:
  - Browser Geolocation API with explicit confirmation before sending and `https://www.google.com/maps?q=LATITUDE,LONGITUDE` links
  - Cursor-based older message pagination
  - Drop-in `<RepairChat />` component and headless `createChatClient()` exported from `src/sdk/index.ts`

---

## Project Structure

```text
src/
  components/
    AttachmentMenu/
    Auth/
    ChatSidebar/
    ChatWindow/
    ImageViewer/
    LocationMessage/
    MessageBubble/
    MessageInput/
    VoiceRecorder/
    common/
  config/
    chat.config.ts
  hooks/
    useChat.ts
    useMessages.ts
    useTypingIndicator.ts
  sdk/
    RepairChat.tsx
    createChatClient.ts
    index.ts
  services/
    firebase.ts
    auth.service.ts
    chat.service.ts
    message.service.ts
    cloudinary.service.ts
    media.service.ts
    location.service.ts
  types/
    chat.types.ts
  utils/
    formatters.ts
firestore.rules
firestore.indexes.json
.env.example
```

---

## Complete Local Testing Setup Guide

### 1. Create a Separate Firebase Project

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a **brand-new Firebase project** (for example, `repair-series-connect`).
2. Do **not** reuse your existing Repair Series Firebase project.
3. Under **Project Settings -> General -> Your apps**, register a **Web (`</>`)** app and copy `apiKey`, `authDomain`, `projectId`, and `appId`.

### 2. Enable Email/Password Authentication

1. Open **Build -> Authentication -> Get started**.
2. Go to **Sign-in method**, select **Email/Password**, enable it, and click **Save**.

### 3. Configure Cloud Firestore

1. Open **Build -> Firestore Database -> Create database**.
2. Keep the database ID as **`(default)`**, select a region, and start in **Production mode**.
3. Open **Firestore Database -> Rules**, paste the contents of `firestore.rules`, and click **Publish**.
4. Open **Firestore Database -> Indexes -> Composite** and add the composite index from `firestore.indexes.json` on collection `conversations`:
   - `participants` -> `Array-contains`
   - `updatedAt` -> `Descending`
   *(Or deploy via CLI: `firebase deploy --only firestore:rules,firestore:indexes`.)*

### 4. Create Two Test Users

1. Open **Build -> Authentication -> Users -> Add user**.
2. Create **User 1** (e.g. `user1@example.com`) and **User 2** (e.g. `user2@example.com`).
3. Each user's `chat_users/{uid}` document is created automatically on first sign-in. Users can update their display name (e.g. `Vivek`, `Test User`) via the **Profile Settings** icon in the sidebar.

### 5. Create a Cloudinary Account

1. Sign up for a free account at [Cloudinary](https://cloudinary.com/).
2. From your Cloudinary **Dashboard**, copy your **Cloud Name**.
   *(Never place your Cloudinary API Secret in any frontend `.env` variable.)*

### 6. Create an Upload Preset

For initial local testing, configure a strictly scoped **Unsigned Upload Preset**:

1. In Cloudinary, go to **Settings -> Upload -> Upload presets -> Add upload preset**.
2. Set **Signing Mode** to **Unsigned** and give it a clear name (e.g. `repair_connect_local`).
3. Configure strict restrictions on the preset:
   - **Folder**: `repair-series-connect`
   - **Allowed formats**: `jpg, jpeg, png, webp, gif, webm, mp4, ogg, mp3, wav, m4a`
   - **Max image file size**: `10 MB` (and **Max video/audio file size**: `15 MB`)
   - **Transformations**: leave empty (no unnecessary incoming transformations)
4. Save the preset and copy its **Upload preset name**.

> **Production Security Note:** When moving beyond local testing, switch to signed uploads by providing `signedUploadEndpoint` or `getSignature` in `cloudinaryConfig` (see [SDK Usage](#reusable-sdk-usage)) so your backend generates short-lived signatures without exposing Cloudinary secrets in frontend code.

### 7. Configure Environment Variables

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

   *(Windows PowerShell: `Copy-Item .env.example .env`)*

2. Fill in your independent Firebase and Cloudinary values in `.env`:

   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_APP_ID=your_app_id

   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset_name
   ```

### 8. Start Localhost

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).

### 9. Test Image Sharing

1. Open a conversation and click the **Paperclip** attachment button -> **Photo**.
2. Pick a JPEG, PNG, WebP, or GIF file (`<= 10 MB`).
3. Confirm the pre-send image preview (optionally add a caption) and click **Send**.
4. Verify upload progress reaches `100%`, the image renders inside the chat bubble, clicking opens the full-screen viewer, and **Download** saves the file.

### 10. Test Voice Notes

1. Click the **Mic** icon in the message composer and grant browser microphone permission.
2. Speak a short message, watch the live recording duration timer, and click **Stop**.
3. Preview the audio clip in the composer bar and click **Send** to upload it to Cloudinary (`video` resource type).
4. Play/pause and scrub the audio playback bar inside the received message bubble.

### 11. Test Real-Time Messaging Between Two Accounts

1. Sign in as **User 1** in a regular browser window at `http://localhost:5173`.
2. Sign in as **User 2** in an Incognito/Private browser window (or different browser).
3. Start a conversation from User 1 via **New conversation** and send messages back and forth.
4. Verify:
   - Instant message delivery in both windows without page refresh
   - Live typing indicator (`"<Name> is typing..."`) appearing and auto-clearing
   - `Sent` -> `Delivered` -> `Read` checkmarks and unread count updates
   - Location sharing via **Paperclip -> Current location** showing the confirmation modal and `Open in Google Maps` link
   - Mobile responsive layout (`< 768px`) with back navigation and zero horizontal scrolling
   - Sign-out and unauthorized access protection

---

## Verification Scripts

```bash
npm run typecheck   # TypeScript verification
npm test            # Automated Vitest suite
npm run build       # Production TypeScript check + Vite build
```

---

## Reusable SDK Usage

```tsx
import { RepairChat } from "repair-series-connect";

// Customer view
<RepairChat
  userId={currentUser.uid}
  userRole="customer"
  conversationId={conversationId}
  recipientId={partner.uid}
/>

// Production signed Cloudinary upload configuration (zero UI changes)
<RepairChat
  userId={partner.uid}
  userRole="partner"
  conversationId={conversationId}
  cloudinaryConfig={{
    cloudName: "your-cloud-name",
    signedUploadEndpoint: "/api/cloudinary/sign",
  }}
/>
```
