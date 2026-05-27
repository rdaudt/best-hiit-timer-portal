import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { portalApi } from '../services/portalApi';
import { queryKeys } from '../services/queryKeys';

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
  isDefault: boolean;
};

const emptyForm = (): FormState => ({ businessName: '', locationName: '', logoUrl: '', isDefault: false });

export function ClassLocationEditorPage() {
  const { id = 'new' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';
  const { data: locationData, error: locationError } = useQuery({
    queryKey: queryKeys.classLocations.detail(id),
    queryFn: () => portalApi.getClassLocation(id),
    enabled: !isNew,
  });

  const [draftForm, setDraftForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState('');
  const [isMutating, setIsMutating] = useState(false);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  const serverForm = useMemo(() => {
    if (!locationData) return null;
    return {
      businessName: locationData.businessName,
      locationName: locationData.locationName,
      logoUrl: locationData.logoUrl,
      isDefault: locationData.isDefault,
    };
  }, [locationData]);

  const form = isNew
    ? draftForm
    : (hasUnsavedEdits ? draftForm : (serverForm ?? draftForm));

  const createMutation = useMutation({
    mutationFn: portalApi.createClassLocation,
    onSuccess: async (created) => {
      queryClient.setQueryData(queryKeys.classLocations.detail(created.id), created);
      await queryClient.invalidateQueries({ queryKey: queryKeys.classLocations.list });
      navigate(`/class-locations/${created.id}`, { replace: true });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ locationId, payload }: { locationId: string; payload: Record<string, unknown> }) =>
      portalApi.updateClassLocation(locationId, payload),
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKeys.classLocations.detail(variables.locationId), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.classLocations.list });
    },
  });

  const defaultMutation = useMutation({
    mutationFn: portalApi.setDefaultClassLocation,
    onSuccess: async (updated, locationId) => {
      queryClient.setQueryData(queryKeys.classLocations.detail(locationId), updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.classLocations.list });
      await queryClient.invalidateQueries({ queryKey: queryKeys.classLocations.detail(locationId) });
    },
  });

  const save = async () => {
    try {
      setIsMutating(true);
      setError('');
      if (isNew) {
        await createMutation.mutateAsync({ businessName: form.businessName, locationName: form.locationName, logoUrl: '' });
      } else {
        await updateMutation.mutateAsync({
          locationId: id,
          payload: { businessName: form.businessName, locationName: form.locationName, logoUrl: form.logoUrl },
        });
        setHasUnsavedEdits(false);
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
      await updateMutation.mutateAsync({
        locationId: id,
        payload: { businessName: next.businessName, locationName: next.locationName, logoUrl: next.logoUrl },
      });
      setHasUnsavedEdits(false);
      setDraftForm(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  const setDefault = async () => {
    try {
      setIsMutating(true);
      setError('');
      await defaultMutation.mutateAsync(id);
      setHasUnsavedEdits(false);
      setDraftForm((f) => ({ ...f, isDefault: true }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  const displayError = error || (locationError ? (locationError as Error).message : '');

  return (
    <section className="panel page-section">
      <div className="row spread">
        <h2>{isNew ? 'Add Location' : 'Edit Location'}</h2>
        <Link to="/class-locations">Back</Link>
      </div>
      {displayError && <p className="error">{displayError}</p>}
      <div className="grid2">
        <label>
          Business Name
          <input
            value={form.businessName}
            onChange={(e) => {
              setHasUnsavedEdits(true);
              setDraftForm({ ...form, businessName: e.target.value });
            }}
            placeholder="e.g. Infinity Fitness"
          />
        </label>
        <label>
          Location
          <input
            value={form.locationName}
            onChange={(e) => {
              setHasUnsavedEdits(true);
              setDraftForm({ ...form, locationName: e.target.value });
            }}
            placeholder="e.g. Mission, BC"
          />
        </label>
      </div>
      {!isNew && (
        <>
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
          <div className="row">
            {form.isDefault
              ? <span className="badge">Default location</span>
              : (
                <button className="button-secondary" disabled={isMutating} onClick={() => void setDefault()}>
                  Set as Default
                </button>
              )}
          </div>
        </>
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
