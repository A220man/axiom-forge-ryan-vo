import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, Database, Server, TrendingUp, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '@/api/client';
import { type AuditRun } from '@/types/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GradeBadge } from '@/components/ui/GradeBadge';
import { Badge, type LucideIcon } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';

export function Dashboard() {
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['audit-runs', 'recent'],
    queryFn: () => api.listAuditRuns(1, 5),
    select: (data) => data.items,
  });

  const { data: fixtures, isLoading: fixturesLoading } = useQuery({
    queryKey: ['fixtures', 'recent'],
    queryFn: () => api.listFixtures(1, 5),
    select: (data) => data.items,
  });

  const { data: providers, isLoading: providersLoading } = useQuery({
    queryKey: ['providers', 'recent'],
    queryFn: () => api.listProviders(1, 5),
    select: (data) => data.items,
  });

  const stats = runsLoading ? null : calculateStats(runs);

  if (runsLoading || fixturesLoading || providersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Overview of your AI agent audits</p>
        </div>
      </div>

      <div className="grid grid-4 gap-4">
        <StatCard
          title="Total Runs"
          value={stats?.totalRuns ?? 0}
          Icon={ClipboardList}
          color="var(--color-primary)"
          trend={stats?.successRate !== undefined ? `${stats.successRate}% pass rate` : undefined}
        />
        <StatCard
          title="Completed"
          value={stats?.completed ?? 0}
          Icon={CheckCircle}
          color="var(--color-success)"
        />
        <StatCard
          title="Failed"
          value={stats?.failed ?? 0}
          Icon={XCircle}
          color="var(--color-danger)"
        />
        <StatCard
          title="Running"
          value={stats?.running ?? 0}
          Icon={Clock}
          color="var(--color-warning)"
        />
      </div>

      <div className="grid grid-2 gap-6">
        <section className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="section-title">Recent Audit Runs</h2>
            <Link to="/audit-runs" className="btn btn-secondary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Run
            </Link>
          </div>
          <div className="card-body">
            {runs?.length === 0 ? (
              <div className="empty-state">
                <ClipboardList className="empty-state-icon h-12 w-12" aria-hidden="true" />
                <p>No audit runs yet</p>
                <Link to="/audit-runs" className="btn btn-primary mt-4">
                  Create your first audit run
                </Link>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Suite</th>
                      <th>Status</th>
                      <th>Grade</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs?.map((run) => (
                      <tr key={run.id}>
                        <td>
                          <Link to={`/audit-runs/${run.id}`} className="font-medium hover:text-[var(--color-primary)]">
                            {run.name}
                          </Link>
                        </td>
                        <td><Badge variant="neutral">{run.suite}</Badge></td>
                        <td>{renderStatusBadge(run.status)}</td>
                        <td>
                          {run.results ? (
                            <GradeBadge grade={run.results.grade} size="sm" />
                          ) : (
                            <span className="text-[var(--color-text-muted)]">\u2014</span>
                          )}
                        </td>
                        <td className="text-[var(--color-text-muted)] text-sm">
                          {formatDistanceToNow(new Date(run.updated_at), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="section-title">Quick Actions</h2>
          </div>
          <div className="card-body space-y-3">
            <Link to="/audit-runs" className="btn btn-primary w-full justify-start gap-3">
              <Plus className="h-5 w-5" aria-hidden="true" />
              <span>Create New Audit Run</span>
            </Link>
            <Link to="/fixtures" className="btn btn-secondary w-full justify-start gap-3">
              <Database className="h-5 w-5" aria-hidden="true" />
              <span>Manage Fixtures</span>
            </Link>
            <Link to="/providers" className="btn btn-secondary w-full justify-start gap-3">
              <Server className="h-5 w-5" aria-hidden="true" />
              <span>Configure Providers</span>
            </Link>
          </div>
        </section>
      </div>

      <div className="grid grid-2 gap-6">
        <section className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="section-title">Recent Fixtures</h2>
            <Link to="/fixtures" className="btn btn-secondary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Fixture
            </Link>
          </div>
          <div className="card-body">
            {fixtures?.length === 0 ? (
              <div className="empty-state">
                <Database className="empty-state-icon h-12 w-12" aria-hidden="true" />
                <p>No fixtures created</p>
                <Link to="/fixtures" className="btn btn-primary mt-4 btn-sm">
                  Create Fixture
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {fixtures?.map((fixture) => (
                  <li key={fixture.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                    <Link to={`/fixtures/${fixture.id}`} className="font-medium hover:text-[var(--color-primary)]">
                      {fixture.name}
                    </Link>
                    <span className="text-sm text-[var(--color-text-muted)]">v{fixture.version}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="section-title">Active Providers</h2>
            <Link to="/providers" className="btn btn-secondary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Provider
            </Link>
          </div>
          <div className="card-body">
            {providers?.length === 0 ? (
              <div className="empty-state">
                <Server className="empty-state-icon h-12 w-12" aria-hidden="true" />
                <p>No providers configured</p>
                <Link to="/providers" className="btn btn-primary mt-4 btn-sm">
                  Add Provider
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {providers?.filter(p => p.is_active).map((provider) => (
                  <li key={provider.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                        {getProviderIcon(provider.provider_type)}
                      </span>
                      <div>
                        <p className="font-medium">{provider.name}</p>
                        <p className="text-sm text-[var(--color-text-muted)]">{provider.model}</p>
                      </div>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function calculateStats(runs: AuditRun[] | undefined) {
  if (!runs || runs.length === 0) return null;
  const completed = runs.filter(r => r.status === 'completed').length;
  const failed = runs.filter(r => r.status === 'failed').length;
  const running = runs.filter(r => r.status === 'running').length;
  const withResults = runs.filter(r => r.results);
  const passed = withResults.filter(r => r.results!.grade === 'A' || r.results!.grade === 'B').length;
  const successRate = withResults.length > 0 ? Math.round((passed / withResults.length) * 100) : 0;
  return { totalRuns: runs.length, completed, failed, running, successRate };
}

function renderStatusBadge(status: AuditRun['status']) {
  const variants: Record<AuditRun['status'], 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    pending: 'neutral',
    running: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'neutral',
  };
  const Icons: Record<AuditRun['status'], LucideIcon> = {
    pending: Clock,
    running: TrendingUp,
    completed: CheckCircle,
    failed: XCircle,
    cancelled: AlertTriangle,
  };
  return (
    <Badge variant={variants[status]} Icon={Icons[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function getProviderIcon(_type: string) {
  return <Server className="h-4 w-4" aria-hidden="true" />;
}

function StatCard({
  title,
  value,
  Icon,
  color,
  trend,
}: {
  title: string;
  value: number;
  Icon: React.ElementType,
  color: string;
  trend?: string;
}) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">{title}</p>
            <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
            {trend && <p className="text-sm text-[var(--color-text-muted)] mt-1">{trend}</p>}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: `${color}15` }}>
            <Icon className="h-6 w-6" aria-hidden="true" style={{ color }} />
          </div>
        </div>
      </div>
    </div>
  );
}