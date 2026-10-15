import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { AuditRunsPage } from '@/components/AuditRunsPage';
import { AuditRunDetail } from '@/components/AuditRunDetail';
import { FixturesPage } from '@/components/FixturesPage';
import { FixtureDetail } from '@/components/FixtureDetail';
import { ProvidersPage } from '@/components/ProvidersPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="audit-runs" element={<AuditRunsPage />} />
        <Route path="audit-runs/:id" element={<AuditRunDetail />} />
        <Route path="fixtures" element={<FixturesPage />} />
        <Route path="fixtures/:id" element={<FixtureDetail />} />
        <Route path="providers" element={<ProvidersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;