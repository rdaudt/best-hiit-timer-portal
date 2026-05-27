import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { portalApi } from '../services/portalApi';
import { queryKeys } from '../services/queryKeys';

export function ClassLocationsPage() {
  const queryClient = useQueryClient();
  const { data: locations = [], isLoading, error: queryError, isError } = useQuery({
    queryKey: queryKeys.classLocations.list,
    queryFn: portalApi.listClassLocations,
  });
  const [error, setError] = useState('');

  const deleteMutation = useMutation({
    mutationFn: portalApi.deleteClassLocation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.classLocations.list });
    },
  });

  const defaultMutation = useMutation({
    mutationFn: portalApi.setDefaultClassLocation,
    onSuccess: async (_updated, id) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.classLocations.list });
      await queryClient.invalidateQueries({ queryKey: queryKeys.classLocations.detail(id) });
    },
  });

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"?`)) return;
    try {
      setError('');
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const setDefault = async (id: string) => {
    try {
      setError('');
      await defaultMutation.mutateAsync(id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadError = isError ? (queryError as Error).message : '';
  const displayError = error || loadError;

  return (
    <section className="panel page-section">
      <div className="row spread">
        <h2>Class Locations</h2>
        <Link className="button" to="/class-locations/new">Add Location</Link>
      </div>
      {displayError && <p className="error" role="alert">{displayError}</p>}
      {isLoading && locations.length === 0
        ? <p className="muted">Loading locations...</p>
        : displayError
        ? null
        : locations.length === 0
        ? <p className="muted">No locations yet. Add your first class location.</p>
        : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Location</th>
                  <th>Logo</th>
                  <th>Default</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id}>
                    <td><Link to={`/class-locations/${loc.id}`}>{loc.businessName}</Link></td>
                    <td>{loc.locationName}</td>
                    <td>
                      {loc.logoUrl
                        ? <img src={`/api/portal/branding?action=asset-image&url=${encodeURIComponent(loc.logoUrl)}`} alt={`${loc.businessName} logo`} className="table-logo" />
                        : <span className="muted">&mdash;</span>}
                    </td>
                    <td>
                      {loc.isDefault
                        ? <span className="badge">Default</span>
                        : locations.length > 1 && (
                          <button className="button-small" onClick={() => void setDefault(loc.id)}>Set as Default</button>
                        )}
                    </td>
                    <td>{loc.updatedAt}</td>
                    <td className="actions">
                      <button onClick={() => void remove(loc.id, `${loc.businessName} – ${loc.locationName}`)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}
