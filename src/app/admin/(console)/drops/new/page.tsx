import Link from "next/link";
import DropForm from "@/components/admin/DropForm";

export default function NewDropPage() {
  return (
    <>
      <p className="adm-crumb">
        <Link href="/admin/drops">Drops</Link> / New
      </p>
      <header className="adm-head">
        <div>
          <h1>New drop</h1>
          <p>Starts as a draft. Add products and photos, then set it live.</p>
        </div>
      </header>
      <section className="adm-card">
        <DropForm />
      </section>
    </>
  );
}
