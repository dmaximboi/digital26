import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/authApi";
import { setPageMeta } from "../lib/seo";

type Profile = {
  fullName: string;
  phone: string;
  photoUrl: string | null;
  programme: "FIVE_MONTH" | "SIX_MONTH";
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionNote: string | null;
  startDate: string | null;
};

export function StudentDashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    setPageMeta({ title: "Dashboard — The Digital 26", description: "Your student dashboard." });
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/signin", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "ADMIN" || user.role === "READONLY") {
      navigate("/admin", { replace: true });
      return;
    }
    if (!user.hasProfile) {
      navigate("/apply", { replace: true });
      return;
    }
    apiFetch<{ profile: Profile | null }>("/api/student/me")
      .then((d) => setProfile(d.profile))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user, navigate]);

  if (loading || fetching) {
    return <section className="panel" aria-busy="true"><p className="muted">Loading...</p></section>;
  }
  if (!profile) {
    return <section className="panel"><p>No profile found.</p></section>;
  }

  if (profile.status === "PENDING") {
    return (
      <section className="panel dashboard-status pending">
        <div className="status-icon">&#9203;</div>
        <h1>Account Pending Review</h1>
        <p className="lede">
          Your application has been submitted and is under admin review.
          You'll be able to access the class once approved.
        </p>
        <div className="status-details">
          <p><strong>Name:</strong> {profile.fullName}</p>
          <p><strong>Programme:</strong> {profile.programme === "FIVE_MONTH" ? "5-Month Accelerated" : "6-Month Standard"}</p>
        </div>
      </section>
    );
  }

  if (profile.status === "REJECTED") {
    return (
      <section className="panel dashboard-status rejected">
        <div className="status-icon">&#128546;</div>
        <h1>Application Not Approved</h1>
        <p className="lede">
          Unfortunately, your application was not approved at this time.
        </p>
        {profile.rejectionNote && (
          <div className="rejection-note">
            <p><strong>Note from admin:</strong> {profile.rejectionNote}</p>
          </div>
        )}
        <p className="muted">If you believe this is an error, please <Link to="/contact">contact us</Link>.</p>
      </section>
    );
  }

  return (
    <section className="panel dashboard-approved">
      <h1>Welcome, {profile.fullName}!</h1>
      <p className="lede">
        Your account has been approved. You are enrolled in the{" "}
        <strong>{profile.programme === "FIVE_MONTH" ? "5-Month Accelerated" : "6-Month Standard"}</strong> programme.
      </p>

      {profile.startDate && (
        <p className="muted">Started: {new Date(profile.startDate).toLocaleDateString()}</p>
      )}

      <div className="dashboard-cards">
        <Link to="/dashboard/attendance" className="dashboard-card">
          <h3>Attendance</h3>
          <p>Sign your weekly attendance and track progress</p>
        </Link>

        <Link to="/dashboard/chat" className="dashboard-card">
          <h3>Class Chat</h3>
          <p>Chat with fellow students (10 messages per day)</p>
        </Link>
      </div>
    </section>
  );
}
