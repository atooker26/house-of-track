import { requireAdmin } from "@/lib/admin/auth";
import PasswordForm from "@/components/admin/PasswordForm";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ set?: string }> }) {
  const me = await requireAdmin();
  const fromLink = (await searchParams).set === "1";
  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Account</h1>
          <p>Signed in as {me.email}</p>
        </div>
      </header>
      <section className="adm-card" style={{ maxWidth: 560 }}>
        <h2>{fromLink ? "Set your password" : "Change password"}</h2>
        {fromLink && <p className="adm-note">Your link worked. Pick a password to finish; you&rsquo;ll use it to sign in from now on.</p>}
        <PasswordForm email={me.email} />
      </section>
    </>
  );
}
