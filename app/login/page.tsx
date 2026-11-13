import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connexion · UbiBoard" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <LoginForm />;
}
