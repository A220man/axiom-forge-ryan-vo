import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, Copy, Download, FileText } from 'lucide-react';
import { api } from '@/api/client';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';

export function FixtureDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: fixture, isLoading, error } = useQuery({
    queryKey: ['fixture', id],
    queryFn: () => api.getFixture(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <LoadingSpinner size={32} />;
  }

  if (error || !fixture) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-[var(--color-danger)] mb-4" aria-hidden="true" />
          <h2 className="text-xl font-semibold mb-2">Fixture Not Found</h2>
          <p className="text-[var(--color-text-muted)] mb-6">The fixture you're looking for doesn't exist.</p>
          <Link to="/fixtures" className="btn btn-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Fixtures
          </Link>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(fixture.content, null, 2));
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(fixture.content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fixture.name.replace(/\s+/g, '_')}_v${fixture.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to="/fixtures" className="btn btn-ghost" aria-label="Back to fixtures">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="page-title">{fixture.name}</h1>
            <p className="page-description">Version {fixture.version} &bull; Schema {fixture.schema_version}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="neutral">v{fixture.version}</Badge>
          <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy JSON
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download
          </button>
          <Link to={`/fixtures/${fixture.id}/edit`} className="btn btn-primary btn-sm">
            <Edit className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-3 gap-4">
        <MetaCard label="Created" value={formatDistanceToNow(new Date(fixture.created_at), { addSuffix: true })} icon={FileText} />
        <MetaCard label="Updated" value={formatDistanceToNow(new Date(fixture.updated_at), { addSuffix: true })} icon={FileText} />
        <MetaCard label="Schema Version" value={fixture.schema_version} icon={FileText} />
      </div>

      {fixture.description && (
        <div className="card">
          <div className="card-header">
            <h2 className="section-title">Description</h2>
          </div>
          <div className="card-body">
            <p className="text-[var(--color-text-muted)]">{fixture.description}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="section-title">Fixture Content</h2>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </button>
          </div>
        </div>
        <div className="card-body">
          <pre className="bg-[var(--color-bg)] p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-[500px] overflow-y-auto">
            <code>{JSON.stringify(fixture.content, null, 2)}</code>
          </pre>
        </div>
      </div>

      {fixture.content.tests && Array.isArray(fixture.content.tests) && fixture.content.tests.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="section-title">Tests ({fixture.content.tests.length})</h2>
          </div>
          <div className="card-body p-0">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>#</th>
                    <th style={{ width: '30%' }}>ID</th>
                    <th style={{ width: '30%' }}>Prompt Preview</th>
                    <th style={{ width: '30%' }}>Expected Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {fixture.content.tests.map((test: unknown, index: number) => {
                    const t = test as Record<string, unknown>;
                    const prompt = String(t.prompt ?? '');
                    const expected = String(t.expected ?? '');
                    const id = String(t.id ?? '');
                    return (
                      <tr key={id || String(index)}>
                        <td className="text-[var(--color-text-muted)]">{index + 1}</td>
                        <td className="font-mono text-sm">{id || '\u2014'}</td>
                        <td className="text-sm max-w-xs truncate" title={prompt}>{prompt || '\u2014'}</td>
                        <td className="text-sm max-w-xs truncate" title={expected}>{expected || '\u2014'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
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