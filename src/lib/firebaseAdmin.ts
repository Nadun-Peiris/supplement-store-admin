import * as admin from "firebase-admin";

function getFirebaseServiceAccount(): admin.ServiceAccount {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    return JSON.parse(serviceAccountJson) as admin.ServiceAccount;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    throw new Error("Missing Firebase Admin credentials.");
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

const adminApp =
  admin.apps[0] ||
  admin.initializeApp({
    credential: admin.credential.cert(getFirebaseServiceAccount()),
  });

export const adminAuth = adminApp.auth();

export default adminApp;
