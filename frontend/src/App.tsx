import { Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider } from "./auth/AdminAuthContext";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { HomePage } from "./pages/HomePage";
import { VerifyPage } from "./pages/VerifyPage";
import { CheckAgreementPage } from "./pages/CheckAgreementPage";
import { ContactPage } from "./pages/ContactPage";
import { AboutPage } from "./pages/AboutPage";
import { AgreementPublicPage } from "./pages/AgreementPublicPage";
import { SignPage } from "./pages/SignPage";
import { ClaimCertPage } from "./pages/ClaimCertPage";
import { AdminCreateAgreementPage } from "./pages/AdminCreateAgreementPage";
import { AdminIssueCertificatePage } from "./pages/AdminIssueCertificatePage";
import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminAgreementsPage } from "./pages/admin/AdminAgreementsPage";
import { AdminAgreementDetailPage } from "./pages/admin/AdminAgreementDetailPage";
import { AdminCertificatesPage } from "./pages/admin/AdminCertificatesPage";
import { AdminClientsPage } from "./pages/admin/AdminClientsPage";
import { AdminAuditLogPage } from "./pages/admin/AdminAuditLogPage";
import { AdminMessagesPage } from "./pages/admin/AdminMessagesPage";
import { AdminPathProvider, useAdminPath } from "./lib/adminPath";

function AdminSection() {
  const { path: adminPath, ready } = useAdminPath();

  if (!ready) {
    return (
      <Routes>
        <Route
          path="*"
          element={
            <section className="panel">
              <p className="muted">Loading admin…</p>
            </section>
          }
        />
      </Routes>
    );
  }

  if (!adminPath) {
    return (
      <Routes>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <AdminAuthProvider>
      <Routes>
        <Route path={`/${adminPath}/login`} element={<AdminLoginPage />} />
        <Route path={`/${adminPath}`} element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="messages" element={<AdminMessagesPage />} />
          <Route path="agreements" element={<AdminAgreementsPage />} />
          <Route path="agreements/new" element={<AdminCreateAgreementPage />} />
          <Route path="agreements/:id" element={<AdminAgreementDetailPage />} />
          <Route path="certificates" element={<AdminCertificatesPage />} />
          <Route path="certificates/new" element={<AdminIssueCertificatePage />} />
          <Route path="clients" element={<AdminClientsPage />} />
          <Route path="audit" element={<AdminAuditLogPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminAuthProvider>
  );
}

/**
 * Public site never waits on admin/auth. Admin is a separate route tree.
 */
export function App() {
  return (
    <AdminPathProvider>
      <div className="app-shell">
        <SiteHeader />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/verify/:publicId" element={<VerifyPage />} />
            <Route path="/check-agreement" element={<CheckAgreementPage />} />
            <Route path="/check-agreement/:publicId" element={<CheckAgreementPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/a/:publicId" element={<AgreementPublicPage />} />
            <Route path="/sign/:sessionId" element={<SignPage />} />
            <Route path="/claim-cert/:sessionId" element={<ClaimCertPage />} />
            <Route path="/admin/*" element={<Navigate to="/" replace />} />
            <Route path="/*" element={<AdminSection />} />
          </Routes>
        </main>
        <SiteFooter />
      </div>
    </AdminPathProvider>
  );
}
