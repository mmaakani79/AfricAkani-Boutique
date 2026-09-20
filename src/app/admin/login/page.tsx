import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion admin — AfricAkani",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-green-dark px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex justify-center">
          <Image
            src="/logo/medallion.png"
            alt="AfricAkani"
            width={56}
            height={56}
            className="h-14 w-14 rounded-full"
          />
        </div>
        <h1 className="mt-4 text-center font-brand text-xl font-bold text-brand-green-dark">
          Espace administration
        </h1>
        <p className="mt-1 text-center text-sm text-ink/60">
          Réservé à l&rsquo;équipe AfricAkani.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
