import { useEffect, useState } from 'react';
import { portalApi } from '../services/portalApi';
import type { Branding } from '../types/portal';

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

export function BrandingPage() {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    portalApi.getBranding()
      .then((data) => {
        if (active) setBranding(data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    if (!branding) return;
    try {
      setError('');
      const updated = await portalApi.saveBranding({
        ...branding,
        expectedUpdatedAt: branding.updatedAt,
      });
      setBranding(updated);
      setMessage('Branding saved.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const publish = async () => {
    try {
      const updated = await portalApi.publishBranding();
      setBranding(updated);
      setMessage('Branding published.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const upload = async (assetType: string, file: File) => {
    const dataBase64 = await toBase64(file);
    const uploaded = await portalApi.uploadAsset({ assetType, filename: file.name, contentType: file.type, dataBase64 });
    if (!branding) return;
    if (assetType === 'logo') setBranding({ ...branding, logoUrl: uploaded.url });
    if (assetType === 'coach-photo') setBranding({ ...branding, coachPhotoUrl: uploaded.url });
    if (assetType === 'coach-header-image') setBranding({ ...branding, coachHeaderImageUrl: uploaded.url });
    if (assetType === 'qr-code') setBranding({ ...branding, qrCodeUrl: uploaded.url });
  };

  if (!branding) return <section className="panel page-section"><p>Loading branding...</p></section>;

  return (
    <section className="panel page-section">
      <h2>Profile &amp; Branding</h2>
      {message && <p className="ok">{message}</p>}
      {error && <p className="error">{error}</p>}
      <div className="grid2">
        <label>Workspace Slug<input value={branding.slug} onChange={(e) => setBranding({ ...branding, slug: e.target.value.toLowerCase() })} /></label>
        <label>Business Name<input value={branding.businessName} onChange={(e) => setBranding({ ...branding, businessName: e.target.value })} /></label>
        <label>Coach Name<input value={branding.coachName} onChange={(e) => setBranding({ ...branding, coachName: e.target.value })} /></label>
        <label>Primary Color<input type="color" value={branding.themePrimaryColor} onChange={(e) => setBranding({ ...branding, themePrimaryColor: e.target.value })} /></label>
        <label>Secondary Color<input type="color" value={branding.themeSecondaryColor} onChange={(e) => setBranding({ ...branding, themeSecondaryColor: e.target.value })} /></label>
      </div>
      <label>Headline<input value={branding.brandHeadline} onChange={(e) => setBranding({ ...branding, brandHeadline: e.target.value })} /></label>
      <label>Bio<textarea value={branding.bio} onChange={(e) => setBranding({ ...branding, bio: e.target.value })} /></label>
      <div className="row">
        <label>Logo<input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload('logo', f); }} /></label>
        <label>Coach Photo<input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload('coach-photo', f); }} /></label>
        <label>Coach Header Image<input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload('coach-header-image', f); }} /></label>
        <label>QR Code<input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload('qr-code', f); }} /></label>
      </div>
      <div className="row">
        <button className="button" onClick={() => void save()}>Save</button>
        <button className="button" onClick={() => void publish()}>Publish</button>
      </div>
    </section>
  );
}
