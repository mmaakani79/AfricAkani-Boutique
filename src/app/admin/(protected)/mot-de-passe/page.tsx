import type { Metadata } from "next";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Changer le mot de passe — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export default function ChangePasswordPage() {
  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Changer le mot de passe
      </h1>
      <p className="mt-2 max-w-md text-sm text-ink/60">
        Ce mot de passe protège tout l&rsquo;espace admin. Une fois changé
        ici, la variable d&rsquo;environnement ADMIN_PASSWORD n&rsquo;est
        plus utilisée pour la connexion.
      </p>
      <ChangePasswordForm />
    </div>
  );
}
