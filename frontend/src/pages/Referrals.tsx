/**
 * Referrals — Enterprise Redesign
 *
 * All existing hooks, API calls, mutations, and logic preserved exactly.
 * Only the visual layer has changed.
 *
 * New visual features:
 *   - DM Mono section label + Syne page title + subtitle
 *   - 4-stat pill row: Total Referrals · Total Earned · Pending · Withdrawn
 *   - Referral link card with accent line, copy button
 *   - Withdraw earnings card with inline form
 *   - Referred users table with status badges + avatar initials
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { referralsAPI } from "../lib/api";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { queryKeys, invalidate } from "../lib/queryClient";
import { useAuth } from "../contexts/AuthContext";
import { Reveal } from "../components/Reveal";
import { Tilt } from "../components/Tilt";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Check, Users, DollarSign, Gift, TrendingUp,
  ArrowRight, Clock, CheckCircle2, XCircle, ArrowUpRight, Wallet,
} from "lucide-react";

/* ── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg:       "#060810",
  surface:  "#0C0F1A",
  raised:   "#111520",
  border:   "rgba(255,255,255,0.06)",
  borderHv: "rgba(255,255,255,0.11)",
  text:     "#E2E8FF",
  muted:    "rgba(226,232,255,0.45)",
  faint:    "rgba(226,232,255,0.22)",
  green:    "#00C896",
  blue:     "#38BDF8",
  purple:   "#A78BFA",
  amber:    "#FBBF24",
  red:      "#FB7185",
};

/* ── Skeleton ──────────────────────────────────────────────────────── */
function Sk({ w = "100%", h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "rgba(255,255,255,0.05)",
      animation: "af-ref-pulse 1.8s ease-in-out infinite",
    }} />
  );
}

/* ── Card wrapper ──────────────────────────────────────────────────── */
function Card({ children, style = {}, accent }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
}) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: 20,
      position: "relative",
      overflow: "hidden",
      ...style,
    }}>
      {accent && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
        }} />
      )}
      {children}
    </div>
  );
}

/* ── KPI card ──────────────────────────────────────────────────────── */
function KpiCard({ label, value, color, icon: Icon }: {
  label: string; value: string | number; color: string; icon: any;
}) {
  return (
    <Card accent={color} style={{ flex: "1 1 160px" }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: `${color}12`, border: `1px solid ${color}25`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 12,
      }}>
        <Icon size={15} color={color} />
      </div>
      <div style={{
        fontSize: "1.6rem", fontWeight: 900,
        fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em",
        color: C.text, lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>
        {label}
      </div>
    </Card>
  );
}

/* ── Section label ─────────────────────────────────────────────────── */
function SectionLabel({ children, color = C.faint }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color,
      fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em",
      textTransform: "uppercase", marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

/* ── Input field ───────────────────────────────────────────────────── */
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%", background: C.raised,
        border: `1px solid ${C.border}`, borderRadius: 10,
        padding: "10px 14px", color: C.text, fontSize: 14,
        fontFamily: "'DM Sans',sans-serif", outline: "none",
        boxSizing: "border-box",
        ...props.style,
      }}
    />
  );
}

