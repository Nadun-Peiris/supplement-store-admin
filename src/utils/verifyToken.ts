import * as admin from "firebase-admin";

let app: admin.app.App;

// ✅ Initialize Firebase Admin once
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!privateKey) {
    throw new Error("❌ Missing FIREBASE_PRIVATE_KEY in environment variables.");
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
} else {
  app = admin.app();
}

/**
 * ✅ Verifies a Firebase ID token safely in middleware/server.
 * @param token - The Firebase JWT from cookies.
 * @returns Decoded token payload or null if invalid.
 */
export const verifyToken = async (token: string) => {
  if (!token) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
};

export default app;
