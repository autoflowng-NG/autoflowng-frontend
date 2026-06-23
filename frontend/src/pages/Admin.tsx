import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminAPI, approvalsAPI } from "../lib/api";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import { Users, Activity, CreditCard, Zap, ShieldCheck, Search, Settings2, CheckCircle2, XCircle, MessageSquare, BarChart2, Star, LifeBuoy, Clock } from "lucide-react";
import MFAEnforcementBanner from "../components/MFAEnforcement";
import OperationalAlertsBadge from "../components/OperationalAlertsBadge";
import { useAuth } from "../contexts/AuthContext";

import AdminAssistant from "../components/AdminAssistant";
import TestimonialsModerationPanel from "../components/TestimonialsModerationPanel";
import SupportAdminDashboard from "../components/SupportAdminDashboard";

const WITHDRAWAL_APPROVAL_THRESHOLD = parseInt(
  (import.meta as any).env?.VITE_WITHDRAWAL_APPROVAL_THRESHOLD ?? "50000",
  10,
);

const TABS = [
  { id: "overview",     label: "Overview",     icon: BarChart2 },
  { id: "users",        label: "Users",        icon: Users },
  { id: "payments",     label: "Payments",     icon: CreditCard },
  { id: "automations",  label: "Automations",  icon: Zap },
  { id: "withdrawals",  label: "Withdrawals",  icon: Activity },
  { id: "system",       label: "System",       icon: Settings2 },
  { id: "testimonials", label: "Testimonials", icon: Star },
  { id: "support",      label: "Support",      icon: LifeBuoy },
  { id: "assistant",    label: "AI Assistant", icon: MessageSquare },
];


