export type RequestDraft = { type: string; title: string; description: string; location: string; asset_ref: string };
type Asset = { id: string; name: string; location: string };

export const emptyRequestDraft = (): RequestDraft => ({ type: "defect", title: "", description: "", location: "", asset_ref: "" });

/** Only known, exact asset identifiers may prefill a draft; never submits it. */
export function requestDraftForAsset(assetRef: string | null, assets: readonly Asset[]): RequestDraft | null {
  if (!assetRef || !/^[A-Z]{1,3}-[0-9]{3}$/.test(assetRef)) return null;
  const asset = assets.find(item => item.id === assetRef);
  return asset ? { type: "defect", title: `Závada: ${asset.name}`.slice(0, 200), description: "", location: asset.location.slice(0, 120), asset_ref: asset.id } : null;
}
