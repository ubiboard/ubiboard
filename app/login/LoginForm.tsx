"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import Icon from "@/components/Icon";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
    if (result.error) {
      // Même message dans tous les cas : on ne révèle pas si le compte existe.
      setError(
        result.error.status === 401 || result.error.status === 400
          ? "Adresse e-mail ou mot de passe incorrect."
          : "Connexion impossible pour le moment. Réessayez."
      );
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <Icon name="home" size={28} color="var(--accent)" />
          <h1 className="brand">UbiBoard</h1>
        </div>
        <div>
          <label className="field-label" htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            className="input block"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="password">Mot de passe</label>
          <input
            id="password"
            className="input block"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="save-error" role="alert">{error}</div>}
        <button className="btn btn-primary center" type="submit" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
