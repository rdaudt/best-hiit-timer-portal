import { Navigate, Route, Routes } from 'react-router-dom';
import { SignInPage } from './pages/SignInPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PortalLayout } from './layout/PortalLayout';
import { BrandingPage } from './pages/BrandingPage';
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
        <Route index element={<Navigate to="/branding" replace />} />
        <Route path="branding" element={<BrandingPage />} />
        <Route path="class-locations" element={<ClassLocationsPage />} />
        <Route path="class-locations/new" element={<ClassLocationEditorPage />} />
        <Route path="class-locations/:id" element={<ClassLocationEditorPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
