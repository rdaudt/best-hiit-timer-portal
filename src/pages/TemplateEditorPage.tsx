import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { portalApi } from '../services/portalApi';

type FormState = {
  name: string;
  stationCount: number;
  stationWorkoutTypes: string;
  roundsPerStation: number;
  workMinutes: number;
  workSeconds: number;
  restMinutes: number;
  restSeconds: number;
  stationTransitionMinutes: number;
  stationTransitionSeconds: number;
  startStationWorkManually: boolean;
  warmupEnabled: boolean;
  warmupMinutes: number;
  warmupSeconds: number;
  cooldownEnabled: boolean;
  cooldownMinutes: number;
  cooldownSeconds: number;
  expectedUpdatedAt: string;
};

const emptyForm = (): FormState => ({
  name: '', stationCount: 1, stationWorkoutTypes: '', roundsPerStation: 1,
  workMinutes: 0, workSeconds: 30, restMinutes: 0, restSeconds: 30,
  stationTransitionMinutes: 0, stationTransitionSeconds: 15,
  startStationWorkManually: false, warmupEnabled: false, warmupMinutes: 0, warmupSeconds: 0,
  cooldownEnabled: false, cooldownMinutes: 0, cooldownSeconds: 0, expectedUpdatedAt: '',
});

export function TemplateEditorPage() {
  const { id = 'new' } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState('');

  useEffect(() => {
    if (id === 'new') return;
    void (async () => {
      const data = await portalApi.getTemplate(id);
      setForm({
        name: data.name,
        stationCount: data.stationCount,
        stationWorkoutTypes: data.stationWorkoutTypes.join(', '),
        roundsPerStation: data.roundsPerStation,
        workMinutes: data.workMinutes,
        workSeconds: data.workSeconds,
        restMinutes: data.restMinutes,
        restSeconds: data.restSeconds,
        stationTransitionMinutes: data.stationTransitionMinutes,
        stationTransitionSeconds: data.stationTransitionSeconds,
        startStationWorkManually: data.startStationWorkManually,
        warmupEnabled: data.warmupEnabled,
        warmupMinutes: data.warmupMinutes,
        warmupSeconds: data.warmupSeconds,
        cooldownEnabled: data.cooldownEnabled,
        cooldownMinutes: data.cooldownMinutes,
        cooldownSeconds: data.cooldownSeconds,
        expectedUpdatedAt: data.updatedAt,
      });
    })();
  }, [id]);

  const save = async () => {
    try {
      setError('');
      const payload = {
        ...form,
        stationWorkoutTypes: form.stationWorkoutTypes.split(',').map((item) => item.trim()).filter(Boolean),
      };
      if (id === 'new') {
        await portalApi.createTemplate(payload);
      } else {
        await portalApi.updateTemplate(id, payload);
      }
      navigate('/templates');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="panel page-section">
      <div className="row spread"><h2>{id === 'new' ? 'Create Template' : 'Edit Template'}</h2><Link to="/templates">Back</Link></div>
      {error && <p className="error">{error}</p>}
      <div className="grid2">
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Station Count<input type="number" value={form.stationCount} onChange={(e) => setForm({ ...form, stationCount: Number(e.target.value) })} /></label>
        <label>Rounds/Station<input type="number" value={form.roundsPerStation} onChange={(e) => setForm({ ...form, roundsPerStation: Number(e.target.value) })} /></label>
        <label>Workout Types (comma separated)<input value={form.stationWorkoutTypes} onChange={(e) => setForm({ ...form, stationWorkoutTypes: e.target.value })} /></label>
        <label>Work Min<input type="number" value={form.workMinutes} onChange={(e) => setForm({ ...form, workMinutes: Number(e.target.value) })} /></label>
        <label>Work Sec<input type="number" value={form.workSeconds} onChange={(e) => setForm({ ...form, workSeconds: Number(e.target.value) })} /></label>
        <label>Rest Min<input type="number" value={form.restMinutes} onChange={(e) => setForm({ ...form, restMinutes: Number(e.target.value) })} /></label>
        <label>Rest Sec<input type="number" value={form.restSeconds} onChange={(e) => setForm({ ...form, restSeconds: Number(e.target.value) })} /></label>
      </div>
      <div className="row">
        <label><input type="checkbox" checked={form.startStationWorkManually} onChange={(e) => setForm({ ...form, startStationWorkManually: e.target.checked })} /> Start manually</label>
        <label><input type="checkbox" checked={form.warmupEnabled} onChange={(e) => setForm({ ...form, warmupEnabled: e.target.checked })} /> Warmup</label>
        <label><input type="checkbox" checked={form.cooldownEnabled} onChange={(e) => setForm({ ...form, cooldownEnabled: e.target.checked })} /> Cooldown</label>
      </div>
      <button className="button" onClick={() => void save()}>Save Template</button>
    </section>
  );
}