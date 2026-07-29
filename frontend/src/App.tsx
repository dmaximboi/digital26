import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { BottomNav } from "./components/BottomNav";
import { AppSplash } from "./components/AppSplash";
import { HomePage } from "./pages/HomePage";
import { VerifyPage } from "./pages/VerifyPage";
import { CheckAgreementPage } from "./pages/CheckAgreementPage";
import { ContactPage } from "./pages/ContactPage";
import { AboutPage } from "./pages/AboutPage";
import { AgreementPublicPage } from "./pages/AgreementPublicPage";
import { SignPage } from "./pages/SignPage";
import { ClaimCertPage } from "./pages/ClaimCertPage";
import { SignInPage } from "./pages/SignInPage";
import { ApplyPage } from "./pages/ApplyPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage";
import { StudentAttendancePage } from "./pages/StudentAttendancePage";
import { StudentChatPage } from "./pages/StudentChatPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminAgreementsPage } from "./pages/admin/AdminAgreementsPage";
import { AdminAgreementDetailPage } from "./pages/admin/AdminAgreementDetailPage";
import { AdminCertificatesPage } from "./pages/admin/AdminCertificatesPage";
import { AdminClientsPage } from "./pages/admin/AdminClientsPage";
import { AdminAuditLogPage } from "./pages/admin/AdminAuditLogPage";
import { AdminMessagesPage } from "./pages/admin/AdminMessagesPage";
import { AdminVisitsPage } from "./pages/admin/AdminVisitsPage";
import { AdminStudentsPage } from "./pages/admin/AdminStudentsPage";
import { AdminStoragePage } from "./pages/admin/AdminStoragePage";
import { AdminCreateAgreementPage } from "./pages/AdminCreateAgreementPage";
import { AdminIssueCertificatePage } from "./pages/AdminIssueCertificatePage";
import { useVisitorBeacon } from "./lib/visitorBeacon";

function AppRoutes() {
  useVisitorBeacon();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/verify/:publicId" element={<VerifyPage />} />
      <Route path="/check-agreement" element={<CheckAgreementPage />} />
      <Route path="/check-agreement/:publicId" element={<CheckAgreementPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/a/:publicId" element={<AgreementPublicPage />} />
      <Route path="/sign/:sessionId" element={<SignPage />} />
      <Route path="/claim-cert/:sessionId" element={<ClaimCertPage />} />

      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      <Route path="/signin" element={<SignInPage />} />
      <Route path="/apply" element={<ApplyPage />} />

      <Route path="/dashboard" element={<StudentDashboardPage />} />
      <Route path="/dashboard/attendance" element={<StudentAttendancePage />} />
      <Route path="/dashboard/chat" element={<StudentChatPage />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="messages" element={<AdminMessagesPage />} />
        <Route path="visits" element={<AdminVisitsPage />} />
        <Route path="agreements" element={<AdminAgreementsPage />} />
        <Route path="agreements/new" element={<AdminCreateAgreementPage />} />
        <Route path="agreements/:id" element={<AdminAgreementDetailPage />} />
        <Route path="certificates" element={<AdminCertificatesPage />} />
        <Route path="certificates/new" element={<AdminIssueCertificatePage />} />
        <Route path="chat" element={<StudentChatPage />} />
        <Route path="storage" element={<AdminStoragePage />} />
        <Route path="clients" element={<AdminClientsPage />} />
        <Route path="audit" element={<AdminAuditLogPage />} />
      </Route>

      <Route path="/ops/*" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Shell() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className={`app-shell${isAdmin ? " app-shell--admin" : ""}`}>
      <AppSplash />
      {!isAdmin && <SiteHeader />}
      <main>
        <AppRoutes />
      </main>
      {!isAdmin && <SiteFooter />}
      <BottomNav />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
