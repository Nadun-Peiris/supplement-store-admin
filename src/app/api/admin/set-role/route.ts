import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = getFirestore();

export async function POST(req: Request) {
  try {
    const { email, makeAdmin } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // 🔹 Get user by email
    const user = await admin.auth().getUserByEmail(email);

    // 🔹 Set or remove custom claim
    await admin.auth().setCustomUserClaims(user.uid, { admin: makeAdmin });

    // 🔹 Update Firestore "users" collection to reflect role change
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("email", "==", email).get();

    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0].ref;
      await userDoc.update({ role: makeAdmin ? "admin" : "user" });
    } else {
      // If user not in Firestore, create entry
      await usersRef.add({
        email,
        role: makeAdmin ? "admin" : "user",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      message: makeAdmin
        ? "✅ User promoted to admin successfully."
        : "❎ Admin privileges removed.",
    });
  } catch (error: any) {
    console.error("Error updating admin role:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update admin role." },
      { status: 500 }
    );
  }
}
