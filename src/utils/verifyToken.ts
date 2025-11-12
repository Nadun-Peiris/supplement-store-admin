import * as admin from "firebase-admin";

// Reuse admin app if already initialized
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

// 🔍 Verify Firebase ID Token
export async function verifyIdToken(token: string) {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (error) {
    console.error("❌ Invalid Firebase token:", error);
    return null;
  }
}
