/**
 * AutoFlowNG — Financial Governance Center (Phase 10C)
 *
 * Admin-only page. Sections:
 *   - Overview (pending withdrawals, pending conversions, fraud summary)
 *   - Withdrawal Queue (approve / reject)
 *   - Referral Conversions (approve / reject)
 *   - Reward Configuration (per-region reward amounts)
 *   - Reward Campaigns (create / activate bonus campaigns)
 *   - Fraud Report (open flags, trend, top-risk)
 *   - Payout Audit (full history)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { isSuperAdmin } from "../lib/rbac";
import { PageTransition } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, DollarSign, AlertTriangle, CheckCircle2, XCircle,
  Globe, Zap, BarChart2, Users, Clock, TrendingUp, Settings2,
  RefreshCw, ChevronDown, ChevronUp, Plus,
} from "lucide-react";

const base = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const fgAPI = {
  overview:     () => apiFetch('/api/financial-governance/overview'),
  withdrawals:  (status = 'pending') => apiFetch(`/api/wallet/admin/withdrawals?status=${status}`),
  conversions:  (status = 'pending') => apiFetch(`/api/financial-governance/referral-conversions?status=${status}`),
  rewardConfig: () => apiFetch('/api/financial-governance/reward-config'),
  campaigns:    () => apiFetch('/api/financial-governance/campaigns'),
  fraudReport:  () => apiFetch('/api/financial-governance/fraud-report'),
  payoutAudit:  () => apiFetch('/api/financial-governance/payout-audit'),
  fraudFlags:   () => apiFetch('/api/wallet/admin/fraud-flags'),
  banks:        () => apiFetch('/api/wallet/admin/banks'),
  approveWithdrawal: (id: number, body: any) => apiFetch(`/api/wallet/admin/withdrawals/${id}/approve`, { method: 'PATCH', body: JSON.stringify(body) }),
  rejectWithdrawal:  (id: number, body: any) => apiFetch(`/api/wallet/admin/withdrawals/${id}/reject`,  { method: 'PATCH', body: JSON.stringify(body) }),
  approveConversion: (id: number) => apiFetch(`/api/financial-governance/referral-conversions/${id}/approve`, { method: 'PATCH', body: JSON.stringify({}) }),
  rejectConversion:  (id: number, body: any) => apiFetch(`/api/financial-governance/referral-conversions/${id}/reject`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateRewardConfig: (countryCode: string, body: any) => apiFetch(`/api/financial-governance/reward-config/${countryCode}`, { method: 'PUT', body: JSON.stringify(body) }),
  createCampaign:    (body: any) => apiFetch('/api/financial-governance/campaigns', { method: 'POST', body: JSON.stringify(body) }),
  updateCampaign:    (id: number, body: any) => apiFetch(`/api/financial-governance/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  resolveFraudFlag:  (id: number, body: any) => apiFetch(`/api/wallet/admin/fraud-flags/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(body) }),
  freezeWallet:      (userId: number, body: any) => apiFetch(`/api/wallet/admin/wallets/${userId}/freeze`, { method: 'PATCH', body: JSON.stringify(body) }),
};

const S = {
  glass: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px" } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 4 } as React.CSSProperties,
  val:   { fontSize: "1.5rem", fontWeight: 900, fontFamily: "'Syne',sans-serif" } as React.CSSProperties,
  sub:   { fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" } as React.CSSProperties,
  row:   { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" } as React.CSSProperties,
  input: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 12px", color: "#E8EEFF", fontSize: 12, fontFamily: "'DM Mono',monospace", outline: "none" } as React.CSSProperties,
  btn:   (color: string, solid = false) => ({
    display: "flex", alignItems: "center", gap: 5,
    background: solid ? color : `${color}15`,
    border: `1px solid ${color}40`,
    borderRadius: 8, padding: "5px 12px",
    color: solid ? "#04060F" : color,
    fontSize: 11, fontWeight: 700, cursor: "pointer",
    fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap",
  }) as React.CSSProperties,
};

function SeverityBadge({ severity }: { severity: string }) {
  const m: Record<string, string> = { critical: "#FB7185", high: "#F59E0B", medium: "#FBBF24", low: "#38BDF8" };
  const c = m[severity] || "#E8EEFF";
  return (
    <span style={{ fontSize: 9, fontWeight: 800, color: c, background: `${c}18`, border: `1px solid ${c}30`, borderRadius: 100, padding: "2px 7px", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
      {severity}
    </span>
  );
}

function AmountCell({ amount, currency }: { amount: number; currency?: string }) {
  const symbols: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", GHS: "₵", EUR: "€" };
  const sym = symbols[currency || "NGN"] || "$";
  return <span style={{ fontWeight: 700, color: "#00C896", fontFamily: "'Syne',sans-serif" }}>{sym}{parseFloat(String(amount)).toLocaleString()}</span>;
}

// ── Withdrawal Queue ──────────────────────────────────────────────────────────

// Transfer status badge for Paystack payout state
function TransferBadge({ status }: { status?: string }) {
  if (!status) return null;
  const m: Record<string, { color: string; label: string }> = {
    pending:  { color: "#FBBF24", label: "⟳ Transfer pending" },
    success:  { color: "#00C896", label: "✓ Paid via Paystack" },
    failed:   { color: "#FB7185", label: "✗ Transfer failed" },
    reversed: { color: "#F59E0B", label: "↩ Reversed by bank" },
  };
  const s = m[status];
  if (!s) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: `${s.color}12`, border: `1px solid ${s.color}30`, borderRadius: 100, padding: "2px 8px", fontFamily: "'DM Mono',monospace" }}>
      {s.label}
    </span>
  );
}

function WithdrawalQueue() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["fg", "withdrawals", "pending"],
    queryFn:  () => fgAPI.withdrawals("pending"),
    refetchInterval: 15_000,
  });

  const approveMut = useMutation({
    mutationFn: ({ id }: any) => { setApprovingId(id); return fgAPI.approveWithdrawal(id, {}); },
    onSuccess: (res: any) => {
      setApprovingId(null);
      if (res.transferCode) {
        toast({
          title: "✓ Transfer initiated",
          description: `${res.message} Code: ${res.transferCode}`,
        });
      } else if (res.manual) {
        toast({
          title: "Approved — manual payout",
          description: res.message,
        });
      } else if (res.transferError) {
        toast({
          title: "Approved — transfer failed",
          description: res.transferError,
          variant: "destructive",
        });
      } else {
        toast({ title: "Withdrawal approved" });
      }
      qc.invalidateQueries({ queryKey: ["fg", "withdrawals"] });
    },
    onError: (e: any) => { setApprovingId(null); toast({ title: "Error", description: e?.message, variant: "destructive" }); },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: any) => fgAPI.rejectWithdrawal(id, { reason }),
    onSuccess: () => { toast({ title: "Withdrawal rejected — funds returned to wallet" }); setRejectId(null); setRejectReason(""); qc.invalidateQueries({ queryKey: ["fg", "withdrawals"] }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <div style={{ padding: 24, textAlign: "center", color: "rgba(232,238,255,0.2)" }}>Loading…</div>;
  const items = (data as any)?.withdrawals || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!items.length ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "rgba(232,238,255,0.2)", fontSize: 13 }}>
          <CheckCircle2 size={24} color="rgba(0,200,150,0.3)" style={{ marginBottom: 8 }} />
          <div>No pending withdrawals</div>
        </div>
      ) : items.map((w: any) => (
        <div key={w.id} style={{ ...S.row, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF" }}>
                {w.user_name} <span style={{ fontSize: 11, color: "rgba(232,238,255,0.3)" }}>· {w.user_email}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                {w.bank_name} · {w.account_number} · {w.account_name}
              </div>
              {/* Paystack transfer status (if already processing) */}
              {w.transfer_status && (
                <div style={{ marginTop: 4 }}>
                  <TransferBadge status={w.transfer_status} />
                  {w.transfer_reference && (
                    <span style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace", marginLeft: 8 }}>
                      ref: {w.transfer_reference}
                    </span>
                  )}
                  {w.transfer_error && (
                    <div style={{ fontSize: 10, color: "#FB7185", fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                      {w.transfer_error}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <AmountCell amount={w.requested_amount} currency={w.currency} />
              {w.fraud_score > 0 && (
                <span style={{ fontSize: 10, color: w.fraud_score >= 60 ? "#FB7185" : "#FBBF24", fontFamily: "'DM Mono',monospace" }}>
                  fraud: {w.fraud_score}
                </span>
              )}
              {w.currency !== "NGN" && (
                <span style={{ fontSize: 10, color: "#38BDF8", fontFamily: "'DM Mono',monospace" }}>manual payout</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => approveMut.mutate({ id: w.id })}
                disabled={approveMut.isPending && approvingId === w.id}
                style={S.btn("#00C896", true)}
                title={w.currency === "NGN" ? "Approve + send via Paystack Transfers" : "Approve (manual payout — non-NGN)"}
              >
                {approveMut.isPending && approvingId === w.id
                  ? <><RefreshCw size={10} className="animate-spin" /> Sending…</>
                  : <><CheckCircle2 size={11} /> {w.currency === "NGN" ? "Approve & Pay" : "Approve"}</>
                }
              </button>
              <button onClick={() => setRejectId(w.id)} style={S.btn("#FB7185")}>
                <XCircle size={11} /> Reject
              </button>
            </div>
          </div>
          {rejectId === w.id && (
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                placeholder="Rejection reason (required) — funds will be returned"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                style={{ ...S.input, flex: 1 }}
              />
              <button
                onClick={() => rejectMut.mutate({ id: w.id, reason: rejectReason })}
                disabled={!rejectReason || rejectMut.isPending}
                style={S.btn("#FB7185", true)}
              >
                Confirm Reject
              </button>
              <button onClick={() => { setRejectId(null); setRejectReason(""); }} style={S.btn("rgba(232,238,255,0.3)")}>Cancel</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Fraud Flags Panel ─────────────────────────────────────────────────────────

function FraudFlagsPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: ["fg", "fraud-flags"], queryFn: fgAPI.fraudFlags });

  const resolveMut = useMutation({
    mutationFn: ({ id, unfreeze }: any) => fgAPI.resolveFraudFlag(id, { resolution_note: "Resolved by admin", unfreeze_wallet: unfreeze }),
    onSuccess: () => { toast({ title: "Flag resolved" }); qc.invalidateQueries({ queryKey: ["fg"] }); },
  });

  const flags = (data as any)?.flags || [];
  const openFlags = flags.filter((f: any) => !f.resolved);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!openFlags.length ? (
        <div style={{ padding: "20px 0", textAlign: "center", color: "rgba(232,238,255,0.2)", fontSize: 13 }}>
          <Shield size={20} color="rgba(0,200,150,0.3)" style={{ marginBottom: 6 }} />
          <div>No open fraud flags</div>
        </div>
      ) : openFlags.slice(0, 10).map((f: any) => (
        <div key={f.id} style={{ ...S.row, flexWrap: "wrap", gap: 10 }}>
          <SeverityBadge severity={f.severity} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E8EEFF" }}>{f.flag_type.replace(/_/g, ' ')}</div>
            <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>{f.user_name} · score {f.risk_score}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => resolveMut.mutate({ id: f.id, unfreeze: false })} style={S.btn("#00C896")}>
              <CheckCircle2 size={10} /> Resolve
            </button>
            <button onClick={() => resolveMut.mutate({ id: f.id, unfreeze: true })} style={S.btn("#38BDF8")}>
              Resolve + Unfreeze
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Reward Config Table ───────────────────────────────────────────────────────

function RewardConfigTable({ isSA }: { isSA: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: ["fg", "reward-config"], queryFn: fgAPI.rewardConfig });
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const updateMut = useMutation({
    mutationFn: ({ code, amount }: any) => fgAPI.updateRewardConfig(code, { reward_amount: parseFloat(amount) }),
    onSuccess: () => { toast({ title: "Reward config updated" }); setEditing(null); qc.invalidateQueries({ queryKey: ["fg", "reward-config"] }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const configs = (data as any)?.configs || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {configs.map((c: any) => (
        <div key={c.country_code} style={{ ...S.row, flexWrap: "wrap" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#A78BFA", fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{c.country_code}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF" }}>{c.country_name}</div>
            <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>{c.currency_code} · {c.total_conversions || 0} conversions</div>
          </div>
          {editing === c.country_code ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" style={{ ...S.input, width: 90 }} />
              <button onClick={() => updateMut.mutate({ code: c.country_code, amount })} style={S.btn("#00C896", true)}>Save</button>
              <button onClick={() => setEditing(null)} style={S.btn("rgba(232,238,255,0.3)")}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#00C896" }}>{c.currency_symbol}{parseFloat(c.reward_amount).toLocaleString()}</span>
              {isSA && (
                <button onClick={() => { setEditing(c.country_code); setAmount(String(c.reward_amount)); }} style={S.btn("#A78BFA")}>
                  <Settings2 size={10} /> Edit
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FinancialGovernance() {
  const { user } = useAuth();
  const isSA = isSuperAdmin((user as any)?.role);
  const [activeSection, setActiveSection] = useState("overview");

  const { data: overview } = useQuery({
    queryKey: ["fg", "overview"],
    queryFn:  fgAPI.overview,
    refetchInterval: 60_000,
  });

  const o = (overview as any) || {};

  const nav = [
    { id: "overview",     label: "Overview",        icon: BarChart2 },
    { id: "withdrawals",  label: "Withdrawals",     icon: DollarSign },
    { id: "conversions",  label: "Conversions",     icon: Users },
    { id: "fraud",        label: "Fraud Flags",     icon: AlertTriangle },
    { id: "reward-config",label: "Reward Config",   icon: Globe },
  ];

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <Reveal>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#FBBF24", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>FINANCIAL GOVERNANCE</div>
            <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", marginBottom: 4 }}>
              Financial Governance Center
            </h1>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.4)" }}>
              Review withdrawals, approve referral conversions, manage rewards, and monitor fraud.
            </p>
          </div>
        </Reveal>

        {/* Overview stats */}
        <Reveal delay={40}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Pending Withdrawals", value: o.pendingWithdrawals?.count ?? "—", sub: `₦${(o.pendingWithdrawals?.amount || 0).toLocaleString()}`, color: "#FBBF24" },
              { label: "Pending Conversions", value: o.pendingConversions?.count ?? "—", sub: `${o.pendingConversions?.count || 0} to review`, color: "#A78BFA" },
              { label: "Total Rewarded",      value: o.totalRewardsIssued?.count ?? "—", sub: `₦${(o.totalRewardsIssued?.amount || 0).toLocaleString()} issued`, color: "#00C896" },
              { label: "Open Fraud Flags",    value: o.fraudSummary?.total ?? "—", sub: `${o.fraudSummary?.bySeverity?.find((s: any) => s.severity === 'critical')?.cnt || 0} critical`, color: "#FB7185" },
              { label: "Total Withdrawn",     value: o.totalWithdrawn?.count ?? "—", sub: `₦${(o.totalWithdrawn?.amount || 0).toLocaleString()} paid`, color: "#38BDF8" },
            ].map(s => (
              <div key={s.label} style={S.glass}>
                <div style={S.label}>{s.label}</div>
                <div style={{ ...S.val, color: s.color }}>{s.value}</div>
                <div style={S.sub}>{s.sub}</div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Nav tabs */}
        <Reveal delay={60}>
          <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
            {nav.map(n => {
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => setActiveSection(n.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 9,
                    border: activeSection === n.id ? "1px solid rgba(167,139,250,0.3)" : "1px solid transparent",
                    background: activeSection === n.id ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.02)",
                    color: activeSection === n.id ? "#A78BFA" : "rgba(232,238,255,0.4)",
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                    fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em",
                  }}
                >
                  <Icon size={12} /> {n.label}
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* Sections */}
        <Reveal delay={80}>

          {activeSection === "overview" && (
            <div style={S.glass}>
              <div style={{ ...S.label, marginBottom: 14 }}>RECENT FINANCIAL ACTIVITY</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(o.recentActivity || []).slice(0, 10).map((a: any, i: number) => (
                  <div key={i} style={{ ...S.row }}>
                    <div style={{ fontSize: 11, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>{a.entry_type?.replace(/_/g, ' ')}</div>
                    <div style={{ flex: 1, fontSize: 12, color: "rgba(232,238,255,0.6)" }}>{a.user_name}</div>
                    <AmountCell amount={a.amount} currency={a.currency} />
                    <div style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>{new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
                {!o.recentActivity?.length && (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "rgba(232,238,255,0.2)", fontSize: 13 }}>No recent activity</div>
                )}
              </div>
            </div>
          )}

          {activeSection === "withdrawals" && (
            <div style={S.glass}>
              <div style={{ ...S.label, marginBottom: 14 }}>PENDING WITHDRAWAL QUEUE</div>
              <WithdrawalQueue />
            </div>
          )}

          {activeSection === "conversions" && (
            <div style={S.glass}>
              <div style={{ ...S.label, marginBottom: 14 }}>PENDING REFERRAL CONVERSIONS</div>
              <ConversionsPanel />
            </div>
          )}

          {activeSection === "fraud" && (
            <div style={S.glass}>
              <div style={{ ...S.label, marginBottom: 14 }}>OPEN FRAUD FLAGS</div>
              <FraudFlagsPanel />
            </div>
          )}

          {activeSection === "reward-config" && (
            <div style={S.glass}>
              <div style={{ ...S.label, marginBottom: 14 }}>REGIONAL REWARD CONFIGURATION {!isSA && "(view only)"}</div>
              <RewardConfigTable isSA={isSA} />
            </div>
          )}

        </Reveal>
      </div>
    </PageTransition>
  );
}

// ── Conversions Panel ─────────────────────────────────────────────────────────

function ConversionsPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["fg", "conversions"],
    queryFn:  () => fgAPI.conversions("pending"),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => fgAPI.approveConversion(id),
    onSuccess: () => { toast({ title: "Conversion approved — reward credited" }); qc.invalidateQueries({ queryKey: ["fg"] }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: any) => fgAPI.rejectConversion(id, { reason }),
    onSuccess: () => { toast({ title: "Conversion rejected" }); qc.invalidateQueries({ queryKey: ["fg"] }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <div style={{ padding: 24, textAlign: "center", color: "rgba(232,238,255,0.2)" }}>Loading…</div>;
  const items = (data as any)?.conversions || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!items.length ? (
        <div style={{ padding: "20px 0", textAlign: "center", color: "rgba(232,238,255,0.2)", fontSize: 13 }}>
          <CheckCircle2 size={20} color="rgba(0,200,150,0.3)" style={{ marginBottom: 6 }} />
          <div>No pending conversions</div>
        </div>
      ) : items.map((c: any) => (
        <div key={c.id} style={{ ...S.row, flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E8EEFF" }}>
              {c.referrer_name} → {c.referred_name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>
              Plan: {c.plan} · Score: {c.fraud_score}
            </div>
          </div>
          <AmountCell amount={c.reward_amount} currency={c.reward_currency} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => approveMut.mutate(c.id)} disabled={approveMut.isPending} style={S.btn("#00C896", true)}>
              <CheckCircle2 size={10} /> Approve
            </button>
            <button onClick={() => rejectMut.mutate({ id: c.id, reason: "Fraud risk" })} style={S.btn("#FB7185")}>
              <XCircle size={10} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
