import { Navigate, Route, Routes } from 'react-router-dom';
import { SignInPage } from './pages/SignInPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PortalLayout } from './layout/PortalLayout';
import { DashboardPage } from './pages/DashboardPage';
import { BrandingPage } from './pages/BrandingPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TemplateEditorPage } from './pages/TemplateEditorPage';
import { ClassLocationsPage } from './pages/ClassLocationsPage';
import { ClassLocationEditorPage } from './pages/ClassLocationEditorPage';

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route
        path="/"
        element={(
          <ProtectedRoute>
            <PortalLayout />
          </ProtectedRoute>
        )}
      >
        <Route index element={<DashboardPage />} />
        <Route path="branding" element={<BrandingPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="templates/new" element={<TemplateEditorPage />} />
        <Route path="templates/:id" element={<TemplateEditorPage />} />
        <Route path="class-locations" element={<ClassLocationsPage />} />
        <Route path="class-locations/new" element={<ClassLocationEditorPage />} />
        <Route path="class-locations/:id" element={<ClassLocationEditorPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
