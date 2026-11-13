"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import Icon from "@/components/Icon";

export default function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const id = identifier.trim().toLowerCase();
    // On accepte l'identifiant court ou l'adresse e-mail.
    const result = id.includes("@")
      ? await authClient.signIn.email({ email: id, password })
      : await authClient.signIn.username({ username: id, password });
    if (result.error) {
      // Même message dans tous les cas : on ne révèle pas si le compte existe.
      const status = result.error.status;
      setError(
        status === 401 || status === 400 || status === 422
          ? "Identifiant ou mot de passe incorrect."
          : "Connexion impossible pour le moment. Réessayez."
      );
      setBusy(false);
      return;
    }
    // Navigation complète : c'est elle qui signale au navigateur et aux
    // gestionnaires de mots de passe que la connexion a réussi.
    window.location.assign("/");
  };

  return (
    <main className="login">
      {/* Les attributs name / autocomplete / action permettent au navigateur de proposer d'enregistrer les identifiants. */}
      <form className="login-card" method="post" action="/login" onSubmit={submit}>
        <div className="login-brand">
          <Icon name="home" size={28} color="var(--accent)" />
          <h1 className="brand">UbiBoard</h1>
        </div>
        <div>
          <label className="field-label" htmlFor="username">Identifiant</label>
          <input
            id="username"
            name="username"
            className="input block"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="password">Mot de passe</label>
          <input
            id="password"
            name="password"
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