/* ── Main component ────────────────────────────────────────────────── */
export default function Referrals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBankName, setWithdrawBankName] = useState("");
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [withdrawAccountName, setWithdrawAccountName] = useState("");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  const { data: stats } = useQuery({ queryKey: queryKeys.referralStats, queryFn: () => referralsAPI.stats() });
  const { data: refs = [] } = useQuery({ queryKey: queryKeys.referrals, queryFn: () => referralsAPI.list().then((d: any) => d.referrals || []) });
  const { data: balance } = useQuery({ queryKey: ["referrals", "balance"], queryFn: () => referralsAPI.balance() });

  const withdrawMut = useMutation({
    mutationFn: (data: any) => referralsAPI.withdraw(data),
    onSuccess: () => {
      toast({ title: "Withdrawal requested!" });
      invalidate.referrals();
      setShowWithdrawForm(false);
      setWithdrawAmount("");
      setWithdrawBankName("");
      setWithdrawAccountNumber("");
      setWithdrawAccountName("");
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const refCode = user?.referral_code || (user as any)?.referralCode || "";
  const refLink = refCode ? `${window.location.origin}/register?ref=${refCode}` : "";

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard!" });
  };

  const earned    = (stats as any)?.lifetimeEarned    ?? (balance as any)?.availableBalance  ?? 0;
  const pending   = (stats as any)?.pendingBalance     ?? (balance as any)?.pendingBalance    ?? 0;
  const withdrawn = (stats as any)?.withdrawn          ?? (balance as any)?.lifetimeWithdrawn ?? 0;
  const refCount  = (stats as any)?.totalReferrals     ?? (refs as any[]).length;

  return (
    <PageTransition variant="slide">
      <div style={{ padding: "32px", maxWidth: 1000, margin: "0 auto", background: C.bg, minHeight: "100vh" }}>

        {/* ── Page header ── */}
        <Reveal>
          <div style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.purple,
              fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: 8,
            }}>
              PLATFORM · REFERRALS
            </div>
            <h1 style={{
              fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900,
              fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em",
              color: C.text, margin: 0,
            }}>
              Referral Program
            </h1>
            <p style={{ fontSize: 14, color: C.muted, marginTop: 6, fontFamily: "'DM Sans',sans-serif" }}>
              Invite teams, earn commissions on every plan upgrade.
            </p>
          </div>
        </Reveal>

        {/* ── KPI row ── */}
        <Reveal delay={40}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
            <KpiCard label="Total Referrals"  value={refCount}                     color={C.purple}  icon={Users} />
            <KpiCard label="Total Earned"     value={`₦${earned.toLocaleString()}`}    color={C.green}   icon={DollarSign} />
            <KpiCard label="Pending"          value={`₦${pending.toLocaleString()}`}   color={C.amber}   icon={Clock} />
            <KpiCard label="Withdrawn"        value={`₦${withdrawn.toLocaleString()}`} color={C.blue}    icon={TrendingUp} />
          </div>
        </Reveal>

        {/* ── Referral link card ── */}
        <Reveal delay={60}>
          <Card accent={C.purple} style={{ marginBottom: 20, border: `1px solid rgba(167,139,250,0.15)` }}>
            <SectionLabel color={C.purple}>YOUR REFERRAL LINK</SectionLabel>

            {refLink ? (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    flex: 1, background: C.raised,
                    border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: "11px 14px",
                    fontFamily: "'DM Mono',monospace", fontSize: 12, color: C.muted,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {refLink}
                  </div>
                  <button
                    data-testid="button-copy-link"
                    onClick={() => copy(refLink)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: copied ? C.green : C.purple,
                      border: "none", borderRadius: 10, padding: "11px 18px",
                      color: "#04060F", fontSize: 13, fontWeight: 700,
                      cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                      flexShrink: 0, transition: "background 0.2s",
                    }}
                  >
                    {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                  </button>
                </div>

                {refCode && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Sans',sans-serif" }}>
                      Referral code:
                    </span>
                    <button
                      data-testid="button-copy-code"
                      onClick={() => copy(refCode)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        background: "rgba(167,139,250,0.08)",
                        border: "1px solid rgba(167,139,250,0.2)",
                        borderRadius: 8, padding: "4px 12px",
                        color: C.purple, fontSize: 12, fontWeight: 700,
                        cursor: "pointer", fontFamily: "'DM Mono',monospace",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.14)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.08)"; }}
                    >
                      {refCode} <Copy size={10} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: C.faint, fontFamily: "'DM Sans',sans-serif" }}>
                No referral code yet. Upgrade your plan to get one.
              </div>
            )}
          </Card>
        </Reveal>

        {/* ── Withdraw card ── */}
        <Reveal delay={80}>
          <Card accent={C.green} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <SectionLabel color={C.green}>WITHDRAW EARNINGS</SectionLabel>
              <div style={{
                fontSize: 13, fontWeight: 700, color: C.green,
                fontFamily: "'Syne',sans-serif",
              }}>
                Balance: ₦{earned.toLocaleString()}
              </div>
            </div>

            {!showWithdrawForm ? (
              <button
                data-testid="button-show-withdraw"
                onClick={() => setShowWithdrawForm(true)}
                disabled={earned === 0}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: earned > 0 ? C.green : "rgba(255,255,255,0.04)",
                  border: `1px solid ${earned > 0 ? C.green : C.border}`,
                  borderRadius: 10, padding: "10px 20px",
                  color: earned > 0 ? "#04060F" : C.faint,
                  fontSize: 13, fontWeight: 700,
                  cursor: earned > 0 ? "pointer" : "not-allowed",
                  fontFamily: "'DM Sans',sans-serif",
                  transition: "opacity 0.15s",
                }}
              >
                <Wallet size={14} />
                {earned > 0 ? "Request Withdrawal" : "No balance to withdraw"}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Input
                  data-testid="input-withdraw-amount"
                  type="number"
                  placeholder="Amount (₦)"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                />
                <Input
                  data-testid="input-withdraw-bank-name"
                  type="text"
                  placeholder="Bank name"
                  value={withdrawBankName}
                  onChange={e => setWithdrawBankName(e.target.value)}
                />
                <Input
                  data-testid="input-withdraw-account-number"
                  type="text"
                  placeholder="Account number"
                  value={withdrawAccountNumber}
                  onChange={e => setWithdrawAccountNumber(e.target.value)}
                />
                <Input
                  data-testid="input-withdraw-account-name"
                  type="text"
                  placeholder="Account name"
                  value={withdrawAccountName}
                  onChange={e => setWithdrawAccountName(e.target.value)}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    data-testid="button-withdraw"
                    onClick={() => withdrawMut.mutate({
                      amount: Number(withdrawAmount),
                      bankName: withdrawBankName,
                      accountNumber: withdrawAccountNumber,
                      accountName: withdrawAccountName,
                    })}
                    disabled={withdrawMut.isPending}
                    style={{
                      background: C.green, border: "none", borderRadius: 10,
                      padding: "10px 24px", color: "#04060F",
                      fontSize: 13, fontWeight: 700,
                      cursor: withdrawMut.isPending ? "not-allowed" : "pointer",
                      fontFamily: "'DM Sans',sans-serif",
                      opacity: withdrawMut.isPending ? 0.7 : 1,
                      transition: "opacity 0.15s",
                    }}
                  >
                    {withdrawMut.isPending ? "Processing…" : "Withdraw"}
                  </button>
                  <button
                    onClick={() => setShowWithdrawForm(false)}
                    style={{
                      background: "transparent",
                      border: `1px solid ${C.border}`,
                      borderRadius: 10, padding: "10px 18px",
                      color: C.muted, fontSize: 13,
                      cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>
        </Reveal>

        {/* ── Referred users table ── */}
        <Reveal delay={100}>
          <Card accent={C.blue}>
            <SectionLabel>REFERRED USERS</SectionLabel>

            {(refs as any[]).length === 0 ? (
              <div style={{
                textAlign: "center", padding: "40px 0",
                color: C.faint, fontSize: 13,
                fontFamily: "'DM Sans',sans-serif",
              }}>
                No referrals yet — share your link to start earning!
              </div>
            ) : (
              <>
                {/* table header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 100px 60px",
                  gap: 12, padding: "6px 12px",
                  borderBottom: `1px solid ${C.border}`,
                  marginBottom: 4,
                }}>
                  {["USER", "PLAN", "COMMISSION", "STATUS"].map(h => (
                    <div key={h} style={{
                      fontSize: 10, fontWeight: 700, color: C.faint,
                      fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em",
                    }}>
                      {h}
                    </div>
                  ))}
                </div>

                {/* rows */}
                {(refs as any[]).map((r: any, i: number) => {
                  const isPaid = r.referred_plan && r.referred_plan !== "free";
                  return (
                    <div
                      key={i}
                      data-testid={`referral-row-${i}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 100px 100px 60px",
                        gap: 12, padding: "10px 12px",
                        borderRadius: 8, transition: "background 0.12s",
                        cursor: "default",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {/* user */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "rgba(167,139,250,0.1)",
                          border: "1px solid rgba(167,139,250,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800, color: C.purple,
                          flexShrink: 0,
                        }}>
                          {(r.referred_name || r.referred_email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
                            {r.referred_name || r.referred_email || "User"}
                          </div>
                          {r.referred_email && r.referred_name && (
                            <div style={{ fontSize: 11, color: C.faint, fontFamily: "'DM Mono',monospace" }}>
                              {r.referred_email}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* plan */}
                      <div style={{ alignSelf: "center" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: isPaid ? C.blue : C.faint,
                          background: isPaid ? "rgba(56,189,248,0.08)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${isPaid ? "rgba(56,189,248,0.2)" : C.border}`,
                          borderRadius: 100, padding: "3px 9px",
                          fontFamily: "'DM Mono',monospace",
                        }}>
                          {r.referred_plan ? r.referred_plan.toUpperCase() : "FREE"}
                        </span>
                      </div>

                      {/* commission */}
                      <div style={{
                        fontSize: 13, fontWeight: 700,
                        color: r.reward_amount ? C.green : C.faint,
                        fontFamily: "'Syne',sans-serif",
                        alignSelf: "center",
                      }}>
                        {r.reward_amount ? `+₦${Number(r.reward_amount).toLocaleString()}` : "—"}
                      </div>

                      {/* status dot */}
                      <div style={{ alignSelf: "center" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontSize: 10, fontWeight: 700,
                          color: isPaid ? C.green : C.amber,
                          background: isPaid ? "rgba(0,200,150,0.08)" : "rgba(251,191,36,0.08)",
                          border: `1px solid ${isPaid ? "rgba(0,200,150,0.2)" : "rgba(251,191,36,0.2)"}`,
                          borderRadius: 100, padding: "3px 9px",
                          fontFamily: "'DM Mono',monospace",
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: "50%",
                            background: isPaid ? C.green : C.amber,
                          }} />
                          {isPaid ? "PAID" : "FREE"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </Card>
        </Reveal>

        <style>{`
          @keyframes af-ref-pulse {
            0%,100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    </PageTransition>
  );
}
