  async getAuditResults(id: string): Promise<AuditResults> {
    const response = await this.client.get<AuditResults>(`/audit-runs/${id}/results`);
    return response.data;
  }

  async exportFixture(id: string): Promise<Fixture> {
    const response = await this.client.get<Fixture>(`/fixtures/${id}/export`);
    return response.data;
  }
}

export const api = new ApiClient();
