/**
 * AffiliateApplicationForm — full affiliate program application.
 *
 * Collects everything routes/affiliates.js `POST /affiliates/apply` requires:
 *  full_name, promotional_channels[], primary_channel_url, audience_size_bucket,
 *  promotion_plan, payout_account_id, agree_terms, self_referral_ack.
 *
 * Rejected applicants are permanently blocked server-side (403) — this form is
 * only ever rendered by Referrals.tsx when the caller has no affiliate row, or
 * had one that is not `rejected`.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { affiliatesAPI } from "../lib/api";
import { invalidate } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PayoutAccountForm, { type PayoutAccount } from "./PayoutAccountForm";
import { Star, Loader2 } from "lucide-react";

const C = {
  raised: "#111520",
  border: "rgba(255,255,255,0.08)",
  text:   "#E2E8FF",
  muted:  "rgba(226,232,255,0.5)",
  amber:  "#FBBF24",
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: C.raised,
  border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px",
  color: C.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6,
  display: "block", fontFamily: "'DM Mono',monospace", letterSpacing: "0.05em",
};

const CHANNELS: { value: string; label: string }[] = [
  { value: "website",     label: "Website / Blog" },
  { value: "youtube",     label: "YouTube" },
  { value: "instagram",   label: "Instagram" },
  { value: "tiktok",      label: "TikTok" },
  { value: "x",           label: "X (Twitter)" },
  { value: "whatsapp",    label: "WhatsApp" },
  { value: "email_list",  label: "Email list" },
  { value: "other",       label: "Other" },
];

const AUDIENCE_BUCKETS: { value: string; label: string }[] = [
  { value: "under_1k",  label: "Under 1,000" },
  { value: "1k_10k",    label: "1,000 – 10,000" },
  { value: "10k_50k",   label: "10,000 – 50,000" },
  { value: "50k_250k",  label: "50,000 – 250,000" },
  { value: "250k_plus", label: "250,000+" },
];

export default function AffiliateApplicationForm() {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [channelUrl, setChannelUrl] = useState("");
  const [audience, setAudience] = useState("");
  const [plan, setPlan] = useState("");
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [selfReferralAck, setSelfReferralAck] = useState(false);

  const applyMut = useMutation({
    mutationFn: () => affiliatesAPI.apply({
      full_name: fullName,
      promotional_channels: channels,
      primary_channel_url: channelUrl,
      audience_size_bucket: audience,
      promotion_plan: plan,
      payout_account_id: payoutAccount!.id,
      agree_terms: agreeTerms,
      self_referral_ack: selfReferralAck,
    }),
    onSuccess: () => {
      toast({ title: "Application submitted", description: "We'll review it shortly." });
      invalidate.affiliates();
    },
    onError: (e: any) => toast({ title: "Could not submit application", description: e?.message, variant: "destructive" }),
  });

  const toggleChannel = (v: string) =>
    setChannels(cs => cs.includes(v) ? cs.filter(c => c !== v) : [...cs, v]);

  const canSubmit =
    fullName.trim().length >= 2 &&
    channels.length > 0 &&
    channelUrl.trim().length > 0 &&
    !!audience &&
    plan.trim().length >= 50 &&
    !!payoutAccount &&
    agreeTerms &&
    selfReferralAck;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ fontSize: 13, color: C.muted, fontFamily: "'DM Sans',sans-serif", maxWidth: 560 }}>
        Go beyond the one-time bounty: apply to become an affiliate and earn
        <strong style={{ color: C.text }}> 15% recurring commission</strong> on every referred
        customer's monthly plan, paid out on every renewal for up to 12 months.
      </p>

      <div>
        <label style={labelStyle}>Full name</label>
        <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full legal name" />
      </div>

      <div>
        <label style={labelStyle}>How will you promote AutoFlowNG? (select all that apply)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CHANNELS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => toggleChannel(c.value)}
              style={{
                fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 100,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                background: channels.includes(c.value) ? "rgba(251,191,36,0.14)" : "transparent",
                border: `1px solid ${channels.includes(c.value) ? C.amber : C.border}`,
                color: channels.includes(c.value) ? C.amber : C.muted,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Primary channel URL</label>
        <input style={inputStyle} value={channelUrl} onChange={e => setChannelUrl(e.target.value)} placeholder="https://…" />
      </div>

      <div>
        <label style={labelStyle}>Audience size</label>
        <select style={{ ...inputStyle, appearance: "auto" }} value={audience} onChange={e => setAudience(e.target.value)}>
          <option value="">Select…</option>
          {AUDIENCE_BUCKETS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>How do you plan to promote us? (min 50 characters)</label>
        <textarea
          style={{ ...inputStyle, minHeight: 90, resize: "vertical", fontFamily: "'DM Sans',sans-serif" }}
          value={plan}
          onChange={e => setPlan(e.target.value)}
          placeholder="Describe your promotion strategy…"
        />
        <div style={{ fontSize: 10, color: C.muted, marginTop: 4, textAlign: "right" }}>{plan.length}/500</div>
      </div>

      <div>
        <label style={labelStyle}>Payout account (commissions will be paid here)</label>
        <PayoutAccountForm onSaved={setPayoutAccount} compact />
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: C.muted, fontFamily: "'DM Sans',sans-serif" }}>
        <input type="checkbox" checked={selfReferralAck} onChange={e => setSelfReferralAck(e.target.checked)} style={{ marginTop: 2 }} />
        I understand that referring myself or accounts I control is prohibited and will result in permanent rejection.
      </label>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: C.muted, fontFamily: "'DM Sans',sans-serif" }}>
        <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} style={{ marginTop: 2 }} />
        I agree to the <a href="/affiliate-terms.html" target="_blank" rel="noreferrer" style={{ color: C.amber }}>Affiliate Program Terms</a>.
      </label>

      <div>
        <button
          onClick={() => applyMut.mutate()}
          disabled={!canSubmit || applyMut.isPending}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: C.amber, border: "none", borderRadius: 10,
            padding: "10px 20px", color: "#04060F", fontSize: 13, fontWeight: 700,
            cursor: !canSubmit || applyMut.isPending ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans',sans-serif", opacity: !canSubmit || applyMut.isPending ? 0.5 : 1,
          }}
        >
          {applyMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <><Star size={14} /> Submit Application</>}
        </button>
      </div>
    </div>
  );
}
