/**
 * AutoFlowNG — Wallet Page (Phase 10C)
 *
 * Shows the user's complete wallet:
 *   - Balance summary (available, pending, lifetime)
 *   - Withdrawal request form (with bank details)
 *   - Ledger transaction history (paginated)
 *   - Withdrawal history with approval status
 *   - Regional info & reward rate display
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { Reveal } from "../components/Reveal";
import { useToast } from "@/hooks/use-toast";
import PayoutAccountForm, { type PayoutAccount } from "../components/PayoutAccountForm";
import { payoutAccountAPI } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import {
  Wallet2, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2,
  XCircle, DollarSign, TrendingUp, Globe, Lock, AlertTriangle,
  ChevronRight, RefreshCw,
} from "lucide-react";

// ── API helper ────────────────────────────────────────────────────────────────

const base = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const walletAPI = {
  balance:     () => apiFetch('/api/wallet'),
  ledger:      (page = 1) => apiFetch(`/api/wallet/ledger?page=${page}&limit=20`),
  withdrawals: () => apiFetch('/api/wallet/withdrawals'),
  withdraw:    (body: any) => apiFetch('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify(body) }),
  regional:    () => apiFetch('/api/regional/me'),
  reward:      () => apiFetch('/api/regional/reward'),
};

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  glass:   { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 22px" } as React.CSSProperties,
  glassHi: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, padding: "20px 22px" } as React.CSSProperties,
  label:   { fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 } as React.CSSProperties,
  value:   { fontSize: "1.7rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em" } as React.CSSProperties,
  sub:     { fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", marginTop: 2 } as React.CSSProperties,
  input:   { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  btn:     (color: string, solid = false) => ({
    display: "flex", alignItems: "center", gap: 6,
    background: solid ? color : `${color}18`,
    border: `1px solid ${color}44`,
    borderRadius: 10, padding: "10px 18px",
    color: solid ? "#04060F" : color,
    fontSize: 13, fontWeight: 700, cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif",
  }) as React.CSSProperties,
};

// ── Entry type label + color map ──────────────────────────────────────────────

const ENTRY_STYLES: Record<string, { label: string; color: string; sign: string }> = {
  referral_credit:      { label: "Referral Credit",    color: "#00C896", sign: "+" },
  referral_pending:     { label: "Pending Reward",     color: "#FBBF24", sign: "~" },
  referral_approved:    { label: "Reward Released",    color: "#00C896", sign: "+" },
  referral_rejected:    { label: "Reward Voided",      color: "#FB7185", sign: "–" },
  withdrawal_request:   { label: "Withdrawal",         color: "#38BDF8", sign: "–" },
  withdrawal_approved:  { label: "Payout Approved",    color: "#A78BFA", sign: "✓" },
  withdrawal_rejected:  { label: "Withdrawal Returned",color: "#00C896", sign: "+" },
  withdrawal_paid:      { label: "Paid Out",           color: "#A78BFA", sign: "–" },
  manual_credit:        { label: "Manual Credit",      color: "#00C896", sign: "+" },
  manual_debit:         { label: "Manual Debit",       color: "#FB7185", sign: "–" },
  fraud_hold:           { label: "Fraud Hold",         color: "#FB7185", sign: "!" },
  fraud_released:       { label: "Hold Lifted",        color: "#00C896", sign: "+" },
};

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    pending:      { color: "#FBBF24", bg: "rgba(251,191,36,0.1)" },
    under_review: { color: "#38BDF8", bg: "rgba(56,189,248,0.1)" },
    approved:     { color: "#00C896", bg: "rgba(0,200,150,0.1)" },
    rejected:     { color: "#FB7185", bg: "rgba(251,113,133,0.1)" },
    paid:         { color: "#A78BFA", bg: "rgba(167,139,250,0.1)" },
    cancelled:    { color: "rgba(232,238,255,0.3)", bg: "rgba(255,255,255,0.04)" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: s.color, background: s.bg,
      border: `1px solid ${s.color}33`, borderRadius: 100,
      padding: "2px 8px", fontFamily: "'DM Mono',monospace",
      letterSpacing: "0.06em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Wallet() {
  const { user } = useAuth();
  const { toast }   = useToast();
  const qc          = useQueryClient();
  const [tab, setTab] = useState<"overview" | "ledger" | "withdrawals">("overview");
  const [showForm, setShowForm] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [amount, setAmount] = useState("");
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount | null>(null);

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet"],
    queryFn:  () => walletAPI.balance(),
    refetchInterval: 30_000,
  });
  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["wallet", "ledger", ledgerPage],
    queryFn:  () => walletAPI.ledger(ledgerPage),
    enabled:  tab === "ledger",
  });
  const { data: withdrawals } = useQuery({
    queryKey: ["wallet", "withdrawals"],
    queryFn:  () => walletAPI.withdrawals(),
    enabled:  tab === "withdrawals",
  });
  const { data: reward } = useQuery({
    queryKey: ["regional", "reward"],
    queryFn:  () => walletAPI.reward(),
  });
  const { data: savedPayoutAccount } = useQuery({
    queryKey: queryKeys.payoutAccount,
    queryFn:  () => payoutAccountAPI.get(),
  });

  const withdrawMut = useMutation({
    mutationFn: (d: any) => walletAPI.withdraw(d),
    onSuccess: (res: any) => {
      toast({ title: "Withdrawal submitted", description: res.message });
      setShowForm(false);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const effectiveAccount: PayoutAccount | null = payoutAccount || (savedPayoutAccount as any)?.account || null;

  const w = (wallet as any) || {};
  const available = w.availableBalance ?? 0;
  const pending   = w.pendingBalance ?? 0;
  const lifetime  = w.lifetimeEarned ?? 0;
  const withdrawn = w.lifetimeWithdrawn ?? 0;
  const currency  = w.currency || reward?.currency || "NGN";
  const symbol    = reward?.symbol || "₦";

  const handleWithdraw = () => {
    if (!amount || !effectiveAccount) {
      toast({ title: "Amount and a saved payout account are required", variant: "destructive" });
      return;
    }
    withdrawMut.mutate({
      amount:          parseFloat(amount),
      payoutAccountId: effectiveAccount.id,
    });
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs = [
    { id: "overview",    label: "Overview" },
    { id: "ledger",      label: "Ledger" },
    { id: "withdrawals", label: "Withdrawals" },
  ] as const;

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1000, margin: "0 auto" }}>

        {/* Header */}
        <Reveal>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>WALLET</div>
            <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF", marginBottom: 4 }}>
              Your Earnings Wallet
            </h1>
            <p style={{ fontSize: 14, color: "rgba(232,238,255,0.4)" }}>
              Track referral rewards, manage withdrawals, and view your complete transaction history.
            </p>
          </div>
        </Reveal>

        {/* Frozen warning */}
        {w.isFrozen && (
          <Reveal>
            <div style={{ background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.25)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <Lock size={16} color="#FB7185" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#FB7185" }}>Wallet frozen</div>
                <div style={{ fontSize: 12, color: "rgba(232,238,255,0.5)" }}>{w.frozenReason || "Contact support for details."}</div>
              </div>
            </div>
          </Reveal>
        )}

        {/* Balance cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Available",       value: `${symbol}${available.toLocaleString()}`, color: "#00C896",  icon: Wallet2 },
            { label: "Pending Review",  value: `${symbol}${pending.toLocaleString()}`,   color: "#FBBF24",  icon: Clock },
            { label: "Lifetime Earned", value: `${symbol}${lifetime.toLocaleString()}`,  color: "#A78BFA",  icon: TrendingUp },
            { label: "Total Withdrawn", value: `${symbol}${withdrawn.toLocaleString()}`, color: "#38BDF8",  icon: ArrowUpCircle },
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.label} delay={i * 40}>
                <div style={S.glass}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${c.color}15`, border: `1px solid ${c.color}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Icon size={14} color={c.color} />
                  </div>
                  <div style={{ ...S.value, color: c.color }}>{c.value}</div>
                  <div style={S.sub}>{c.label}</div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Regional reward badge */}
        {reward && (
          <Reveal delay={80}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, padding: "10px 14px", background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 10 }}>
              <Globe size={13} color="#A78BFA" />
              <span style={{ fontSize: 12, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace" }}>
                Your region earns <strong style={{ color: "#A78BFA" }}>{reward.symbol}{reward.amount} {reward.currency}</strong> per verified referral
                {reward.campaignBonus?.multiplier > 1 && (
                  <span style={{ color: "#00C896" }}> · {reward.campaignBonus.multiplier}× bonus active!</span>
                )}
              </span>
            </div>
          </Reveal>
        )}

        {/* Withdraw CTA */}
        <Reveal delay={100}>
          <div style={{ ...S.glassHi, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 4 }}>WITHDRAW FUNDS</div>
                <div style={{ fontSize: 12, color: "rgba(232,238,255,0.4)" }}>Minimum {symbol}{reward?.minWithdrawal?.toLocaleString() || "1,000"} · Processed within 24–48h</div>
              </div>
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  disabled={available <= 0 || w.isFrozen}
                  style={S.btn("#00C896", available > 0 && !w.isFrozen)}
                >
                  <ArrowDownCircle size={14} /> Request Withdrawal
                </button>
              ) : (
                <button onClick={() => setShowForm(false)} style={S.btn("rgba(232,238,255,0.4)")}>
                  Cancel
                </button>
              )}
            </div>

            {showForm && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <input
                  placeholder={`Amount (${currency})`}
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={S.input}
                />
                <div>
                  <div style={{ ...S.label, marginBottom: 8 }}>PAYOUT ACCOUNT</div>
                  <PayoutAccountForm onSaved={acct => setPayoutAccount(acct)} />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawMut.isPending || !effectiveAccount || !amount}
                    style={S.btn("#00C896", true)}
                  >
                    {withdrawMut.isPending ? <><RefreshCw size={13} className="animate-spin" /> Processing…</> : "Submit Withdrawal"}
                  </button>
                  <span style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>Fraud-checked · Admin reviewed · 24–48h</span>
                </div>
              </div>
            )}
          </div>
        </Reveal>

        {/* Tab navigation */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 4 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: "8px 14px",
                borderRadius: 9,
                border: "none",
                background: tab === t.id ? "rgba(167,139,250,0.12)" : "transparent",
                color: tab === t.id ? "#A78BFA" : "rgba(232,238,255,0.35)",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === "overview" && (
          <Reveal>
            <div style={S.glass}>
              <div style={{ ...S.label, marginBottom: 14 }}>RECENT TRANSACTIONS</div>
              {walletLoading ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: "rgba(232,238,255,0.2)" }}>Loading…</div>
              ) : !w.recentTransactions?.length ? (
                <div style={{ padding: "24px 0", textAlign: "center", color: "rgba(232,238,255,0.2)", fontSize: 13 }}>
                  No transactions yet. Refer users to start earning!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {w.recentTransactions.map((t: any, i: number) => {
                    const s = ENTRY_STYLES[t.entry_type] || { label: t.entry_type, color: "#E8EEFF", sign: "·" };
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}12`, border: `1px solid ${s.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: s.color, fontWeight: 900, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>
                          {s.sign}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF" }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>{new Date(t.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: "'Syne',sans-serif" }}>
                          {s.sign === "–" || s.sign === "!" ? "–" : "+"}
                          {symbol}{parseFloat(t.amount).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Reveal>
        )}

        {/* Tab: Ledger */}
        {tab === "ledger" && (
          <Reveal>
            <div style={S.glass}>
              <div style={{ ...S.label, marginBottom: 14 }}>TRANSACTION LEDGER</div>
              {ledgerLoading ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: "rgba(232,238,255,0.2)" }}>Loading ledger…</div>
              ) : !(ledger as any)?.entries?.length ? (
                <div style={{ padding: "24px 0", textAlign: "center", color: "rgba(232,238,255,0.2)", fontSize: 13 }}>No transactions found.</div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {(ledger as any).entries.map((e: any, i: number) => {
                      const s = ENTRY_STYLES[e.entry_type] || { label: e.entry_type, color: "#E8EEFF", sign: "·" };
                      return (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "9px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF" }}>{s.label}</div>
                            {e.description && <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{e.description}</div>}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.sign === "–" ? "-" : "+"}{symbol}{parseFloat(e.amount).toLocaleString()}</div>
                            <div style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>bal {symbol}{parseFloat(e.balance_after).toLocaleString()}</div>
                          </div>
                          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>
                            {new Date(e.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                    <button onClick={() => setLedgerPage(p => Math.max(1, p - 1))} disabled={ledgerPage === 1} style={S.btn("#A78BFA")}>← Prev</button>
                    <span style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>Page {ledgerPage}</span>
                    <button onClick={() => setLedgerPage(p => p + 1)} disabled={(ledger as any)?.entries?.length < 20} style={S.btn("#A78BFA")}>Next →</button>
                  </div>
                </>
              )}
            </div>
          </Reveal>
        )}

        {/* Tab: Withdrawals */}
        {tab === "withdrawals" && (
          <Reveal>
            <div style={S.glass}>
              <div style={{ ...S.label, marginBottom: 14 }}>WITHDRAWAL HISTORY</div>
              {!(withdrawals as any)?.withdrawals?.length ? (
                <div style={{ padding: "24px 0", textAlign: "center", color: "rgba(232,238,255,0.2)", fontSize: 13 }}>No withdrawals yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(withdrawals as any).withdrawals.map((w: any, i: number) => (
                    <div key={i} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, color: "#E8EEFF", fontSize: 14 }}>
                          {symbol}{parseFloat(w.amount).toLocaleString()} {w.currency}
                        </div>
                        <StatusBadge status={w.status} />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                        <span style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>{w.bank_name} · {w.account_number}</span>
                        <span style={{ fontSize: 11, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>{new Date(w.created_at).toLocaleDateString()}</span>
                      </div>
                      {w.rejection_reason && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "#FB7185", fontFamily: "'DM Mono',monospace" }}>Rejected: {w.rejection_reason}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        )}

      </div>
    </PageTransition>
  );
}
