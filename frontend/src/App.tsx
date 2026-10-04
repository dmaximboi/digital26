import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider } from "./auth/AuthContext";
import { LocaleProvider } from "./i18n/LocaleContext";
import { GridVeil } from "./components/GridVeil";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { BottomNav } from "./components/BottomNav";
import { AppSplash } from "./components/AppSplash";
import { HomePage } from "./pages/HomePage";
import { VerifyPage } from "./pages/VerifyPage";
import { StudentRecordPage } from "./pages/StudentRecordPage";
import { CheckAgreementPage } from "./pages/CheckAgreementPage";
import { ContactPage } from "./pages/ContactPage";
import { AboutPage } from "./pages/AboutPage";
import { CurriculumPage } from "./pages/CurriculumPage";
import { QuizPage } from "./pages/QuizPage";
import { NewsPage } from "./pages/NewsPage";
import { DictionaryPage } from "./pages/DictionaryPage";
import { AgreementPublicPage } from "./pages/AgreementPublicPage";
import { SignPage } from "./pages/SignPage";
import { ClaimCertPage } from "./pages/ClaimCertPage";
import { SignInPage } from "./pages/SignInPage";
import { ApplyPage } from "./pages/ApplyPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage";
import { StudentPaymentPage } from "./pages/StudentPaymentPage";
import { StudentLibraryPage } from "./pages/StudentLibraryPage";
import { StudentAttendancePage } from "./pages/StudentAttendancePage";
import { StudentChatPage } from "./pages/StudentChatPage";
import { AdminLibraryPage } from "./pages/admin/AdminLibraryPage";
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
import { AdminStudentRecordPage } from "./pages/admin/AdminStudentRecordPage";
import { AdminStoragePage } from "./pages/admin/AdminStoragePage";
import { AdminCreateAgreementPage } from "./pages/AdminCreateAgreementPage";
import { AdminIssueCertificatePage } from "./pages/AdminIssueCertificatePage";
import { useVisitorBeacon } from "./lib/visitorBeacon";
import { warmOfflinePacks } from "./lib/offlinePack";

function AppRoutes() {
  useVisitorBeacon();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/curriculum" element={<CurriculumPage />} />
      <Route path="/quiz" element={<QuizPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/news/:id" element={<NewsPage />} />
      <Route path="/dictionary" element={<DictionaryPage />} />
      <Route path="/glossary" element={<DictionaryPage />} />
      <Route path="/tech-dictionary" element={<DictionaryPage />} />
      <Route path="/tech-terms" element={<DictionaryPage />} />
      <Route path="/terminology" element={<DictionaryPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/verify/:publicId" element={<StudentRecordPage />} />
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
      <Route path="/dashboard/payment" element={<StudentPaymentPage />} />
      <Route path="/dashboard/library" element={<StudentLibraryPage />} />
      <Route path="/dashboard/attendance" element={<StudentAttendancePage />} />
      <Route path="/dashboard/chat" element={<StudentChatPage />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="students/:id/record" element={<AdminStudentRecordPage />} />
        <Route path="library" element={<AdminLibraryPage />} />
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

function showSiteFooter(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/dashboard")) return false;
  if (pathname.startsWith("/signin")) return false;
  if (pathname.startsWith("/apply")) return false;
  if (pathname.startsWith("/sign/")) return false;
  if (pathname.startsWith("/claim-cert/")) return false;
  return true;
}

function Shell() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const withFooter = showSiteFooter(location.pathname);
  const [composing, setComposing] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setComposing(false);
      return;
    }
    setComposing(true);
    const timer = window.setTimeout(() => setComposing(false), 780);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    const idle = window.setTimeout(() => {
      void warmOfflinePacks();
    }, 400);
    return () => window.clearTimeout(idle);
  }, []);

  return (
    <div
      className={`app-shell${isAdmin ? " app-shell--admin" : ""}${composing ? " is-composing" : ""}`}
    >
      <GridVeil />
      <AppSplash />
      {!isAdmin && <SiteHeader />}
      <main className={location.pathname === "/" ? "is-home" : undefined}>
        <AppRoutes />
      </main>
      {withFooter && <SiteFooter />}
      <BottomNav />
    </div>
  );
}

export function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </LocaleProvider>
  );
}
