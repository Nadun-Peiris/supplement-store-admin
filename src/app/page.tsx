// src/app/page.tsx
import { redirect } from "next/navigation";
import { Player } from "@lottiefiles/react-lottie-player";


export default function HomePage() {
  redirect("/login");
}
