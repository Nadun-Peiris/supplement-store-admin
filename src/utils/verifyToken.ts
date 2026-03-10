import * as admin from "firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";

let app: admin.app.App;

/* ---------------------------------------------------------
   Initialize Firebase Admin (Once Only)
--------------------------------------------------------- */
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!privateKey) {
    throw new Error(
      "❌ Missing FIREBASE_PRIVATE_KEY in environment variables."
    );
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

/* ---------------------------------------------------------
   Verify Firebase Token
   Returns DecodedIdToken OR throws error
--------------------------------------------------------- */
export const verifyToken = async (
  token: string
): Promise<DecodedIdToken> => {
  if (!token) {
    throw new Error("No token provided");
  }

  return await admin.auth().verifyIdToken(token);
};

export default app;
