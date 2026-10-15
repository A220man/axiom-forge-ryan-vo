import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, Server, Loader2, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '@/api/client';
import { type ProviderConfig, type ProviderConfigCreate, type ProviderConfigUpdate } from '@/types/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';

const PROVIDER_TYPES = [
  { value: 'mock', label: 'Mock (Offline)', icon: Server },
  { value: 'openai_compatible', label: 'OpenAI Compatible', icon: Server },
  { value: 'anthropic', label: 'Anthropic', icon: Server },
  { value: 'gemini', label: 'Google Gemini', icon: Server },
  { value: 'ollama', label: 'Ollama (Local)', icon: Server },
] as const;

export function ProvidersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [providerTypeFilter, setProviderTypeFilter] = useState<string>('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['providers', page, 20, providerTypeFilter, isActiveFilter, search],
    queryFn: () => api.listProviders(
      page,
      20,
      providerTypeFilter || undefined,
      isActiveFilter === 'true' ? true : isActiveFilter === 'false' ? false : undefined
    ),
  });

  const createMutation = useMutation({
    mutationFn: (data: ProviderConfigCreate) => api.createProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setShowCreateModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProviderConfigUpdate }) => api.updateProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setEditingProvider(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const provider_type = formData.get('provider_type') as ProviderConfigCreate['provider_type'];
    const model = formData.get('model') as string;
    const base_url = formData.get('base_url') as string;
    const api_key_env = formData.get('api_key_env') as string;
    const timeout_seconds = parseInt(formData.get('timeout_seconds') as string) || 30;
    const is_active = formData.get('is_active') === 'on';

    if (!name || !provider_type || !model) return;

    await createMutation.mutateAsync({
      name,
      provider_type,
      model,
      base_url: base_url || undefined,
      api_key_env: api_key_env || undefined,
      timeout_seconds,
      is_active,
    });
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProvider) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const provider_type = formData.get('provider_type') as ProviderConfigUpdate['provider_type'];
    const model = formData.get('model') as string;
    const base_url = formData.get('base_url') as string;
    const api_key_env = formData.get('api_key_env') as string;
    const timeout_seconds = parseInt(formData.get('timeout_seconds') as string) || 30;
    const is_active = formData.get('is_active') === 'on';

    if (!name || !provider_type || !model) return;

    await updateMutation.mutateAsync({
      id: editingProvider.id,
      data: {
        name,
        provider_type,
        model,
        base_url: base_url || undefined,
        api_key_env: api_key_env || undefined,
        timeout_seconds,
        is_active,
      },
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this provider configuration?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleToggleActive = async (provider: ProviderConfig) => {
    await updateMutation.mutateAsync({
      id: provider.id,
      data: { is_active: !provider.is_active },
    });
  };

  if (isLoading && page === 1) {
    return <LoadingSpinner size={32} />;
  }

  const providers = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="page-title">Providers</h1>
          <p className="page-description">Configure LLM providers for AI agent auditing</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Provider
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search providers..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
                aria-label="Search providers"
              />
            </div>
            <select
              value={providerTypeFilter}
              onChange={(e) => { setProviderTypeFilter(e.target.value); setPage(1); }}
              className="form-input form-select w-48"
              aria-label="Filter by provider type"
            >
              <option value="">All Types</option>
              {PROVIDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select
              value={isActiveFilter}
              onChange={(e) => { setIsActiveFilter(e.target.value); setPage(1); }}
              className="form-input form-select w-36"
              aria-label="Filter by active status"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {providers.length === 0 ? (
            <div className="empty-state h-64">
              <Server className="empty-state-icon h-12 w-12" aria-hidden="true" />
              <p>{search || providerTypeFilter || isActiveFilter ? 'No providers match your filters' : 'No providers configured'}</p>
              {!search && !providerTypeFilter && !isActiveFilter && (
                <button className="btn btn-primary mt-4" onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add Your First Provider
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
                      <th style={{ width: '15%' }}>Type</th>
                      <th style={{ width: '20%' }}>Model</th>
                      <th style={{ width: '10%' }}>Status</th>
                      <th style={{ width: '15%' }}>Updated</th>
                      <th style={{ width: '10%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((provider) => (
                      <ProviderRow
                        key={provider.id}
                        provider={provider}
                        onEdit={setEditingProvider}
                        onDelete={handleDelete}
                        onToggleActive={handleToggleActive}
                        isDeleting={deleteMutation.variables === provider.id}
                        isUpdating={updateMutation.variables?.id === provider.id}
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
        <ProviderModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          isPending={createMutation.isPending}
        />
      )}

      {editingProvider && (
        <ProviderModal
          provider={editingProvider}
          onClose={() => setEditingProvider(null)}
          onSubmit={handleUpdate}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function ProviderRow({
  provider,
  onEdit,
  onDelete,
  onToggleActive,
  isDeleting,
  isUpdating,
}: {
  provider: ProviderConfig;
  onEdit: (provider: ProviderConfig) => void;
  onDelete: (id: string) => void;
  onToggleActive: (provider: ProviderConfig) => void;
  isDeleting: boolean;
  isUpdating: boolean;
}) {
  const typeInfo = PROVIDER_TYPES.find(t => t.value === provider.provider_type) || PROVIDER_TYPES[0];

  return (
    <tr>
      <td>
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)]">
            <typeInfo.icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium">{provider.name}</p>
            {provider.base_url && (
              <p className="text-xs text-[var(--color-text-muted)] truncate max-w-xs">{provider.base_url}</p>
            )}
          </div>
        </div>
      </td>
      <td><Badge variant="info">{typeInfo.label}</Badge></td>
      <td className="font-mono text-sm">{provider.model}</td>
      <td>
        <button
          onClick={() => onToggleActive(provider)}
          disabled={isUpdating}
          className="inline-flex items-center gap-2"
          aria-label={provider.is_active ? 'Deactivate' : 'Activate'}
        >
          {provider.is_active ? (
            <ToggleRight className="h-5 w-5 text-[var(--color-success)]" aria-hidden="true" />
          ) : (
            <ToggleLeft className="h-5 w-5 text-[var(--color-text-muted)]" aria-hidden="true" />
          )}
          <span className={provider.is_active ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}>
            {provider.is_active ? 'Active' : 'Inactive'}
          </span>
        </button>
      </td>
      <td className="text-[var(--color-text-muted)] text-sm">
        {formatDistanceToNow(new Date(provider.updated_at), { addSuffix: true })}
      </td>
      <td>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(provider)} aria-label="Edit provider">
            <Edit className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            className="btn btn-ghost btn-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]"
            onClick={() => onDelete(provider.id)}
            disabled={isDeleting}
            aria-label="Delete provider"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProviderModal({
  provider,
  onClose,
  onSubmit,
  isPending,
}: {
  provider?: ProviderConfig;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isPending: boolean;
}) {
  const isEditing = !!provider;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby={isEditing ? 'edit-provider-title' : 'create-provider-title'}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--color-surface)] rounded-xl shadow-xl border border-[var(--color-border)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 id={isEditing ? 'edit-provider-title' : 'create-provider-title'} className="text-lg font-semibold">
            {isEditing ? 'Edit Provider' : 'Add Provider'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost" aria-label="Close modal">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div className="grid grid-2 gap-4">
            <div className="form-group">
              <label htmlFor="provider-name" className="form-label">Name *</label>
              <input
                type="text"
                id="provider-name"
                name="name"
                className="form-input"
                defaultValue={provider?.name}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="provider-type" className="form-label">Type *</label>
              <select
                id="provider-type"
                name="provider_type"
                className="form-input form-select"
                defaultValue={provider?.provider_type}
                required
              >
                {PROVIDER_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group col-span-2">
              <label htmlFor="provider-model" className="form-label">Model *</label>
              <input
                type="text"
                id="provider-model"
                name="model"
                className="form-input"
                defaultValue={provider?.model}
                required
                placeholder="e.g., gpt-4o, claude-3-5-sonnet-latest, gemini-1.5-pro"
              />
            </div>
            <div className="form-group col-span-2">
              <label htmlFor="provider-base-url" className="form-label">Base URL (Optional)</label>
              <input
                type="url"
                id="provider-base-url"
                name="base_url"
                className="form-input"
                defaultValue={provider?.base_url ?? ''}
                placeholder="https://api.openai.com/v1 (for OpenAI-compatible)"
              />
            </div>
            <div className="form-group col-span-2">
              <label htmlFor="provider-api-key-env" className="form-label">API Key Environment Variable (Optional)</label>
              <input
                type="text"
                id="provider-api-key-env"
                name="api_key_env"
                className="form-input"
                defaultValue={provider?.api_key_env ?? ''}
                placeholder="OPENAI_API_KEY"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                The environment variable name where the API key is stored on the server. Never enter the actual key here.
              </p>
            </div>
            <div className="form-group">
              <label htmlFor="provider-timeout" className="form-label">Timeout (seconds)</label>
              <input
                type="number"
                id="provider-timeout"
                name="timeout_seconds"
                className="form-input"
                defaultValue={provider?.timeout_seconds || 30}
                min={1}
                max={300}
              />
            </div>
            <div className="form-group">
              <label className="form-label flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={provider?.is_active ?? true}
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span>Active</span>
              </label>
            </div>
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
                  {isEditing ? 'Save Changes' : 'Add Provider'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}