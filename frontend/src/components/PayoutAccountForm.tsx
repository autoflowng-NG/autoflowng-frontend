/**
 * PayoutAccountForm — shared saved/editable bank payout account widget.
 *
 * Used by:
 *  - Wallet.tsx        (manage the account withdrawals are paid to)
 *  - AffiliateApplicationForm.tsx (pick/create the account commissions are paid to)
 *
 * Backed by:
 *  GET    /api/wallet/payout-account         — current saved account (or null)
 *  GET    /api/wallet/payout-account/banks   — bank list for the dropdown
 *  POST   /api/wallet/payout-account         — verify + save
 *  PATCH  /api/wallet/payout-account/:id     — verify + update
 *  DELETE /api/wallet/payout-account/:id     — soft delete (blocked if default)
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { payoutAccountAPI } from "../lib/api";
import { queryKeys, invalidate } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Landmark, Pencil, Loader2 } from "lucide-react";

const C = {
  raised:  "#111520",
  border:  "rgba(255,255,255,0.08)",
  text:    "#E2E8FF",
  muted:   "rgba(226,232,255,0.5)",
  green:   "#00C896",
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

interface PayoutAccount {
  id: number;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_default: boolean;
  verified_at: string | null;
}

interface Props {
  /** Called with the saved/selected account after a successful save. */
  onSaved?: (account: PayoutAccount) => void;
  /** Compact mode hides the "current account" summary card and jumps straight to the form. */
  compact?: boolean;
}

export default function PayoutAccountForm({ onSaved, compact = false }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.payoutAccount,
    queryFn: () => payoutAccountAPI.get(),
  });
  const { data: banksData } = useQuery({
    queryKey: queryKeys.payoutBanks,
    queryFn: () => payoutAccountAPI.banks(),
  });

  const account: PayoutAccount | null = (data as any)?.account || null;
  const banks: { name: string; code: string }[] = (banksData as any)?.banks || [];

  useEffect(() => {
    if (!editing && !account) setEditing(true);
  }, [account, editing]);

  const saveMut = useMutation({
    mutationFn: () =>
      account
        ? payoutAccountAPI.update(account.id, { bankCode, bankName, accountNumber, accountName })
        : payoutAccountAPI.create({ bankCode, bankName, accountNumber, accountName }),
    onSuccess: (res: any) => {
      toast({ title: "Payout account saved" });
      invalidate.payoutAccount();
      setEditing(false);
      onSaved?.(res.account);
    },
    onError: (e: any) => toast({ title: "Could not save account", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <div style={{ color: C.muted, fontSize: 13 }}>Loading payout account…</div>;

  if (!editing && account) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Landmark size={16} color={C.green} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
              {account.bank_name} •••• {account.account_number.slice(-4)}
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", display: "flex", alignItems: "center", gap: 4 }}>
              {account.account_name}
              {account.verified_at && <CheckCircle2 size={11} color={C.green} />}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setBankCode(account.bank_code); setBankName(account.bank_name);
            setAccountNumber(account.account_number); setAccountName(account.account_name);
            setEditing(true);
          }}
          style={{
            display: "flex", alignItems: "center", gap: 6, background: "transparent",
            border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px",
            color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
          }}
        >
          <Pencil size={12} /> Edit
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {!compact && account && (
        <div style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Sans',sans-serif" }}>
          Editing your saved payout account.
        </div>
      )}
      <div>
        <label style={labelStyle}>Bank</label>
        <select
          style={{ ...inputStyle, appearance: "auto" }}
          value={bankCode}
          onChange={e => {
            const code = e.target.value;
            setBankCode(code);
            const b = banks.find(b => b.code === code);
            if (b) setBankName(b.name);
          }}
        >
          <option value="">Select bank…</option>
          {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Account number</label>
        <input style={inputStyle} value={accountNumber} maxLength={10}
          onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="0123456789" />
      </div>
      <div>
        <label style={labelStyle}>Account name (auto-verified if left blank)</label>
        <input style={inputStyle} value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Optional — will be resolved automatically" />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !bankCode || accountNumber.length < 10}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: C.green, border: "none", borderRadius: 10, padding: "9px 18px",
            color: "#04060F", fontSize: 13, fontWeight: 700, cursor: "pointer",
            opacity: saveMut.isPending || !bankCode || accountNumber.length < 10 ? 0.5 : 1,
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          {saveMut.isPending ? <><Loader2 size={13} className="animate-spin" /> Verifying…</> : "Save Account"}
        </button>
        {account && (
          <button
            onClick={() => setEditing(false)}
            style={{
              background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10,
              padding: "9px 16px", color: C.muted, fontSize: 13, cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export type { PayoutAccount };
