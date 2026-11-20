import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function RequestEvidence({ requestId, organizationId, userId, canAttach }: {
  requestId: string; organizationId: string; userId: string; canAttach: boolean;
}) {
  const client = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [documentId, setDocumentId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [downloadFailure, setDownloadFailure] = useState(false);
  const key = ["request-evidence", userId, organizationId, requestId];
  const evidence = useQuery({ queryKey: key, staleTime: 0, gcTime: 0, queryFn: async () => {
    const links = await supabase.from("request_evidence").select("version_id").eq("request_id", requestId);
    if (links.error) throw links.error;
    if (!links.data.length) return [];
    const files = await supabase.from("document_versions").select("id, version_no, original_filename")
      .in("id", links.data.map(row => row.version_id)).eq("upload_status", "ready");
    if (files.error) throw files.error;
    return files.data;
  }});
  const docs = useQuery({ queryKey: ["evidence-docs", userId, organizationId], enabled: canAttach && picking, gcTime: 0, queryFn: async () => {
    const result = await supabase.from("documents").select("id, title").eq("organization_id", organizationId).order("title");
    if (result.error) throw result.error;
    return result.data;
  }});
  const versions = useQuery({ queryKey: ["evidence-versions", userId, organizationId, documentId], enabled: canAttach && picking && !!documentId, gcTime: 0, queryFn: async () => {
    const result = await supabase.from("document_versions").select("id, version_no, original_filename").eq("document_id", documentId).eq("upload_status", "ready").order("version_no", { ascending: false });
    if (result.error) throw result.error;
    return result.data;
  }});
  const attach = useMutation({ mutationFn: async (id: string) => {
    const result = await supabase.rpc("attach_request_evidence", { p_request_id: requestId, p_version_id: id });
    if (result.error) throw result.error;
  }, onSuccess: async () => {
    setPicking(false);
    setDocumentId("");
    setVersionId("");
    await client.invalidateQueries({ queryKey: key });
  }});
  async function download(id: string) {
    setDownloadFailure(false);
    try {
      const auth = await supabase.rpc("authorize_download", { p_version_id: id });
      if (auth.error || !auth.data) throw new Error("Doklad není dostupný.");
      const { object_key, filename } = auth.data as { object_key: string; filename: string };
      const signed = await supabase.storage.from("documents").createSignedUrl(object_key, 60, { download: filename });
      if (signed.error || !signed.data) throw new Error("Doklad není dostupný.");
      window.location.assign(signed.data.signedUrl);
    } catch {
      setDownloadFailure(true);
      await client.invalidateQueries({ queryKey: key });
    }
  }
  return <section className="space-y-3 rounded-xl border bg-card p-6">
    <h2 className="text-lg font-semibold">Doklady k požadavku</h2>
    {evidence.isPending && <p role="status">Načítání dokladů…</p>}
    {evidence.isError && <p role="alert">Doklady se nepodařilo načíst.</p>}
    {evidence.isSuccess && (evidence.data.length ? <ul className="space-y-2">{evidence.data.map(v => <li key={v.id}>
      <Button variant="outline" size="sm" onClick={() => void download(v.id)}>{v.original_filename} · verze {v.version_no}</Button>
    </li>)}</ul> : <p className="text-sm text-muted-foreground">Žádné dostupné doklady.</p>)}
    {downloadFailure && <p role="alert">Doklad se nepodařilo stáhnout nebo k němu už nemáte přístup.</p>}
    {attach.isSuccess && <p role="status">Doklad připojen.</p>}
    {canAttach && !picking && <Button variant="outline" onClick={() => { attach.reset(); setPicking(true); }}>Připojit doklad z archivu</Button>}
    {canAttach && picking && <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (versionId) attach.mutate(versionId); }}>
      <p className="text-sm text-muted-foreground">Připojení nemění oprávnění k dokumentu.</p>
      <label className="block text-sm">Dokument <select className="ml-2 rounded border bg-background p-1" required value={documentId} onChange={e => { setDocumentId(e.target.value); setVersionId(""); }}>
        <option value="">{docs.isPending ? "Načítání…" : "Vyberte dokument"}</option>{docs.data?.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
      </select></label>
      {documentId && <label className="block text-sm">Verze <select className="ml-2 rounded border bg-background p-1" required value={versionId} onChange={e => setVersionId(e.target.value)}>
        <option value="">{versions.isPending ? "Načítání…" : versions.data?.length === 0 ? "Žádná dokončená verze" : "Vyberte verzi"}</option>{versions.data?.map(v => <option key={v.id} value={v.id}>{v.version_no} · {v.original_filename}</option>)}
      </select></label>}
      {(docs.isError || versions.isError || attach.isError) && <p role="alert">Doklad se nepodařilo načíst nebo připojit.</p>}
      <div className="flex gap-2"><Button type="submit" disabled={!versionId || attach.isPending}>Připojit verzi</Button><Button type="button" variant="outline" disabled={attach.isPending} onClick={() => { setPicking(false); setDocumentId(""); setVersionId(""); }}>Zrušit</Button></div>
    </form>}
  </section>;
}
