import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { Plus, Search, Filter, Play, Eye, Loader2 } from 'lucide-react';
import { api } from '@/api/client';
import { type AuditRun, type AuditRunCreate } from '@/types/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GradeBadge } from '@/components/ui/GradeBadge';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';

export function AuditRunsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-runs', page, 20, statusFilter, search],
    queryFn: () => api.listAuditRuns(page, 20, statusFilter || undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: AuditRunCreate) => api.createAuditRun(data),
    onSuccess: (newRun) => {
      queryClient.invalidateQueries({ queryKey: ['audit-runs'] });
      navigate(`/audit-runs/${newRun.id}`);
    },
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) => api.executeAuditRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-runs'] });
    },
  });


  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fixtureId = formData.get('fixture_id') as string;
    const providerId = formData.get('provider_config_id') as string;
    const name = formData.get('name') as string;
    const suite = formData.get('suite') as AuditRunCreate['suite'] || 'essential';

    if (!fixtureId || !providerId || !name) return;

    await createMutation.mutateAsync({ name, fixture_id: fixtureId, provider_config_id: providerId, suite });
  };

  if (isLoading && page === 1) {
    return <LoadingSpinner size={32} />;
  }

  const runs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Audit Runs</h1>
          <p className="page-description">Manage and execute AI agent audit runs</p>
        </div>
        <button
          className="btn btn-primary"
          data-modal-target="create-run-modal"
          aria-haspopup="dialog"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Audit Run
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-4 gap-4">
              <div className="form-group">
                <label htmlFor="name" className="form-label">Run Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="form-input"
                  placeholder="e.g., Customer Support Agent Audit"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="fixture_id" className="form-label">Fixture *</label>
                <FixtureSelect name="fixture_id" required />
              </div>
              <div className="form-group">
                <label htmlFor="provider_config_id" className="form-label">Provider *</label>
                <ProviderSelect name="provider_config_id" required />
              </div>
              <div className="form-group">
                <label htmlFor="suite" className="form-label">Suite</label>
                <select id="suite" name="suite" className="form-input form-select">
                  <option value="smoke">Smoke (3 tests)</option>
                  <option value="strategic">Strategic (8 tests)</option>
                  <option value="essential" selected>Essential (10 tests)</option>
                  <option value="core">Core (32 tests)</option>
                  <option value="extended">Extended (28 tests)</option>
                  <option value="all">All (60 tests)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
              <button type="button" className="btn btn-secondary" data-modal-close>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create & Run
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search runs..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10 w-64"
                aria-label="Search audit runs"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="form-input form-select pl-10 w-40"
                aria-label="Filter by status"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            Showing {runs.length} of {total} runs
          </div>
        </div>
        <div className="card-body p-0">
          {runs.length === 0 ? (
            <div className="empty-state h-64">
              <ClipboardList className="empty-state-icon h-12 w-12" aria-hidden="true" />
              <p>{search || statusFilter ? 'No runs match your filters' : 'No audit runs yet'}</p>
              {!search && !statusFilter && (
                <button className="btn btn-primary mt-4" data-modal-target="create-run-modal">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create Your First Run
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>Name</th>
                      <th style={{ width: '12%' }}>Suite</th>
                      <th style={{ width: '12%' }}>Status</th>
                      <th style={{ width: '10%' }}>Grade</th>
                      <th style={{ width: '15%' }}>Duration</th>
                      <th style={{ width: '15%' }}>Updated</th>
                      <th style={{ width: '6%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <AuditRunRow
                        key={run.id}
                        run={run}
                        onExecute={executeMutation.mutateAsync}
                        isExecuting={executeMutation.variables === run.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-[var(--color-border)]">
                  <div className="text-sm text-[var(--color-text-muted)]">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CreateRunModal
        isOpen={false}
        onClose={() => {}}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
      />
    </div>
  );
}

function FixtureSelect({ name, required }: { name: string; required?: boolean }) {
  const { data } = useQuery({
    queryKey: ['fixtures', 'all'],
    queryFn: () => api.listFixtures(1, 100),
    select: (data) => data.items,
  });

  return (
    <select name={name} className="form-input form-select" required={required} aria-required={required}>
      <option value="">Select a fixture</option>
      {data?.map((fixture) => (
        <option key={fixture.id} value={fixture.id}>{fixture.name}</option>
      ))}
    </select>
  );
}

function ProviderSelect({ name, required }: { name: string; required?: boolean }) {
  const { data } = useQuery({
    queryKey: ['providers', 'active'],
    queryFn: () => api.listProviders(1, 100, undefined, true),
    select: (data) => data.items,
  });

  return (
    <select name={name} className="form-input form-select" required={required} aria-required={required}>
      <option value="">Select a provider</option>
      {data?.map((provider) => (
        <option key={provider.id} value={provider.id}>{provider.name} ({provider.model})</option>
      ))}
    </select>
  );
}

function AuditRunRow({
  run,
  onExecute,
  isExecuting,
}: {
  run: AuditRun;
  onExecute: (id: string) => Promise<AuditRun>;
  isExecuting: boolean;
}) {
  const statusVariants: Record<AuditRun['status'], 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    pending: 'neutral',
    running: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'neutral',
  };

  const canExecute = run.status === 'pending' || run.status === 'failed';

  return (
    <tr>
      <td>
        <Link to={`/audit-runs/${run.id}`} className="font-medium hover:text-[var(--color-primary)]">
          {run.name}
        </Link>
      </td>
      <td><Badge variant="neutral">{run.suite}</Badge></td>
      <td><Badge variant={statusVariants[run.status]}>{run.status}</Badge></td>
      <td>
        {run.results ? (
          <GradeBadge grade={run.results.grade} size="sm" />
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        )}
      </td>
      <td className="text-[var(--color-text-muted)] text-sm">
        {run.started_at && run.completed_at ? (
          `${((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s`
        ) : run.started_at ? (
          'Running...'
        ) : (
          '—'
        )}
      </td>
      <td className="text-[var(--color-text-muted)] text-sm">
        {formatDistanceToNow(new Date(run.updated_at), { addSuffix: true })}
      </td>
      <td>
        <div className="flex items-center gap-2">
          <Link to={`/audit-runs/${run.id}`} className="btn btn-ghost btn-sm" aria-label="View details">
            <Eye className="h-4 w-4" aria-hidden="true" />
          </Link>
          {canExecute && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { onExecute(run.id); }}
              disabled={isExecuting}
              aria-label={run.status === 'failed' ? 'Re-run audit' : 'Execute audit'}
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function CreateRunModal({
  isOpen,
  onClose,
  onSubmit,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isPending: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="create-run-title">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--color-surface)] rounded-xl shadow-xl border border-[var(--color-border)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 id="create-run-title" className="text-lg font-semibold">Create New Audit Run</h2>
          <button onClick={onClose} className="btn btn-ghost" aria-label="Close modal">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="grid grid-2 gap-4">
            <div className="form-group">
              <label htmlFor="modal-name" className="form-label">Run Name *</label>
              <input type="text" id="modal-name" name="name" className="form-input" required />
            </div>
            <div className="form-group">
              <label htmlFor="modal-suite" className="form-label">Suite</label>
              <select id="modal-suite" name="suite" className="form-input form-select">
                <option value="smoke">Smoke (3 tests)</option>
                <option value="strategic">Strategic (8 tests)</option>
                <option value="essential" selected>Essential (10 tests)</option>
                <option value="core">Core (32 tests)</option>
                <option value="extended">Extended (28 tests)</option>
                <option value="all">All (60 tests)</option>
              </select>
            </div>
            <div className="form-group col-span-2">
              <label htmlFor="modal-fixture" className="form-label">Fixture *</label>
              <FixtureSelect name="fixture_id" required />
            </div>
            <div className="form-group col-span-2">
              <label htmlFor="modal-provider" className="form-label">Provider *</label>
              <ProviderSelect name="provider_config_id" required />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isPending}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create & Run
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}