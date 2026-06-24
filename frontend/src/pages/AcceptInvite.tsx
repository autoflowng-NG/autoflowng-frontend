/**
 * AcceptInvite — Phase 6.6
 *
 * BUGFIX: routes/organizations.js has always had a working
 * POST /api/orgs/invitations/:token/accept endpoint, and invite emails
 * (dispatchInvitationEmail) have always linked to
 * `${FRONTEND_URL}/accept-invite?token=...` — but this route never existed
 * in the frontend router. Anyone clicking an invite link hit the app's
 * normal logged-in/logged-out fallback instead of an actual "join this
 * workspace" screen, so invites could never be completed end-to-end.
 *
 * Flow:
 *   - Not logged in  -> stash the token, send to /login, come back here
 *                       automatically once authenticated.
 *   - Logged in      -> call acceptInvite(token) immediately, show result.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useOrg } from "../contexts/OrgContext";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { Building2, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const PENDING_INVITE_KEY = "af_pending_invite_token";

export default function AcceptInvite() {
  const nav = useNavigate();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { acceptInvite, setActiveOrg, orgs } = useOrg();

  const [status, setStatus] = useState<"checking" | "needs_login" | "accepting" | "success" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState("");
  const [orgId, setOrgId] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return; // wait for auth state to resolve before deciding

    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const storedToken = sessionStorage.getItem(PENDING_INVITE_KEY);
    const token = urlToken || storedToken;

    if (!token) {
      setStatus("error");
      setErrorMsg("This invite link is missing its token. Ask whoever invited you to resend it.");
      return;
    }

    if (!isAuthenticated) {
      // Not logged in yet — remember the token, send to login. Login
      // always nav()s to /dashboard on success (no `next` param support
      // in this app), so we don't rely on that — AppShell.tsx checks for
      // this sessionStorage key on every authenticated page load and
      // routes back here automatically once the user is logged in.
      sessionStorage.setItem(PENDING_INVITE_KEY, token);
      setStatus("needs_login");
      nav(`/login`);
      return;
    }

    // Logged in — accept now.
    setStatus("accepting");
    acceptInvite(token)
      .then((res) => {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        setOrgId(res.org_id);
        setStatus("success");
      })
      .catch((e: any) => {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        setErrorMsg(e?.message || "This invite link is invalid or has expired.");
        setStatus("error");
      });
  }, [authLoading, isAuthenticated]);

  const handleContinue = () => {
    if (orgId) {
      const joined = orgs.find(o => o.id === orgId);
      if (joined) setActiveOrg(joined);
    }
    nav("/dashboard");
  };

  return (
    <PageTransition variant="slide">
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Reveal>
          <div className="af-glass" style={{ maxWidth: 420, width: "100%", borderRadius: 20, padding: "36px 32px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Building2 size={24} color="#A78BFA" />
            </div>

            {(status === "checking" || status === "accepting" || status === "needs_login") && (
              <>
                <Loader2 size={20} color="#A78BFA" style={{ animation: "spin 1s linear infinite", marginBottom: 14 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 6 }}>
                  {status === "needs_login" ? "Redirecting to log in…" : "Joining workspace…"}
                </div>
                <div style={{ fontSize: 13, color: "rgba(232,238,255,0.5)" }}>
                  {status === "needs_login"
                    ? "Log in or create an account, then you'll come right back here."
                    : "Hang tight while we add you to the team."}
                </div>
              </>
            )}

            {status === "success" && (
              <>
                <CheckCircle2 size={28} color="#00C896" style={{ marginBottom: 14 }} />
                <div style={{ fontSize: 17, fontWeight: 800, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>You're in!</div>
                <div style={{ fontSize: 13, color: "rgba(232,238,255,0.55)", marginBottom: 24, lineHeight: 1.55 }}>
                  You've joined the workspace. You can switch into it anytime from the workspace selector in the sidebar.
                </div>
                <button data-testid="button-continue-to-dashboard" onClick={handleContinue}
                  style={{ background: "#00C896", border: "none", borderRadius: 10, padding: "12px 28px", color: "#04060F", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", width: "100%" }}>
                  Go to Dashboard
                </button>
              </>
            )}

            {status === "error" && (
              <>
                <XCircle size={28} color="#FB7185" style={{ marginBottom: 14 }} />
                <div style={{ fontSize: 17, fontWeight: 800, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>Couldn't join workspace</div>
                <div style={{ fontSize: 13, color: "rgba(232,238,255,0.55)", marginBottom: 24, lineHeight: 1.55 }}>{errorMsg}</div>
                <button onClick={() => nav("/dashboard")}
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "12px 28px", color: "rgba(232,238,255,0.6)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", width: "100%" }}>
                  Go to Dashboard
                </button>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </PageTransition>
  );
}