function OverviewTab() {
  const { data: overview } = useQuery({ queryKey: ["admin", "overview"], queryFn: () => adminAPI.overview() });
  const o = (overview as any) || {};
  const stats = [
    { label: "Total Users",       value: o.total_users ?? "—",       color: "#00C896" },
    { label: "Active Workflows",   value: o.active_workflows ?? "—",  color: "#38BDF8" },
    { label: "Events Today",       value: o.events_today ?? "—",      color: "#A78BFA" },
    { label: "Revenue (Month)",    value: o.monthly_revenue ? `₦${o.monthly_revenue.toLocaleString()}` : "—", color: "#FBBF24" },
    { label: "Pro Users",          value: o.pro_users ?? "—",         color: "#00C896" },
    { label: "Pending Withdrawals",value: o.pending_withdrawals ?? "—",color: "#FB7185" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16 }}>
      {stats.map(s => (
        <div key={s.label} className="af-glass" style={{ borderRadius: 14, padding: "18px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: "1.8rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", color: s.color, marginBottom: 4 }}>{s.value}</div>
          <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)" }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const { data, refetch } = useQuery({ queryKey: ["admin", "users", { search, plan: planFilter }], queryFn: () => adminAPI.users({ search, plan: planFilter || undefined }) });
  const users = (data as any)?.users || [];
  const { toast } = useToast();

  // Live clock for inline user local time — ticks every minute
  const [rowClock, setRowClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setRowClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const getUserLocalTime = (tz: string | null | undefined): string | null => {
    if (!tz) return null;
    try {
      return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit", minute: "2-digit", timeZone: tz,
      }).format(rowClock);
    } catch { return null; }
  };

  const updatePlan = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) => adminAPI.updatePlan(id, plan),
    onSuccess: () => { toast({ title: "Plan updated!" }); refetch(); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.3)" }} />
          <input data-testid="input-user-search" placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 14px 9px 34px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
        </div>
        <select data-testid="select-plan-filter" value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 14px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" }}>
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {users.length === 0
          ? <div style={{ textAlign: "center", padding: "32px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>No users found</div>
          : users.map((u: any) => (
            <div key={u.id} data-testid={`admin-user-${u.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#00C896,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#04060F", flexShrink: 0 }}>
                {(u.name || u.email || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name || u.email}</div>
                <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>{u.email}</div>
              </div>
              <select data-testid={`admin-user-plan-${u.id}`} value={u.plan || "free"} onChange={e => updatePlan.mutate({ id: u.id, plan: e.target.value })} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 10px", color: "#E8EEFF", fontSize: 12, fontFamily: "'DM Mono',monospace", outline: "none", cursor: "pointer" }}>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
              <div style={{ fontSize: 10, fontWeight: 700, color: u.is_active !== false ? "#00C896" : "#FB7185", fontFamily: "'DM Mono',monospace" }}>{u.is_active !== false ? "ACTIVE" : "INACTIVE"}</div>
              {(() => { const t = getUserLocalTime(u.timezone); return t ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 6, padding: "3px 7px", flexShrink: 0 }}>
                  <Clock size={9} color="#38BDF8" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#38BDF8", fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>{t}</span>
                </div>
              ) : null; })()}
            </div>
          ))
        }
      </div>
    </div>
  );
}

function PaymentsTab() {
  const { data } = useQuery({ queryKey: ["admin", "payments"], queryFn: () => adminAPI.payments() });
  const payments = (data as any)?.payments || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {payments.length === 0 ? <div style={{ textAlign: "center", padding: "32px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>No payments found</div> :
        payments.map((p: any, i: number) => (
          <div key={i} data-testid={`admin-payment-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
            <CreditCard size={13} color="rgba(232,238,255,0.3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "#E8EEFF" }}>{p.user_email || p.email || "Unknown"}</div>
              <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>{p.plan} · {p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#00C896" }}>₦{(p.amount || 0).toLocaleString()}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: p.status === "success" ? "#00C896" : "#FBBF24", background: p.status === "success" ? "rgba(0,200,150,0.1)" : "rgba(251,191,36,0.1)", borderRadius: 100, padding: "2px 8px", fontFamily: "'DM Mono',monospace" }}>{(p.status || "pending").toUpperCase()}</div>
          </div>
        ))
      }
    </div>
  );
}

function WithdrawalsTab() {
  const { data, refetch } = useQuery({ queryKey: ["admin", "withdrawals"], queryFn: () => adminAPI.withdrawals() });
  const withdrawals = (data as any)?.withdrawals || [];
  const { toast } = useToast();
  const [approvalModal, setApprovalModal] = useState<{ id: string; amount: number; email: string } | null>(null);
  const [approvalReason, setApprovalReason] = useState("");

  const updateW = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminAPI.updateWithdrawal(id, status),
    onSuccess: () => { toast({ title: "Withdrawal updated!" }); refetch(); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const requestApproval = useMutation({
    mutationFn: (data: { action_type: string; target_type: string; target_id: string; reason: string }) =>
      approvalsAPI.create(data),
    onSuccess: () => {
      toast({ title: "Approval request submitted", description: "A Super Admin will review this shortly." });
      setApprovalModal(null);
      setApprovalReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {withdrawals.length === 0 ? <div style={{ textAlign: "center", padding: "32px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>No withdrawals</div> :
          withdrawals.map((w: any) => {
            const amount = w.amount || 0;
            const needsApproval = amount >= WITHDRAWAL_APPROVAL_THRESHOLD;
            return (
              <div key={w.id} data-testid={`admin-withdrawal-${w.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#E8EEFF" }}>{w.user_email || w.email || "Unknown"}</div>
                  <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>
                    ₦{amount.toLocaleString()} · {w.created_at ? new Date(w.created_at).toLocaleDateString() : ""}
                    {needsApproval && <span style={{ color: "#FBBF24", marginLeft: 6 }}>· requires Super Admin approval</span>}
                  </div>
                </div>
                {w.status === "pending" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {needsApproval ? (
                      <button
                        data-testid={`approve-withdrawal-${w.id}`}
                        onClick={() => setApprovalModal({ id: w.id, amount, email: w.user_email || w.email || "Unknown" })}
                        style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 7, padding: "5px 10px", color: "#FBBF24", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        <CheckCircle2 size={11} /> Request Approval
                      </button>
                    ) : (
                      <button
                        data-testid={`approve-withdrawal-${w.id}`}
                        onClick={() => updateW.mutate({ id: w.id, status: "approved" })}
                        style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: 7, padding: "5px 10px", color: "#00C896", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        <CheckCircle2 size={11} /> Approve
                      </button>
                    )}
                    <button
                      data-testid={`reject-withdrawal-${w.id}`}
                      onClick={() => updateW.mutate({ id: w.id, status: "rejected" })}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 7, padding: "5px 10px", color: "#FB7185", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      <XCircle size={11} /> Reject
                    </button>
                  </div>
                )}
                <div style={{ fontSize: 10, fontWeight: 700, color: w.status === "approved" ? "#00C896" : w.status === "rejected" ? "#FB7185" : "#FBBF24", fontFamily: "'DM Mono',monospace" }}>{(w.status || "PENDING").toUpperCase()}</div>
              </div>
            );
          })
        }
      </div>

      {/* Approval request modal */}
      {approvalModal && (
        <>
          <div onClick={() => setApprovalModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(4,6,15,0.8)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#08091A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, zIndex: 2001, width: 400, display: "flex", flexDirection: "column", gap: 14, fontFamily: "'DM Sans',sans-serif" }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#E8EEFF" }}>Request Withdrawal Approval</div>
            <div style={{ fontSize: 13, color: "rgba(232,238,255,0.6)", lineHeight: 1.5 }}>
              Withdrawal of <strong style={{ color: "#FBBF24" }}>₦{approvalModal.amount.toLocaleString()}</strong> by <strong style={{ color: "#E8EEFF" }}>{approvalModal.email}</strong> requires Super Admin approval (threshold: ₦{WITHDRAWAL_APPROVAL_THRESHOLD.toLocaleString()}).
            </div>
            <textarea
              value={approvalReason}
              onChange={e => setApprovalReason(e.target.value)}
              placeholder="Reason / justification for this withdrawal…"
              rows={3}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 14px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box", resize: "vertical" as any }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setApprovalModal(null)} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: "rgba(232,238,255,0.6)" }}>Cancel</button>
              <button
                onClick={() => requestApproval.mutate({ action_type: "approve_withdrawal", target_type: "withdrawal", target_id: approvalModal.id, reason: approvalReason })}
                disabled={!approvalReason.trim() || requestApproval.isPending}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: "#FBBF24", opacity: (!approvalReason.trim() || requestApproval.isPending) ? 0.5 : 1 }}>
                Submit Request
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SystemTab() {
  const { data: system } = useQuery({ queryKey: ["admin", "system"], queryFn: () => adminAPI.system() });
  const s = (system as any) || {};
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {Object.entries(s).map(([k, v]) => (
        <div key={k} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 4 }}>{k.toUpperCase().replace(/_/g, " ")}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF", fontFamily: "'DM Mono',monospace" }}>{String(v)}</div>
        </div>
      ))}
      {Object.keys(s).length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "32px", color: "rgba(232,238,255,0.25)", fontSize: 13 }}>System info unavailable</div>}
    </div>
  );
}

const TAB_CONTENT: Record<string, React.FC> = { overview: OverviewTab, users: UsersTab, payments: PaymentsTab, automations: () => <div style={{ color: "rgba(232,238,255,0.3)", fontSize: 13, textAlign: "center", padding: 32 }}>No automation admin data yet.</div>, withdrawals: WithdrawalsTab, system: SystemTab, testimonials: TestimonialsModerationPanel, support: SupportAdminDashboard, assistant: AdminAssistant };

export default function Admin() {
  const [activeTab, setActiveTab] = useState("overview");
  const [clockTime, setClockTime] = useState(() => new Date());
  const Content = TAB_CONTENT[activeTab] || OverviewTab;

  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <PageTransition variant="slide">
    <div style={{ padding: "32px", maxWidth: 1200, margin: "0 auto" }}>
      <Reveal>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(251,113,133,0.12)", border: "1px solid rgba(251,113,133,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={18} color="#FB7185" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#FB7185", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>ADMIN CONSOLE</div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF" }}>Control Center</h1>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.15)", borderRadius: 8, padding: "5px 10px" }}>
              <Clock size={11} color="#FB7185" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FB7185", fontFamily: "'DM Mono',monospace", letterSpacing: "0.05em" }}>
                {clockTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
            <OperationalAlertsBadge onClick={() => window.location.href = '/financial-integrity'} />
          </div>
        </div>
        {/* Phase 10D: MFA enforcement banner */}
        {(() => { const { user } = useAuth(); return <MFAEnforcementBanner role={user?.role} className="mb-4" />; })()}
      </Reveal>

      {/* Tabs */}
      <Reveal delay={40}>
        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button key={t.id} data-testid={`admin-tab-${t.id}`} onClick={() => setActiveTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: active ? "rgba(251,113,133,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${active ? "rgba(251,113,133,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "8px 14px", color: active ? "#FB7185" : "rgba(232,238,255,0.5)", fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.18s" }}>
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="af-glass" style={{ borderRadius: 18, padding: "24px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </div>
          <Content />
        </div>
      </Reveal>
    </div>
    </PageTransition>
  );
}
