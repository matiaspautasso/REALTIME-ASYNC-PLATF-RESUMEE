import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { NewImportPage } from './pages/NewImportPage';
import { ImportDetailPage } from './pages/ImportDetailPage';
import { HistoryPage } from './pages/HistoryPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="imports/new" element={<NewImportPage />} />
        <Route path="imports/:id" element={<ImportDetailPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
