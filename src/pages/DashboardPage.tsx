import { useEffect, useState } from 'react';
import { portalApi } from '../services/portalApi';
import type { AnalyticsSummary } from '../types/portal';

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 14);
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  };
}

export function DashboardPage() {
  const [range, setRange] = useState(defaultRange());
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      setData(await portalApi.getAnalyticsSummary(range.dateFrom, range.dateTo));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    let active = true;
    portalApi.getAnalyticsSummary(range.dateFrom, range.dateTo)
      .then((next) => {
        if (!active) return;
        setError('');
        setData(next);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [range.dateFrom, range.dateTo]);

  return (
    <section className="panel page-section">
      <h2>Coach Analytics</h2>
      <div className="row">
        <label>From <input type="date" value={range.dateFrom} onChange={(e) => setRange({ ...range, dateFrom: e.target.value })} /></label>
        <label>To <input type="date" value={range.dateTo} onChange={(e) => setRange({ ...range, dateTo: e.target.value })} /></label>
        <button className="button" onClick={() => void load()}>Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p>Loading...</p>}
      {data && (
        <>
          <div className="cards">
            <article className="metric"><h3>App Opens</h3><p>{data.totals.appOpened}</p></article>
            <article className="metric"><h3>Runs Completed</h3><p>{data.totals.timerRunsCompleted}</p></article>
            <article className="metric"><h3>Runs Incomplete</h3><p>{data.totals.timerRunsIncomplete}</p></article>
            <article className="metric"><h3>Template Starts</h3><p>{data.totals.timersCreatedFromTemplates}</p></article>
          </div>
          <h3>Daily Trend</h3>
          <table className="table">
            <thead><tr><th>Day</th><th>Opens</th><th>Completed</th><th>Incomplete</th></tr></thead>
            <tbody>
              {data.trend.map((item) => (
                <tr key={item.dayUtc}><td>{item.dayUtc}</td><td>{item.appOpened}</td><td>{item.runsCompleted}</td><td>{item.runsIncomplete}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
