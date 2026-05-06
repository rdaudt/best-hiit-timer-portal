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
  const [baseline, setBaseline] = useState<Branding | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    let active = true;
    portalApi.getBranding()
      .then((data) => {
        if (active) {
          setBranding(data);
          setBaseline(data);
        }
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
      setIsMutating(true);
      setError('');
      const updated = await portalApi.saveBranding({
        ...branding,
        expectedUpdatedAt: branding.updatedAt,
      });
      setBranding(updated);
      setBaseline(updated);
      setMessage('Branding saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  const publish = async () => {
    try {
      setIsMutating(true);
      setError('');
      const updated = await portalApi.publishBranding();
      setBranding(updated);
      setBaseline(updated);
      setMessage('Branding published.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  const unpublish = async () => {
    try {
      setIsMutating(true);
      setError('');
      const updated = await portalApi.unpublishBranding();
      setBranding(updated);
      setBaseline(updated);
      setMessage('Branding moved back to draft.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  const deleteProfile = async () => {
    if (!branding) return;
    if (deleteConfirm !== branding.slug) {
      setError('Type your workspace slug to confirm deletion.');
      return;
    }
    try {
      setError('');
      setMessage('');
      await portalApi.deleteBranding();
      await portalApi.logout();
      window.location.assign('/signin?deleted=1');
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
  const dirty = baseline ? JSON.stringify(branding) !== JSON.stringify(baseline) : false;
  const saveDisabled = !dirty || isMutating;
  const publishDisabled = branding.status !== 'draft' || dirty || isMutating;
  const unpublishDisabled = branding.status !== 'published' || dirty || isMutating;

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
        <button className="button" disabled={saveDisabled} onClick={() => void save()}>Save</button>
        <button className="button" disabled={publishDisabled} onClick={() => void publish()}>Publish</button>
        <button className="button" disabled={unpublishDisabled} onClick={() => void unpublish()}>Unpublish</button>
      </div>
      {dirty ? <p className="muted">Save changes to enable Publish/Unpublish.</p> : null}
      <hr />
      <h3>Delete Profile</h3>
      <p className="muted">This disables your workspace and signs you out. Type <strong>{branding.slug}</strong> to confirm.</p>
      <div className="row">
        <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value.toLowerCase())} placeholder="Type workspace slug" />
        <button className="button danger" onClick={() => void deleteProfile()}>Delete Profile</button>
      </div>
    </section>
  );
}
