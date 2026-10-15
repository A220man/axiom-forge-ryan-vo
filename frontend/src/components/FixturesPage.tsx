import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/api/client';
import { type Fixture, type FixtureCreate, type FixtureUpdate } from '@/types/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';

export function FixturesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFixture, setEditingFixture] = useState<Fixture | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['fixtures', page, 20, search],
    queryFn: () => api.listFixtures(page, 20, search || undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: FixtureCreate) => api.createFixture(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      setShowCreateModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FixtureUpdate }) => api.updateFixture(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      setEditingFixture(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFixture(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
    },
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const content = formData.get('content') as string;

    if (!name || !content) return;

    try {
      const parsedContent = JSON.parse(content);
      await createMutation.mutateAsync({ name, description, content: parsedContent });
    } catch {
      alert('Invalid JSON in content field');
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingFixture) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const content = formData.get('content') as string;

    if (!name || !content) return;

    try {
      const parsedContent = JSON.parse(content);
      await updateMutation.mutateAsync({ id: editingFixture.id, data: { name, description, content: parsedContent } });
    } catch {
      alert('Invalid JSON in content field');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this fixture?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  if (isLoading && page === 1) {
    return <LoadingSpinner size={32} />;
  }

  const fixtures = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Fixtures</h1>
          <p className="page-description">Manage test fixtures for AI agent auditing</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Fixture
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search fixtures..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
                aria-label="Search fixtures"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {fixtures.length === 0 ? (
            <div className="empty-state h-64">
              <FileText className="empty-state-icon h-12 w-12" aria-hidden="true" />
              <p>{search ? 'No fixtures match your search' : 'No fixtures created yet'}</p>
              {!search && (
                <button className="btn btn-primary mt-4" onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create Your First Fixture
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>Name</th>
                      <th style={{ width: '25%' }}>Description</th>
                      <th style={{ width: '10%' }}>Version</th>
                      <th style={{ width: '15%' }}>Updated</th>
                      <th style={{ width: '15%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixtures.map((fixture) => (
                      <FixtureRow
                        key={fixture.id}
                        fixture={fixture}
                        onEdit={setEditingFixture}
                        onDelete={handleDelete}
                        isDeleting={deleteMutation.variables === fixture.id}
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

      {showCreateModal && (
        <FixtureModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          isPending={createMutation.isPending}
        />
      )}

      {editingFixture && (
        <FixtureModal
          fixture={editingFixture}
          onClose={() => setEditingFixture(null)}
          onSubmit={handleUpdate}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function FixtureRow({
  fixture,
  onEdit,
  onDelete,
  isDeleting,
}: {
  fixture: Fixture;
  onEdit: (fixture: Fixture) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  return (
    <tr>
      <td>
        <Link to={`/fixtures/${fixture.id}`} className="font-medium hover:text-[var(--color-primary)]">
          {fixture.name}
        </Link>
      </td>
      <td className="text-[var(--color-text-muted)] truncate max-w-xs">
        {fixture.description || '—'}
      </td>
      <td><Badge variant="neutral">v{fixture.version}</Badge></td>
      <td className="text-[var(--color-text-muted)] text-sm">
        {formatDistanceToNow(new Date(fixture.updated_at), { addSuffix: true })}
      </td>
      <td>
        <div className="flex items-center gap-2">
          <Link to={`/fixtures/${fixture.id}`} className="btn btn-ghost btn-sm" aria-label="View details">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(fixture)} aria-label="Edit fixture">
            <Edit className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            className="btn btn-ghost btn-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]"
            onClick={() => onDelete(fixture.id)}
            disabled={isDeleting}
            aria-label="Delete fixture"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

function FixtureModal({
  fixture,
  onClose,
  onSubmit,
  isPending,
}: {
  fixture?: Fixture;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isPending: boolean;
}) {
  const isEditing = !!fixture;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby={isEditing ? 'edit-fixture-title' : 'create-fixture-title'}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[var(--color-surface)] rounded-xl shadow-xl border border-[var(--color-border)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 id={isEditing ? 'edit-fixture-title' : 'create-fixture-title'} className="text-lg font-semibold">
            {isEditing ? 'Edit Fixture' : 'Create New Fixture'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost" aria-label="Close modal">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="form-group">
            <label htmlFor="fixture-name" className="form-label">Name *</label>
            <input
              type="text"
              id="fixture-name"
              name="name"
              className="form-input"
              defaultValue={fixture?.name}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="fixture-description" className="form-label">Description</label>
            <textarea
              id="fixture-description"
              name="description"
              className="form-input"
              rows={3}
              defaultValue={fixture?.description ?? ''}
            />
          </div>
          <div className="form-group">
            <label htmlFor="fixture-content" className="form-label">Content (JSON) *</label>
            <textarea
              id="fixture-content"
              name="content"
              className="form-input font-mono text-sm"
              rows={15}
              defaultValue={fixture ? JSON.stringify(fixture.content, null, 2) : JSON.stringify({
                metadata: { name: '', version: '1.0', description: '' },
                tests: []
              }, null, 2)}
              required
              spellCheck={false}
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Must contain <code>metadata</code> and <code>tests</code> keys
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isPending}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {isEditing ? 'Save Changes' : 'Create Fixture'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}