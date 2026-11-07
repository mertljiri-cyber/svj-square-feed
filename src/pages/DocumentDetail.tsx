import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequireMember } from "@/features/auth/RequireMember";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabels, visibilityLabels, lifecycleLabels, uploadStatusLabels, ACCEPT, MAX_BYTES, formatBytes, sha256Hex } from "@/features/documents/labels";

type Member = { user_id: string; email: string; display_name: string | null; status: string };
const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function DetailInner() {
  const { id } = useParams<{ id: string }>();
  const { session, activeMembership, isBoard } = useAuth();
  const userId = session!.user.id;
  const orgId = activeMembership!.organization_id;
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ title: string; category: string; visibility: string; from: string; to: string } | null>(null);
  const [grantUser, setGrantUser] = useState("");
  const [grantPerm, setGrantPerm] = useState("read");

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
  const { data: versions = [] } = useQuery({
    queryKey: ["document-versions", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("document_versions").select("*").eq("document_id", id!).order("version_no", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!doc,
  });
  const { data: grants = [] } = useQuery({
    queryKey: ["document-grants", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("document_grants").select("*").eq("document_id", id!).is("revoked_at", null);
      if (error) throw error;
      return data;
    },
    enabled: !!doc,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_members", { p_organization_id: orgId });
      if (error) throw error;
      return (data as unknown as Member[]).filter((m) => m.status === "active");
    },
    enabled: isBoard,
  });

  const refresh = () => Promise.all(["document", "document-versions", "document-grants", "documents"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  async function run(done: string, p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p;
    setMessage(error ? error.message : done);
    await refresh();
    return !error;
  }

  if (isLoading) return <Layout><div className="page-container py-12 text-muted-foreground">Načítání…</div></Layout>;
  if (!doc) return <Layout><div className="page-container py-12"><h1 className="text-2xl font-bold">Dokument nenalezen</h1><Link className="mt-4 inline-block text-primary underline" to="/dokumenty">Zpět na dokumenty</Link></div></Layout>;

  // Jen nápověda pro zobrazení tlačítek; o právu rozhoduje vždy server.
  const myManage = grants.some((g) => g.user_id === userId && g.permission === "manage");
  const canManage = (isBoard && doc.visibility !== "restricted") || myManage;

  async function upload(file: File) {
    if (file.size > MAX_BYTES) { setMessage("Soubor je větší než 25 MB."); return; }
    setBusy(true);
    setMessage("");
    try {
      const sha = await sha256Hex(file);
      const begin = await supabase.rpc("begin_upload", { p_document_id: doc!.id, p_filename: file.name, p_mime: file.type, p_bytes: file.size, p_sha256: sha });
      if (begin.error) { setMessage(begin.error.message); return; }
      const { version_id, object_key, version_no } = begin.data as unknown as { version_id: string; object_key: string; version_no: number };
      const up = await supabase.storage.from("documents").upload(object_key, file, { contentType: file.type, upsert: false });
      if (up.error) { setMessage("Nahrání souboru selhalo. Verze č. " + version_no + " zůstala nedokončená, zkuste to znovu."); return; }
      const done = await supabase.rpc("complete_upload", { p_version_id: version_id });
      if (done.error) { setMessage(done.error.message); return; }
      const result = done.data as unknown as { status: string; reason?: string };
      setMessage(result.status === "ready" ? `Verze č. ${version_no} je nahrána. Publikujte ji, aby ji viděli čtenáři.` : (result.reason ?? "Nahrání selhalo."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    }
  }

  async function download(versionId: string) {
    const auth = await supabase.rpc("authorize_download", { p_version_id: versionId });
    if (auth.error) { setMessage(auth.error.message); return; }
    const { object_key, filename } = auth.data as unknown as { object_key: string; filename: string };
    // Krátkodobý odkaz: po odebrání přístupu platí nejvýše 60 s.
    const signed = await supabase.storage.from("documents").createSignedUrl(object_key, 60, { download: filename });
    if (signed.error || !signed.data) { setMessage("Odkaz ke stažení se nepodařilo vytvořit."); return; }
    window.location.assign(signed.data.signedUrl);
  }

  return (
    <Layout>
      <div className="page-container py-8">
        <Link to="/dokumenty" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Dokumenty</Link>
        <p className="text-sm text-muted-foreground">{categoryLabels[doc.category] ?? doc.category}</p>
        <h1 className="mt-1 text-3xl font-bold">{doc.title}</h1>
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-secondary px-3 py-1">{lifecycleLabels[doc.lifecycle] ?? doc.lifecycle}</span>
          <span className="rounded-full bg-secondary px-3 py-1">{visibilityLabels[doc.visibility] ?? doc.visibility}</span>
          {doc.period_from && <span className="rounded-full bg-secondary px-3 py-1">{new Date(doc.period_from).toLocaleDateString("cs-CZ")}{doc.period_to ? ` – ${new Date(doc.period_to).toLocaleDateString("cs-CZ")}` : ""}</span>}
        </p>
        {message && <p role="status" className="mt-6 rounded-lg border p-3 text-sm">{message}</p>}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border bg-card p-6 lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Verze</h2>
            {versions.length === 0 && <p className="text-sm text-muted-foreground">Zatím není nahraná žádná verze.</p>}
            <ul className="space-y-3">
              {versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
                  <div>
                    <p className="font-medium">Verze {v.version_no}{doc.current_version_id === v.id ? " · aktuální" : ""}</p>
                    <p className="text-muted-foreground">{v.original_filename} · {formatBytes(v.bytes)} · {new Date(v.created_at).toLocaleDateString("cs-CZ")} · {uploadStatusLabels[v.upload_status] ?? v.upload_status}</p>
                    {v.failure_reason && <p className="text-destructive">{v.failure_reason}</p>}
                  </div>
                  <div className="flex gap-2">
                    {v.upload_status === "ready" && <Button size="sm" variant="outline" onClick={() => download(v.id)}>Stáhnout</Button>}
                    {canManage && v.upload_status === "ready" && doc.current_version_id !== v.id && (
                      <Button size="sm" onClick={() => run("Verze publikována.", supabase.rpc("publish_version", { p_document_id: doc.id, p_version_id: v.id, p_expected_row_version: doc.row_version }))}>Publikovat</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {canManage && (
              <div className="mt-6">
                <label className="block text-sm font-medium">Nahrát novou verzi (PDF, DOCX, XLSX, PNG, JPG do 25 MB)
                  <input ref={fileRef} className="mt-2 block text-sm" type="file" accept={ACCEPT} disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
                </label>
                {busy && <p className="mt-2 text-sm text-muted-foreground">Nahrávání…</p>}
              </div>
            )}
          </section>

          {canManage && (
            <aside className="space-y-6">
              <section className="rounded-xl border bg-card p-6">
                <h2 className="mb-3 font-semibold">Stav dokumentu</h2>
                <div className="flex flex-wrap gap-2">
                  {doc.lifecycle === "published" && <>
                    <Button size="sm" variant="outline" onClick={() => run("Dokument archivován.", supabase.rpc("set_document_lifecycle", { p_document_id: doc.id, p_to: "archived", p_expected_row_version: doc.row_version }))}>Archivovat</Button>
                    <Button size="sm" variant="outline" onClick={() => run("Dokument stažen z publikace.", supabase.rpc("set_document_lifecycle", { p_document_id: doc.id, p_to: "withdrawn", p_expected_row_version: doc.row_version }))}>Stáhnout z publikace</Button>
                  </>}
                  {(doc.lifecycle === "archived" || doc.lifecycle === "withdrawn") && doc.current_version_id && (
                    <Button size="sm" onClick={() => run("Dokument znovu publikován.", supabase.rpc("set_document_lifecycle", { p_document_id: doc.id, p_to: "published", p_expected_row_version: doc.row_version }))}>Znovu publikovat</Button>
                  )}
                  {doc.lifecycle === "draft" && <p className="text-sm text-muted-foreground">Nahrajte soubor a publikujte verzi.</p>}
                </div>
                <Button className="mt-4" size="sm" variant="ghost" onClick={() => setEdit({ title: doc.title, category: doc.category, visibility: doc.visibility, from: doc.period_from ?? "", to: doc.period_to ?? "" })}>Upravit údaje</Button>
              </section>

              {edit && (
                <form className="space-y-3 rounded-xl border bg-card p-6" onSubmit={async (e) => { e.preventDefault(); if (await run("Údaje uloženy.", supabase.rpc("update_document", { p_document_id: doc.id, p_title: edit.title, p_category: edit.category, p_period_from: edit.from || null, p_period_to: edit.to || null, p_visibility: edit.visibility, p_expected_row_version: doc.row_version }))) setEdit(null); }}>
                  <Input aria-label="Název" required minLength={3} maxLength={200} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                  <select aria-label="Kategorie" className={`${selectClass} w-full`} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <select aria-label="Kdo smí číst" className={`${selectClass} w-full`} value={edit.visibility} onChange={(e) => setEdit({ ...edit, visibility: e.target.value })}>{Object.entries(visibilityLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <div className="grid grid-cols-2 gap-2"><Input aria-label="Období od" type="date" value={edit.from} onChange={(e) => setEdit({ ...edit, from: e.target.value })} /><Input aria-label="Období do" type="date" value={edit.to} onChange={(e) => setEdit({ ...edit, to: e.target.value })} /></div>
                  <div className="flex gap-2"><Button type="submit" size="sm">Uložit</Button><Button type="button" size="sm" variant="outline" onClick={() => setEdit(null)}>Zrušit</Button></div>
                </form>
              )}

              <section className="rounded-xl border bg-card p-6">
                <h2 className="mb-3 font-semibold">Jmenovitý přístup</h2>
                <ul className="mb-4 space-y-2 text-sm">
                  {grants.length === 0 && <li className="text-muted-foreground">Žádné jmenovité přístupy.</li>}
                  {grants.map((g) => {
                    const m = members.find((x) => x.user_id === g.user_id);
                    return (
                      <li key={g.id} className="flex items-center justify-between gap-2">
                        <span>{m ? (m.display_name || m.email) : g.user_id === userId ? "Vy" : "Člen SVJ"} · {g.permission === "manage" ? "správa" : "čtení"}</span>
                        <button className="text-muted-foreground underline" onClick={() => run("Přístup odebrán.", supabase.rpc("revoke_document_access", { p_grant_id: g.id }))}>odebrat</button>
                      </li>
                    );
                  })}
                </ul>
                {isBoard && (
                  <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await run("Přístup udělen.", supabase.rpc("grant_document_access", { p_document_id: doc.id, p_user_id: grantUser, p_permission: grantPerm }))) setGrantUser(""); }}>
                    <select aria-label="Člen" required className={`${selectClass} w-full`} value={grantUser} onChange={(e) => setGrantUser(e.target.value)}>
                      <option value="">Vyberte člena</option>
                      {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>)}
                    </select>
                    <select aria-label="Oprávnění" className={`${selectClass} w-full`} value={grantPerm} onChange={(e) => setGrantPerm(e.target.value)}><option value="read">Čtení</option><option value="manage">Správa</option></select>
                    <Button type="submit" size="sm" variant="outline">Udělit přístup</Button>
                  </form>
                )}
              </section>
            </aside>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default function DocumentDetail() {
  return <RequireMember><DetailInner /></RequireMember>;
}
