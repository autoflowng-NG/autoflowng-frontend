import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { referralsAPI } from "../lib/api";
import { PageTransition, Stagger, StaggerItem } from "../components/PageTransition";
import { queryKeys, invalidate } from "../lib/queryClient";
import { useAuth } from "../contexts/AuthContext";
import { Reveal } from "../components/Reveal";
import { Tilt } from "../components/Tilt";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Users, DollarSign, Gift, TrendingUp, ArrowRight, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function Referrals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  const { data: stats } = useQuery({ queryKey: queryKeys.referralStats, queryFn: () => referralsAPI.stats() });
  const { data: refs  = [] } = useQuery({ queryKey: queryKeys.referrals, queryFn: () => referralsAPI.list().then((d: any) => d.referrals || []) });
  const { data: balance } = useQuery({ queryKey: ["referrals", "balance"], queryFn: () => referralsAPI.balance() });

  const withdrawMut = useMutation({
    mutationFn: (data: any) => referralsAPI.withdraw(data),
    onSuccess: () => { toast({ title: "Withdrawal requested!" }); invalidate.referrals(); setShowWithdrawForm(false); setWithdrawAmount(""); },
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

  const earned      = (stats as any)?.total_earned ?? (balance as any)?.earned ?? 0;
  const pending     = (stats as any)?.pending_earnings ?? (balance as any)?.pending ?? 0;
  const withdrawn   = (stats as any)?.total_withdrawn ?? (balance as any)?.withdrawn ?? 0;
  const refCount    = (stats as any)?.total_referrals ?? (refs as any[]).length;

  return (
    <PageTransition variant="slide">
    <div style={{ padding: "32px", maxWidth: 1000, margin: "0 auto" }}>
      <Reveal>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>REFERRAL PROGRAM</div>
          <h1 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF" }}>Earn with AUTOFLOWNG</h1>
          <p style={{ fontSize: 14, color: "rgba(232,238,255,0.4)", marginTop: 4 }}>Invite teams, earn commissions on every plan upgrade.</p>
        </div>
      </Reveal>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Referrals", value: refCount, color: "#A78BFA", icon: Users },
          { label: "Total Earned",    value: `₦${earned.toLocaleString()}`, color: "#00C896", icon: DollarSign },
          { label: "Pending",         value: `₦${pending.toLocaleString()}`, color: "#FBBF24", icon: Clock },
          { label: "Withdrawn",       value: `₦${withdrawn.toLocaleString()}`, color: "#38BDF8", icon: TrendingUp },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal key={s.label} delay={i * 50}>
              <Tilt max={5}>
                <div className="af-glass" style={{ borderRadius: 14, padding: "18px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}15`, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Icon size={15} color={s.color} />
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 900, fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", color: "#E8EEFF" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "rgba(232,238,255,0.4)", marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>{s.label}</div>
                </div>
              </Tilt>
            </Reveal>
          );
        })}
      </div>

      {/* Referral link */}
      <Reveal delay={80}>
        <div className="af-glass-hi" style={{ borderRadius: 18, padding: "24px", marginBottom: 24, border: "1px solid rgba(167,139,250,0.15)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 16 }}>YOUR REFERRAL LINK</div>
          {refLink ? (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "11px 14px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "rgba(232,238,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{refLink}</div>
                <button data-testid="button-copy-link" onClick={() => copy(refLink)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#A78BFA", border: "none", borderRadius: 10, padding: "11px 16px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>
                  {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
              {refCode && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(232,238,255,0.5)" }}>
                  <span>Referral code:</span>
                  <button data-testid="button-copy-code" onClick={() => copy(refCode)} style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6, padding: "4px 10px", color: "#A78BFA", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", display: "flex", alignItems: "center", gap: 4 }}>
                    {refCode} <Copy size={10} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Sans',sans-serif" }}>No referral code yet. Upgrade your plan to get one.</div>
          )}
        </div>
      </Reveal>

      {/* Withdraw */}
      <Reveal delay={100}>
        <div className="af-glass" style={{ borderRadius: 18, padding: "24px", marginBottom: 24, border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em" }}>WITHDRAW EARNINGS</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#00C896" }}>Balance: ₦{earned.toLocaleString()}</div>
          </div>
          {!showWithdrawForm ? (
            <button data-testid="button-show-withdraw" onClick={() => setShowWithdrawForm(true)} disabled={earned === 0} style={{ display: "flex", alignItems: "center", gap: 8, background: earned > 0 ? "#00C896" : "rgba(255,255,255,0.04)", border: "none", borderRadius: 10, padding: "11px 20px", color: earned > 0 ? "#04060F" : "rgba(232,238,255,0.3)", fontSize: 13, fontWeight: 700, cursor: earned > 0 ? "pointer" : "not-allowed", fontFamily: "'DM Sans',sans-serif" }}>
              <DollarSign size={14} /> {earned > 0 ? "Request Withdrawal" : "No balance to withdraw"}
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input data-testid="input-withdraw-amount" type="number" placeholder="Amount (₦)" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 14px", color: "#E8EEFF", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
              <input data-testid="input-withdraw-account" type="text" placeholder="Bank account number" value={withdrawAccount} onChange={e => setWithdrawAccount(e.target.value)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 14px", color: "#E8EEFF", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button data-testid="button-withdraw" onClick={() => withdrawMut.mutate({ amount: Number(withdrawAmount), account: withdrawAccount })} disabled={withdrawMut.isPending} style={{ background: "#00C896", border: "none", borderRadius: 10, padding: "10px 20px", color: "#04060F", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  {withdrawMut.isPending ? "Processing…" : "Withdraw"}
                </button>
                <button onClick={() => setShowWithdrawForm(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 14px", color: "rgba(232,238,255,0.4)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </Reveal>

      {/* Referrals list */}
      <Reveal delay={120}>
        <div className="af-glass" style={{ borderRadius: 18, padding: "24px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 16 }}>REFERRED USERS</div>
          {(refs as any[]).length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(232,238,255,0.2)", fontSize: 13 }}>
              No referrals yet. Share your link to start earning!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(refs as any[]).map((r: any, i: number) => (
                <div key={i} data-testid={`referral-row-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(167,139,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#A78BFA" }}>
                    {(r.name || r.email || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EEFF" }}>{r.name || r.email || "User"}</div>
                    <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace" }}>{r.plan ? `Plan: ${r.plan}` : "Free"}</div>
                  </div>
                  {r.commission && <div style={{ fontSize: 13, fontWeight: 700, color: "#00C896" }}>+₦{r.commission.toLocaleString()}</div>}
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: r.plan && r.plan !== "free" ? "#00C896" : "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
    </PageTransition>
  );
}
