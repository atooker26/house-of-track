import { redirect } from "next/navigation";
import { getViewer } from "@/lib/admin/auth";
import LoginForm from "@/components/admin/LoginForm";
import SignOutButton from "@/components/admin/SignOutButton";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const viewer = await getViewer();
  if (viewer.state === "admin") redirect("/admin");

  return (
    <div className="adm-center">
      <div className="adm-login">
        <img src="/assets/logo-mark-navy-ink.png" alt="House of Track" />
        {viewer.state === "unconfigured" ? (
          <>
            <h1>Not set up yet</h1>
            <p className="sub">
              The admin login needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel. TEGO sets these.
            </p>
          </>
        ) : viewer.state === "not-admin" ? (
          <>
            <h1>Not an admin</h1>
            <p className="sub">
              You&rsquo;re signed in as <strong>{viewer.email}</strong>, but that login isn&rsquo;t on the admin list.
              Ask an admin to add you under Team.
            </p>
            <SignOutButton className="adm-btn ghost" />
          </>
        ) : (
          <LoginForm badLink={error === "link"} />
        )}
      </div>
    </div>
  );
}
