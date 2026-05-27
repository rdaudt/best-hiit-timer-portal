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
  const timerBaseUrl = 'https://best-hiit-timer.vercel.app/';
  const coachRegistrationQrPath = '/assets/portal-qr-code.png';
  const assetPreviewUrl = (url: string) => `/api/portal/branding?action=asset-image&url=${encodeURIComponent(url)}`;
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
    if (!branding) return;
    try {
      setIsMutating(true);
      setError('');
      setMessage('');
      const dataBase64 = await toBase64(file);
      const uploaded = await portalApi.uploadAsset({ assetType, filename: file.name, contentType: file.type, dataBase64 });
      const nextBranding = { ...branding };
      if (assetType === 'logo') nextBranding.logoUrl = uploaded.url;
      if (assetType === 'coach-photo') nextBranding.coachPhotoUrl = uploaded.url;
      if (assetType === 'coach-header-image') nextBranding.coachHeaderImageUrl = uploaded.url;
      if (assetType === 'qr-code') nextBranding.qrCodeUrl = uploaded.url;

      const persisted = await portalApi.saveBranding({
        ...nextBranding,
        expectedUpdatedAt: branding.updatedAt,
      });
      setBranding(persisted);
      setBaseline(persisted);
      setMessage('Image uploaded and saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  if (!branding) return <section className="panel page-section"><p>Loading Profile...</p></section>;
  const dirty = baseline ? JSON.stringify(branding) !== JSON.stringify(baseline) : false;
  const saveDisabled = !dirty || isMutating;
  const publishDisabled = branding.status !== 'draft' || dirty || isMutating;
  const unpublishDisabled = branding.status !== 'published' || dirty || isMutating;
  const timerUrl = `${timerBaseUrl}${branding.slug}`;

  return (
    <section className="panel page-section">
      {message && <p className="ok" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="grid2">
        <label>Coach Name<input value={branding.coachName} onChange={(e) => setBranding({ ...branding, coachName: e.target.value })} /></label>
        <label>Business Name<input value={branding.businessName} onChange={(e) => setBranding({ ...branding, businessName: e.target.value })} /></label>
        <label>Coach Identifier<input value={branding.slug} onChange={(e) => setBranding({ ...branding, slug: e.target.value.toLowerCase() })} /></label>
      </div>
      <label>Header Tagline<input value={branding.headerTagline} onChange={(e) => setBranding({ ...branding, headerTagline: e.target.value })} /></label>
      <div className="grid2">
        <label>Instagram Username<input value={branding.igUsername} onChange={(e) => setBranding({ ...branding, igUsername: e.target.value.replace(/^@/, '') })} placeholder="yourusername" /></label>
      </div>
      <label>Bio<textarea className="bio-textarea" value={branding.bio} onChange={(e) => setBranding({ ...branding, bio: e.target.value })} /></label>
      <div className="asset-preview-grid">
        <div className="asset-preview-card">
          <p>Business Logo</p>
          {branding.logoUrl ? <img src={assetPreviewUrl(branding.logoUrl)} alt="Uploaded logo preview" className="asset-preview-image" /> : <div className="asset-preview-placeholder">No image</div>}
          <label className="asset-upload-label">
            <span className="button-secondary">Upload Logo</span>
            <input className="asset-file-input" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload('logo', f); }} />
          </label>
        </div>
        <div className="asset-preview-card">
          <p>Coach Photo</p>
          {branding.coachPhotoUrl ? <img src={assetPreviewUrl(branding.coachPhotoUrl)} alt="Uploaded coach photo preview" className="asset-preview-image" /> : <div className="asset-preview-placeholder">No image</div>}
          <label className="asset-upload-label">
            <span className="button-secondary">Upload Coach Photo</span>
            <input className="asset-file-input" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload('coach-photo', f); }} />
          </label>
        </div>
        <div className="asset-preview-card">
          <p>Coach Header Image</p>
          {branding.coachHeaderImageUrl ? <img src={assetPreviewUrl(branding.coachHeaderImageUrl)} alt="Uploaded coach header preview" className="asset-preview-image" /> : <div className="asset-preview-placeholder">No image</div>}
          <label className="asset-upload-label">
            <span className="button-secondary">Upload Header Image</span>
            <input className="asset-file-input" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload('coach-header-image', f); }} />
          </label>
        </div>
      </div>
      <div className="panel panel-subtle">
        <div className="grid2">
          <div className="qr-panel">
            <p><strong>Send someone to the Coach Portal</strong></p>
            <img src={coachRegistrationQrPath} alt="Register as a coach QR code" className="brand-qr-image" />
            <p className="muted">https://best-hiit-timer-portal.vercel.app/</p>
          </div>
          <div className="qr-panel">
            <p><strong>Send someone to the HIIT Timer app</strong></p>
            {branding.qrCodeUrl ? <img src={`/api/portal/branding?action=qr-image&t=${encodeURIComponent(branding.updatedAt)}`} alt="Register as an athlete QR code" className="brand-qr-image" /> : <p className="muted">No QR code generated yet.</p>}
            <p className="muted">{timerUrl}</p>
          </div>
        </div>
      </div>
      <div className="row profile-actions">
        <button className="button" disabled={saveDisabled} onClick={() => void save()}>Save</button>
        <button className="button" disabled={publishDisabled} onClick={() => void publish()}>Publish</button>
        <button className="button" disabled={unpublishDisabled} onClick={() => void unpublish()}>Unpublish</button>
      </div>
      {dirty ? <p className="muted">Save changes to enable Publish/Unpublish.</p> : null}
      <hr />
      <h3>Delete Profile</h3>
      <p className="muted">This disables your workspace and signs you out. Type <strong>{branding.slug}</strong> to confirm.</p>
      <div className="row">
        <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value.toLowerCase())} placeholder="Type coach identifier" />
        <button className="button danger" onClick={() => void deleteProfile()}>Delete Profile</button>
      </div>
    </section>
  );
}
