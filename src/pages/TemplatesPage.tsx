import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { portalApi } from '../services/portalApi';
import type { Template } from '../types/portal';

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      setTemplates(await portalApi.listTemplates(status));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    let active = true;
    portalApi.listTemplates(status)
      .then((items) => {
        if (!active) return;
        setError('');
        setTemplates(items);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [status]);

  const action = async (id: string, op: 'publish' | 'archive' | 'unarchive' | 'duplicate') => {
    await portalApi.templateAction(id, op);
    await load();
  };

  return (
    <section className="panel page-section">
      <div className="row spread">
        <h2>Templates</h2>
        <Link className="button" to="/templates/new">New Template</Link>
      </div>
      <div className="row">
        <label>Filter
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead><tr><th>Name</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id}>
              <td><Link to={`/templates/${t.id}`}>{t.name}</Link></td>
              <td>{t.status}</td>
              <td>{t.updatedAt}</td>
              <td className="actions">
                <button onClick={() => void action(t.id, 'publish')}>Publish</button>
                <button onClick={() => void action(t.id, 'archive')}>Archive</button>
                <button onClick={() => void action(t.id, 'unarchive')}>Unarchive</button>
                <button onClick={() => void action(t.id, 'duplicate')}>Duplicate</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
