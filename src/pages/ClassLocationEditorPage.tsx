import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { portalApi } from '../services/portalApi';

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

type FormState = {
  businessName: string;
  locationName: string;
  logoUrl: string;
};

const emptyForm = (): FormState => ({ businessName: '', locationName: '', logoUrl: '' });

export function ClassLocationEditorPage() {
  const { id = 'new' } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState('');
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    if (id === 'new') return;
    void (async () => {
      try {
        const data = await portalApi.getClassLocation(id);
        setForm({ businessName: data.businessName, locationName: data.locationName, logoUrl: data.logoUrl });
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [id]);

  const save = async () => {
    try {
      setIsMutating(true);
      setError('');
      if (id === 'new') {
        const created = await portalApi.createClassLocation({ businessName: form.businessName, locationName: form.locationName, logoUrl: '' });
        navigate(`/class-locations/${created.id}`, { replace: true });
      } else {
        await portalApi.updateClassLocation(id, { businessName: form.businessName, locationName: form.locationName, logoUrl: form.logoUrl });
        setError('');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (id === 'new') return;
    try {
      setIsMutating(true);
      setError('');
      const dataBase64 = await toBase64(file);
      const uploaded = await portalApi.uploadAsset({ assetType: `class-location-${id}`, filename: file.name, contentType: file.type, dataBase64 });
      const next = { ...form, logoUrl: uploaded.url };
      await portalApi.updateClassLocation(id, { businessName: next.businessName, locationName: next.locationName, logoUrl: next.logoUrl });
      setForm(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  const isNew = id === 'new';

  return (
    <section className="panel page-section">
      <div className="row spread">
        <h2>{isNew ? 'Add Location' : 'Edit Location'}</h2>
        <Link to="/class-locations">Back</Link>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="grid2">
        <label>
          Business Name
          <input
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            placeholder="e.g. Infinity Fitness"
          />
        </label>
        <label>
          Location
          <input
            value={form.locationName}
            onChange={(e) => setForm({ ...form, locationName: e.target.value })}
            placeholder="e.g. Mission, BC"
          />
        </label>
      </div>
      {!isNew && (
        <div>
          <p>Business Logo <span className="muted">(optional)</span></p>
          <div className="asset-preview-grid">
            <div className="asset-preview-card">
              {form.logoUrl
                ? <img src={`/api/portal/branding?action=asset-image&url=${encodeURIComponent(form.logoUrl)}`} alt="Business logo preview" className="asset-preview-image" />
                : <div className="asset-preview-placeholder">No logo</div>}
            </div>
          </div>
          <label>
            Upload Logo
            <input
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              disabled={isMutating}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }}
            />
          </label>
        </div>
      )}
      {isNew && <p className="muted">Save the location first, then you can upload a logo.</p>}
      <div className="row">
        <button className="button" disabled={isMutating} onClick={() => void save()}>
          {isNew ? 'Save Location' : 'Save Changes'}
        </button>
        <Link to="/class-locations">Cancel</Link>
      </div>
    </section>
  );
}
