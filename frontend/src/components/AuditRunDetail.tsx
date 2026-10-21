import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Download, Copy, AlertTriangle, CheckCircle, XCircle, Clock, FileText, Play, RotateCw, Loader2 } from 'lucide-react';
import { api } from '@/api/client';
import { type AuditResults, type PillarScore, type InspectionResult } from '@/types/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GradeBadge } from '@/components/ui/GradeBadge';
import { Badge, type LucideIcon } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';

export function AuditRunDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: run, isLoading: runLoading, isError: runError } = useQuery({
    queryKey: ['audit-run', id],
    queryFn: () => api.getAuditRun(id!),
    enabled: !!id,
  });

  if (runLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (runError || !run) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-[var(--color-danger)] mb-4" aria-hidden="true" />
          <h2 className="text-xl font-semibold mb-2">Audit Run Not Found</h2>
          <p className="text-[var(--color-text-muted)] mb-6">The audit run you're looking for doesn't exist.</p>
          <Link to="/audit-runs" className="btn btn-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Audit Runs
          </Link>
        </div>
      </div>
    );
  }

  const canExecute = run.status === 'pending' || run.status === 'failed';
  const isRunning = run.status === 'running';

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to="/audit-runs" className="btn btn-ghost" aria-label="Back to audit runs">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="page-title">{run.name}</h1>
            <p className="page-description">
              Suite: {run.suite} &bull; Fixture: {run.fixture_id?.slice(0, 8)}... &bull; Provider: {run.provider_config_id?.slice(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : run.status === 'running' ? 'warning' : 'neutral'}>
            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
          </Badge>
          {run.results && (
            <GradeBadge grade={run.results.grade} size="md" />
          )}
          {canExecute && (
            <ExecuteButton runId={run.id} isRunning={isRunning} />
          )}
        </div>
      </div>

      <div className="grid grid-4 gap-4">
        <MetaCard label="Created" value={formatDistanceToNow(new Date(run.created_at), { addSuffix: true })} icon={Clock} />
        <MetaCard label="Updated" value={formatDistanceToNow(new Date(run.updated_at), { addSuffix: true })} icon={Clock} />
        <MetaCard
          label="Duration"
          value={run.started_at && run.completed_at
            ? `${((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
            : run.started_at ? 'Running...' : '\u2014'}
          icon={Clock}
        />
        <MetaCard label="Suite" value={run.suite} icon={FileText} />
      </div>

      {run.error_message && (
        <div className="card border-[var(--color-danger)]">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[var(--color-danger)] flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-[var(--color-danger)]">Execution Error</h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">{run.error_message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {run.results && (
        <>
          <section className="card">
            <div className="card-header">
              <h2 className="section-title">Audit Results</h2>
            </div>
            <div className="card-body">
              <ResultsSummary results={run.results} />
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="section-title">Pillar Breakdown</h2>
            </div>
            <div className="card-body">
              <PillarScores pillars={run.results.pillar_scores} />
            </div>
          </section>

          <section className="card">
            <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="section-title">Inspection Details</h2>
              <div className="flex items-center gap-2">
                <button className="btn btn-secondary btn-sm" onClick={handleExportResults}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export JSON
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleCopyResults}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy
                </button>
              </div>
            </div>
            <div className="card-body">
              <InspectionsTable inspections={run.results.inspections} mandatoryMinimums={run.results.mandatory_minimums} />
            </div>
          </section>
        </>
      )}

      {!run.results && run.status !== 'pending' && run.status !== 'running' && (
        <div className="card">
          <div className="card-body text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-[var(--color-text-muted)] mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium mb-2">No Results Available</h3>
            <p className="text-[var(--color-text-muted)]">This audit run completed but no results were generated.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ExecuteButton({ runId, isRunning }: { runId: string; isRunning: boolean }) {
  const [executing, setExecuting] = useState(false);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await api.executeAuditRun(runId);
      window.location.reload();
    } catch (e) {
      console.error('Failed to execute audit run:', e);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <button
      className="btn btn-primary"
      onClick={handleExecute}
      disabled={executing || isRunning}
    >
      {executing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Executing...
        </>
      ) : isRunning ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Running...
        </>
      ) : runId.includes('failed') ? (
        <>
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Re-run
        </>
      ) : (
        <>
          <Play className="h-4 w-4" aria-hidden="true" />
          Execute
        </>
      )}
    </button>
  );
}

function MetaCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
            <p className="font-medium">{value}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsSummary({ results }: { results: AuditResults }) {
  const gradeLabels: Record<'A' | 'B' | 'C' | 'D' | 'F', string> = {
    A: 'Excellent \u2014 Agent meets high standards across all pillars',
    B: 'Good \u2014 Minor issues detected, generally reliable',
    C: 'Acceptable \u2014 Notable gaps in multiple areas',
    D: 'Poor \u2014 Significant issues requiring attention',
    F: 'Failing \u2014 Critical failures in mandatory minimums',
  };

  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
      <div className="flex items-center gap-6">
        <GradeBadge grade={results.grade} size="lg" />
        <div>
          <p className="text-2xl font-bold">{results.overall_score >= 0.85 ? 'PASS' : 'FAIL'}</p>
          <p className="text-[var(--color-text-muted)]">{gradeLabels[results.grade]}</p>
          {results.grade_capped && (
            <p className="text-sm text-[var(--color-warning)] mt-1 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Grade capped at 60% due to mandatory minimum failure
            </p>
          )}
        </div>
      </div>
      <div className="text-right lg:text-left">
        <p className="text-3xl font-bold tabular-nums">
          {(results.overall_score * 100).toFixed(1)}%
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">Overall Score</p>
        <div className="mt-2 h-2 w-48 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${results.overall_score * 100}%`,
              background: results.overall_score >= 0.85 ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PillarScores({ pillars }: { pillars: PillarScore[] }) {
  return (
    <div className="grid grid-2 lg:grid-5 gap-4">
      {pillars.map((pillar) => (
        <div key={pillar.name} className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">{pillar.name}</h3>
            <span className="text-sm font-mono tabular-nums">
              {(pillar.score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pillar.score * 100}%`,
                background: pillar.score >= 0.85 ? 'var(--color-success)' : pillar.score >= 0.6 ? 'var(--color-warning)' : 'var(--color-danger)',
              }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {pillar.inspections_passed} / {pillar.inspections_total} passed \u2022 Weight: {(pillar.weight * 100).toFixed(0)}%
          </p>
        </div>
      ))}
    </div>
  );
}

const handleExportResults = () => {
  console.log('Export results');
};

const handleCopyResults = () => {
  console.log('Copy results');
};

function InspectionsTable({
  inspections,
  mandatoryMinimums,
}: {
  inspections: InspectionResult[];
  mandatoryMinimums: Record<string, boolean>;
}) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'pillar', direction: 'asc' });
  const [filterPillar, setFilterPillar] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const pillars = [...new Set(inspections.map(i => i.pillar))].sort();
  const statuses = ['pass', 'fail', 'partial', 'insufficient_evidence', 'error'] as const;

  const filtered = inspections
    .filter(i => filterPillar === 'all' || i.pillar === filterPillar)
    .filter(i => filterStatus === 'all' || i.status === filterStatus)
    .sort((a, b) => {
      const aVal = a[sortConfig.key as keyof InspectionResult];
      const bVal = b[sortConfig.key as keyof InspectionResult];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const statusVariants: Record<InspectionResult['status'], 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    pass: 'success',
    fail: 'danger',
    partial: 'warning',
    insufficient_evidence: 'info',
    error: 'danger',
  };

  const statusIcons: Record<InspectionResult['status'], LucideIcon> = {
    pass: CheckCircle,
    fail: XCircle,
    partial: AlertTriangle,
    insufficient_evidence: FileText,
    error: AlertTriangle,
  };

  const handleSort = (key: string) => {
    setSortConfig((prev: { key: string; direction: 'asc' | 'desc' }) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-4">
        <select
          value={filterPillar}
          onChange={e => setFilterPillar(e.target.value)}
          className="form-input form-select w-48"
          aria-label="Filter by pillar"
        >
          <option value="all">All Pillars</option>
          {pillars.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="form-input form-select w-48"
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('id')}>
                ID
                {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 inline" aria-hidden="true" />)}
              </th>
              <th onClick={() => handleSort('pillar')}>
                Pillar
                {sortConfig.key === 'pillar' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 inline" aria-hidden="true" />)}
              </th>
              <th onClick={() => handleSort('category')}>
                Category
                {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 inline" aria-hidden="true" />)}
              </th>
              <th onClick={() => handleSort('status')}>
                Status
                {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 inline" aria-hidden="true" />)}
              </th>
              <th onClick={() => handleSort('score')}>
                Score
                {sortConfig.key === 'score' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 inline" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 inline" aria-hidden="true" />)}
              </th>
              <th>Mandatory</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inspection) => (
              <tr key={inspection.id}>
                <td className="font-mono text-sm">{inspection.id}</td>
                <td>{inspection.pillar}</td>
                <td className="text-[var(--color-text-muted)]">{inspection.category}</td>
                <td>
                  <Badge variant={statusVariants[inspection.status]} Icon={statusIcons[inspection.status]}>
                    {inspection.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="font-mono tabular-nums">
                  {(inspection.score * 100).toFixed(1)}%
                </td>
                <td>
                  {inspection.is_mandatory_minimum && (
                    <Badge variant={mandatoryMinimums[inspection.id] ? 'success' : 'danger'} Icon={mandatoryMinimums[inspection.id] ? CheckCircle : XCircle}>
                      {mandatoryMinimums[inspection.id] ? 'Pass' : 'Fail'}
                    </Badge>
                  )}
                </td>
                <td>
                  {inspection.details && (
                    <span className="text-sm text-[var(--color-text-muted)] max-w-xs truncate block" title={inspection.details}>
                      {inspection.details}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <FileText className="empty-state-icon h-12 w-12" aria-hidden="true" />
          <p>No inspections match your filters</p>
        </div>
      )}
    </div>
  );
}