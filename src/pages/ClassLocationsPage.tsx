import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { portalApi } from '../services/portalApi';
import type { ClassLocation } from '../types/portal';

export function ClassLocationsPage() {
  const [locations, setLocations] = useState<ClassLocation[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      setLocations(await portalApi.listClassLocations());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    let active = true;
    portalApi.listClassLocations()
      .then((items) => {
        if (!active) return;
        setError('');
        setLocations(items);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"?`)) return;
    try {
      await portalApi.deleteClassLocation(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const setDefault = async (id: string) => {
    try {
      await portalApi.setDefaultClassLocation(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="panel page-section">
      <div className="row spread">
        <h2>Class Locations</h2>
        <Link className="button" to="/class-locations/new">Add Location</Link>
      </div>
      {error && <p className="error">{error}</p>}
      {locations.length === 0
        ? <p className="muted">No locations yet. Add your first class location.</p>
        : (
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
                      ? <img src={`/api/portal/branding?action=asset-image&url=${encodeURIComponent(loc.logoUrl)}`} alt={`${loc.businessName} logo`} style={{ height: '32px', width: 'auto', verticalAlign: 'middle' }} />
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
        )}
    </section>
  );
}
