/// <reference types="vite/client" />
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type {
  Fixture,
  FixtureListResponse,
  FixtureCreate,
  FixtureUpdate,
  ProviderConfig,
  ProviderConfigListResponse,
  ProviderConfigCreate,
  ProviderConfigUpdate,
  AuditRun,
  AuditRunListResponse,
  AuditRunCreate,
  AuditRunUpdate,
  AuditResults,
  HealthResponse,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = sessionStorage.getItem('access_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          sessionStorage.removeItem('access_token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async healthCheck(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/healthz');
    return response.data;
  }

  async listFixtures(page = 1, pageSize = 20, search?: string): Promise<FixtureListResponse> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search) params.append('search', search);
    const response = await this.client.get<FixtureListResponse>(`/fixtures?${params}`);
    return response.data;
  }

  async getFixture(id: string): Promise<Fixture> {
    const response = await this.client.get<Fixture>(`/fixtures/${id}`);
    return response.data;
  }

  async createFixture(data: FixtureCreate): Promise<Fixture> {
    const response = await this.client.post<Fixture>('/fixtures', data);
    return response.data;
  }

  async updateFixture(id: string, data: FixtureUpdate): Promise<Fixture> {
    const response = await this.client.patch<Fixture>(`/fixtures/${id}`, data);
    return response.data;
  }

  async deleteFixture(id: string): Promise<void> {
    await this.client.delete(`/fixtures/${id}`);
  }

  async listProviders(
    page = 1,
    pageSize = 20,
    providerType?: string,
    isActive?: boolean
  ): Promise<ProviderConfigListResponse> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (providerType) params.append('provider_type', providerType);
    if (isActive !== undefined) params.append('is_active', String(isActive));
    const response = await this.client.get<ProviderConfigListResponse>(`/providers?${params}`);
    return response.data;
  }

  async getProvider(id: string): Promise<ProviderConfig> {
    const response = await this.client.get<ProviderConfig>(`/providers/${id}`);
    return response.data;
  }

  async createProvider(data: ProviderConfigCreate): Promise<ProviderConfig> {
    const response = await this.client.post<ProviderConfig>('/providers', data);
    return response.data;
  }

  async updateProvider(id: string, data: ProviderConfigUpdate): Promise<ProviderConfig> {
    const response = await this.client.patch<ProviderConfig>(`/providers/${id}`, data);
    return response.data;
  }

  async deleteProvider(id: string): Promise<void> {
    await this.client.delete(`/providers/${id}`);
  }

  async listAuditRuns(
    page = 1,
    pageSize = 20,
    status?: string
  ): Promise<AuditRunListResponse> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (status) params.append('status', status);
    const response = await this.client.get<AuditRunListResponse>(`/audit-runs?${params}`);
    return response.data;
  }

  async getAuditRun(id: string): Promise<AuditRun> {
    const response = await this.client.get<AuditRun>(`/audit-runs/${id}`);
    return response.data;
  }

  async createAuditRun(data: AuditRunCreate): Promise<AuditRun> {
    const response = await this.client.post<AuditRun>('/audit-runs', data);
    return response.data;
  }

  async updateAuditRun(id: string, data: AuditRunUpdate): Promise<AuditRun> {
    const response = await this.client.patch<AuditRun>(`/audit-runs/${id}`, data);
    return response.data;
  }

  async executeAuditRun(id: string): Promise<AuditRun> {
    const response = await this.client.post<AuditRun>(`/audit-runs/${id}/execute`);
    return response.data;
  }

  async deleteAuditRun(id: string): Promise<void> {
    await this.client.delete(`/audit-runs/${id}`);
  }

  async getAuditResults(id: string): Promise<AuditResults> {
    const response = await this.client.get<AuditResults>(`/audit-runs/${id}/results`);
    return response.data;
  }
}

export const api = new ApiClient();