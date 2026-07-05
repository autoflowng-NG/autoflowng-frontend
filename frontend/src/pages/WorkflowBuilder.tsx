import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useWorkflow, useUpdateWorkflow, useTriggerWorkflow,
  useWorkflowRuns, useWorkflowRun,
} from "../hooks/useWorkflows";
import { useConnections } from "../hooks/useConnections";
import api, { workflowsAPI } from "../lib/api";
import { useExecutionStream } from "../hooks/useExecutionStream";
import { PageTransition } from "../components/PageTransition";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Trash2, Settings2, ChevronDown, ChevronRight,
  Clock, CheckCircle2, XCircle, RefreshCw, Zap, GitBranch, Bot,
  Globe, Filter, Code, Database, Mail, MessageSquare, Send,
  MessageCircle, Search, Radio, X, RotateCcw, Lock, AlertTriangle, PauseCircle, PlayCircle, Plus,
  Copy, Pencil, Eye, StopCircle, ChevronUp,
} from "lucide-react";

interface WorkflowBuilderProps { id: string; }

// ─── Catalog ─────────────────────────────────────────────────────────────────
interface CatalogNode {
  executorType: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; color?: string }>;
  color: string;
  category: "AI" | "Messaging" | "Social" | "Logic" | "Data" | "Utility";
  /** Second-level action-type grouping within a category (e.g. "Send", "Reply", "Post") */
  subGroup?: string;
  description: string;
  requiredPlatform?: string;
}

const NODE_CATALOG: CatalogNode[] = [
  // AI
  { executorType: "ai_generate",   label: "AI Generate",     icon: Bot,           color: "#A78BFA", category: "AI",        description: "Run a prompt through the AI engine" },
  // Messaging — Send subgroup
  { executorType: "gmail_send",    label: "Gmail Send",       icon: Mail,          color: "#38BDF8", category: "Messaging", subGroup: "Send",  description: "Send a new email via Gmail",                                     requiredPlatform: "gmail" },
  { executorType: "slack_post",    label: "Slack Post",       icon: MessageSquare, color: "#38BDF8", category: "Messaging", subGroup: "Send",  description: "Post a message to a Slack channel",                              requiredPlatform: "slack" },
  { executorType: "telegram_send", label: "Telegram Send",    icon: Send,          color: "#38BDF8", category: "Messaging", subGroup: "Send",  description: "Send a Telegram message",                                        requiredPlatform: "telegram" },
  { executorType: "whatsapp_send", label: "WhatsApp Send",    icon: MessageCircle, color: "#38BDF8", category: "Messaging", subGroup: "Send",  description: "Send a WhatsApp message",                                        requiredPlatform: "whatsapp" },
  // Messaging — Reply subgroup
  { executorType: "gmail_reply",         label: "Gmail Reply",        icon: Mail,          color: "#38BDF8", category: "Messaging", subGroup: "Reply", description: "Reply to a Gmail thread",                                  requiredPlatform: "gmail" },
  { executorType: "slack_thread_reply",  label: "Slack Thread Reply", icon: MessageSquare, color: "#38BDF8", category: "Messaging", subGroup: "Reply", description: "Reply in-thread to the triggering Slack message",          requiredPlatform: "slack" },
  { executorType: "telegram_reply",      label: "Telegram Reply",     icon: Send,          color: "#38BDF8", category: "Messaging", subGroup: "Reply", description: "Reply to the chat that triggered this workflow",           requiredPlatform: "telegram" },
  { executorType: "whatsapp_reply",      label: "WhatsApp Reply",     icon: MessageCircle, color: "#38BDF8", category: "Messaging", subGroup: "Reply", description: "Reply to the WhatsApp sender",                            requiredPlatform: "whatsapp" },
  // Social — Post subgroup
  { executorType: "twitter_post",  label: "Twitter Post",   icon: Globe, color: "#38BDF8", category: "Social", subGroup: "Post",          description: "Post a tweet (max 280 chars)",              requiredPlatform: "twitter" },
  { executorType: "linkedin_post", label: "LinkedIn Post",  icon: Globe, color: "#38BDF8", category: "Social", subGroup: "Post",          description: "Publish to your LinkedIn profile",          requiredPlatform: "linkedin" },
  { executorType: "facebook_post", label: "Facebook Post",  icon: Globe, color: "#38BDF8", category: "Social", subGroup: "Post",          description: "Post to your Facebook page",                requiredPlatform: "facebook" },
  // Social — Comment Reply subgroup
  { executorType: "twitter_comment_reply",   label: "Twitter Reply",           icon: Globe, color: "#38BDF8", category: "Social", subGroup: "Comment Reply", description: "Reply to a tweet",                                 requiredPlatform: "twitter" },
  { executorType: "facebook_comment_reply",  label: "Facebook Comment Reply",  icon: Globe, color: "#38BDF8", category: "Social", subGroup: "Comment Reply", description: "Reply to a Facebook page comment",                 requiredPlatform: "facebook" },
  { executorType: "instagram_comment_reply", label: "Instagram Comment Reply", icon: Globe, color: "#38BDF8", category: "Social", subGroup: "Comment Reply", description: "Reply to an Instagram comment",                    requiredPlatform: "instagram" },
  { executorType: "youtube_comment_reply",   label: "YouTube Comment Reply",   icon: Globe, color: "#38BDF8", category: "Social", subGroup: "Comment Reply", description: "Reply to a YouTube comment",                       requiredPlatform: "youtube" },
  // Social — DM Reply subgroup
  { executorType: "twitter_dm_reply",   label: "Twitter DM Reply",           icon: Globe, color: "#38BDF8", category: "Social", subGroup: "DM Reply", description: "Reply to a Twitter/X DM",                     requiredPlatform: "twitter" },
  { executorType: "facebook_dm_reply",  label: "Facebook Messenger Reply",   icon: Globe, color: "#38BDF8", category: "Social", subGroup: "DM Reply", description: "Reply to a Facebook Messenger DM",            requiredPlatform: "facebook" },
  { executorType: "instagram_dm_reply", label: "Instagram DM Reply",         icon: Globe, color: "#38BDF8", category: "Social", subGroup: "DM Reply", description: "Reply to an Instagram DM (24-hour window)",   requiredPlatform: "instagram" },
  // Logic
  { executorType: "condition", label: "Condition", icon: GitBranch, color: "#FBBF24", category: "Logic",   description: "Branch based on a field value" },
  { executorType: "filter",    label: "Filter",    icon: Filter,    color: "#FBBF24", category: "Logic",   description: "Stop execution if condition not met" },
  { executorType: "delay",     label: "Delay",     icon: Clock,     color: "#FBBF24", category: "Logic",   description: "Wait before continuing" },
  { executorType: "router",    label: "Router",    icon: GitBranch, color: "#FBBF24", category: "Logic",   description: "Fan out to multiple branches, running each one at the same time" },
  // Data
  { executorType: "database",     label: "Database",         icon: Database, color: "#00C896", category: "Data",    description: "Read or write database records" },
  { executorType: "webhook",      label: "Webhook",          icon: Globe,    color: "#00C896", category: "Data",    description: "Call an external HTTP endpoint" },
  { executorType: "http_request", label: "HTTP Request",     icon: Globe,    color: "#00C896", category: "Data",    description: "Make a generic HTTP request" },
  // Utility
  { executorType: "code",         label: "Code / Transform", icon: Code,     color: "#A78BFA", category: "Utility", description: "Transform text or run a code operation" },
  { executorType: "set_variable", label: "Set Variable",     icon: Settings2,color: "#A78BFA", category: "Utility", description: "Store a value in workflow context" },
];

const CATEGORY_ORDER: CatalogNode["category"][] = ["AI", "Messaging", "Social", "Logic", "Data", "Utility"];

// Feature 1 + Feature 2: step types that carry a platform dependency
const PLATFORM_SEND_TYPES: Record<string, string> = {
  gmail_send:    "gmail",
  gmail_reply:   "gmail",
  slack_post:    "slack",
  telegram_send: "telegram",
  whatsapp_send: "whatsapp",
  twitter_post:  "twitter",
  linkedin_post: "linkedin",
  facebook_post: "facebook",
};

// ─── Trigger types ────────────────────────────────────────────────────────────
const TRIGGER_TYPES = [
  { value: "manual",                   label: "Manual" },
  { value: "schedule",                 label: "Schedule" },
  { value: "webhook",                  label: "Webhook" },
  { value: "gmail_new_email",          label: "Gmail — New Email" },
  { value: "gmail_new_email_matching", label: "Gmail — New Email (Filtered)" },
  { value: "slack_new_message",        label: "Slack — New Message" },
  { value: "slack_mention",            label: "Slack — Mentioned" },
  { value: "twitter_new_mention",      label: "Twitter/X — New Mention" },
  { value: "twitter_new_dm",           label: "Twitter/X — New DM" },
  { value: "linkedin_new_comment",     label: "LinkedIn — New Comment" },
  { value: "linkedin_new_connection",  label: "LinkedIn — New Connection" },
  { value: "youtube_new_comment",      label: "YouTube — New Comment" },
  { value: "instagram_new_dm",         label: "Instagram — New DM" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Node {
  id: string;
  executorType: string;
  label: string;
  x: number;
  y: number;
  config: Record<string, any>;
  paused?: boolean;   // node-level pause flag (persisted in config.paused)
  disabled?: boolean; // node-level disable flag
}

interface Edge { from: string; to: string; id: string; }

// FIX #7: backend sets status "completed" not "success". Handle both.
type StepStatus = "pending" | "running" | "success" | "completed" | "failed" | "skipped" | "filtered" | "cancelled" | "paused";

// Normalise backend status strings to display status
function normaliseStatus(s: string): StepStatus {
  if (s === "completed") return "success";
  if (s === "filtered" || s === "cancelled") return "skipped";
  if (s === "paused") return "paused";
  return s as StepStatus;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#E8EEFF",
  fontSize: 13,
  fontFamily: "'DM Sans',sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(232,238,255,0.5)",
  fontFamily: "'DM Mono',monospace",
  letterSpacing: "0.06em",
  marginBottom: 6,
  marginTop: 12,
};

// ─── TriggerConfigFields (unchanged) ─────────────────────────────────────────
function TriggerConfigFields({
  triggerType,
  triggerConfig,
  setTriggerConfig,
}: {
  triggerType: string;
  triggerConfig: Record<string, any>;
  setTriggerConfig: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}) {
  const set = (key: string, value: any) =>
    setTriggerConfig(c => ({ ...c, [key]: value }));

  if (triggerType === "gmail_new_email" || triggerType === "gmail_new_email_matching") {
    return (
      <div style={{ marginTop: 4 }}>
        <label style={labelStyle}>FILTER: FROM (optional)</label>
        <input style={inputStyle} value={triggerConfig.filter_from || ""} placeholder="e.g. boss@company.com" onChange={e => set("filter_from", e.target.value)} />
        <label style={labelStyle}>FILTER: LABEL (default: INBOX)</label>
        <input style={inputStyle} value={triggerConfig.filter_label || ""} placeholder="e.g. INBOX" onChange={e => set("filter_label", e.target.value)} />
        {triggerType === "gmail_new_email_matching" && (
          <>
            <label style={labelStyle}>FILTER: SUBJECT CONTAINS</label>
            <input style={inputStyle} value={triggerConfig.filter_subject || ""} placeholder="e.g. Invoice" onChange={e => set("filter_subject", e.target.value)} />
          </>
        )}
        <label style={labelStyle}>POLL INTERVAL (seconds, min 30)</label>
        <input type="number" min={30} style={inputStyle} value={triggerConfig.poll_interval_seconds || 60} onChange={e => set("poll_interval_seconds", Math.max(30, Number(e.target.value)))} />
      </div>
    );
  }

  if (triggerType === "slack_new_message" || triggerType === "slack_mention") {
    return (
      <div style={{ marginTop: 4 }}>
        <label style={labelStyle}>CHANNEL ID (required)</label>
        <input style={{ ...inputStyle, borderColor: !triggerConfig.channel_id ? "rgba(251,113,133,0.4)" : undefined }} value={triggerConfig.channel_id || ""} placeholder="e.g. C0123456789" onChange={e => set("channel_id", e.target.value)} />
        {!triggerConfig.channel_id && <div style={{ fontSize: 11, color: "#FB7185", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>channel_id is required to activate this trigger</div>}
        <label style={labelStyle}>CHANNEL NAME (display only)</label>
        <input style={inputStyle} value={triggerConfig.channel_name || ""} placeholder="e.g. #general" onChange={e => set("channel_name", e.target.value)} />
        <label style={labelStyle}>FILTER: MESSAGE CONTAINS (optional)</label>
        <input style={inputStyle} value={triggerConfig.filter_text || ""} placeholder="e.g. urgent" onChange={e => set("filter_text", e.target.value)} />
        <label style={labelStyle}>POLL INTERVAL (seconds, min 15)</label>
        <input type="number" min={15} style={inputStyle} value={triggerConfig.poll_interval_seconds || 30} onChange={e => set("poll_interval_seconds", Math.max(15, Number(e.target.value)))} />
      </div>
    );
  }

  if (triggerType === "twitter_new_mention" || triggerType === "twitter_new_dm") {
    return (
      <div style={{ marginTop: 4 }}>
        {triggerType === "twitter_new_mention" && (
          <>
            <label style={labelStyle}>FILTER: TWEET CONTAINS (optional)</label>
            <input style={inputStyle} value={triggerConfig.filter_text || ""} placeholder="e.g. help" onChange={e => set("filter_text", e.target.value)} />
          </>
        )}
        <label style={labelStyle}>POLL INTERVAL (seconds, min 60)</label>
        <input type="number" min={60} style={inputStyle} value={triggerConfig.poll_interval_seconds || 120} onChange={e => set("poll_interval_seconds", Math.max(60, Number(e.target.value)))} />
        <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", marginTop: 6, fontFamily: "'DM Mono',monospace" }}>Twitter enforces strict rate limits — intervals under 60s will be clamped.</div>
      </div>
    );
  }

  if (triggerType === "youtube_new_comment") {
    return (
      <div style={{ marginTop: 4 }}>
        <label style={labelStyle}>CHANNEL ID (required — leave blank to auto-detect from your connected account)</label>
        <input style={inputStyle} value={triggerConfig.channel_id || ""} placeholder="e.g. UCxxxxxx" onChange={e => set("channel_id", e.target.value)} />
        <label style={labelStyle}>VIDEO ID (optional — scope to one video)</label>
        <input style={inputStyle} value={triggerConfig.video_id || ""} placeholder="e.g. dQw4w9WgXcQ (leave blank for all videos)" onChange={e => set("video_id", e.target.value)} />
        <label style={labelStyle}>POLL INTERVAL (seconds, min 120)</label>
        <input type="number" min={120} style={inputStyle} value={triggerConfig.poll_interval_seconds || 120} onChange={e => set("poll_interval_seconds", Math.max(120, Number(e.target.value)))} />
        <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", marginTop: 6, fontFamily: "'DM Mono',monospace" }}>YouTube Data API has strict quotas — keep intervals at 120s or more.</div>
      </div>
    );
  }

  if (triggerType === "instagram_new_dm") {
    return (
      <div style={{ marginTop: 4 }}>
        <label style={labelStyle}>POLL INTERVAL (seconds, min 60)</label>
        <input type="number" min={60} style={inputStyle} value={triggerConfig.poll_interval_seconds || 60} onChange={e => set("poll_interval_seconds", Math.max(60, Number(e.target.value)))} />
        <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", marginTop: 6, fontFamily: "'DM Mono',monospace" }}>Requires instagram_manage_messages permission. 24-hour reply window applies for instagram_dm_reply steps.</div>
      </div>
    );
  }

  if (triggerType === "linkedin_new_comment" || triggerType === "linkedin_new_connection") {
    return (
      <div style={{ marginTop: 4 }}>
        {triggerType === "linkedin_new_comment" && (
          <>
            <label style={labelStyle}>POST URN / POST ID (required)</label>
            <input style={{ ...inputStyle, borderColor: !triggerConfig.post_id ? "rgba(251,113,133,0.4)" : undefined }} value={triggerConfig.post_id || ""} placeholder="e.g. urn:li:activity:123456789" onChange={e => set("post_id", e.target.value)} />
            {!triggerConfig.post_id && <div style={{ fontSize: 11, color: "#FB7185", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>post_id is required to activate linkedin_new_comment</div>}
          </>
        )}
        <label style={labelStyle}>POLL INTERVAL (seconds, min 120)</label>
        <input type="number" min={120} style={inputStyle} value={triggerConfig.poll_interval_seconds || 300} onChange={e => set("poll_interval_seconds", Math.max(120, Number(e.target.value)))} />
        <div style={{ fontSize: 11, color: "rgba(232,238,255,0.3)", marginTop: 6, fontFamily: "'DM Mono',monospace" }}>LinkedIn enforces strict rate limits — intervals under 120s will be clamped.</div>
      </div>
    );
  }

  return null;
}

// ─── NodeConfigFields ─────────────────────────────────────────────────────────
function NodeConfigFields({ node, setNodes }: { node: Node; setNodes: React.Dispatch<React.SetStateAction<Node[]>> }) {
  const setNodeConfig = (key: string, value: any) => {
    setNodes(ns => ns.map(n =>
      n.id === node.id ? { ...n, config: { ...n.config, [key]: value } } : n
    ));
  };

  const cfg = node.config || {};
  const taStyle: React.CSSProperties = { ...inputStyle, resize: "vertical", fontFamily: "'DM Mono',monospace", fontSize: 12 };

  switch (node.executorType) {
    case "ai_generate":
      return (
        <div>
          <label style={labelStyle}>SYSTEM PROMPT / INSTRUCTIONS</label>
          <textarea rows={5} style={taStyle} value={cfg.prompt || ""} placeholder={"Describe what the AI should do.\nUse {{trigger.email.body}} to reference trigger data."} onChange={e => setNodeConfig("prompt", e.target.value)} />
          <label style={labelStyle}>MAX TOKENS</label>
          <input type="number" min={100} max={4000} style={inputStyle} value={cfg.max_tokens ?? 500} onChange={e => setNodeConfig("max_tokens", Math.min(4000, Math.max(100, Number(e.target.value))))} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>100 – 4000 tokens</div>
        </div>
      );

    case "gmail_send":
      return (
        <div>
          <label style={labelStyle}>TO (recipient email)</label>
          <input style={inputStyle} value={cfg.to || ""} placeholder="{{trigger.email.from}} or user@example.com" onChange={e => setNodeConfig("to", e.target.value)} />
          <label style={labelStyle}>SUBJECT</label>
          <input style={inputStyle} value={cfg.subject || ""} placeholder="Re: {{trigger.email.subject}}" onChange={e => setNodeConfig("subject", e.target.value)} />
          <label style={labelStyle}>BODY</label>
          <textarea rows={4} style={taStyle} value={cfg.body || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("body", e.target.value)} />
        </div>
      );

    case "gmail_reply":
      return (
        <div>
          <label style={labelStyle}>REPLY BODY</label>
          <textarea rows={4} style={taStyle} value={cfg.body || ""} placeholder="Leave blank to use AI output." onChange={e => setNodeConfig("body", e.target.value)} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", marginTop: 6, fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>Automatically replies to the triggering email thread — no recipient needed.</div>
        </div>
      );

    case "slack_post":
      return (
        <div>
          <label style={labelStyle}>CHANNEL (ID or name)</label>
          <input style={inputStyle} value={cfg.channel || ""} placeholder="e.g. C0123456789 or #general" onChange={e => setNodeConfig("channel", e.target.value)} />
          <label style={labelStyle}>MESSAGE TEXT</label>
          <textarea rows={3} style={taStyle} value={cfg.text || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("text", e.target.value)} />
        </div>
      );

    case "telegram_send":
      return (
        <div>
          <label style={labelStyle}>MESSAGE TEXT</label>
          <textarea rows={3} style={taStyle} value={cfg.text || ""} placeholder="Leave blank to use AI output." onChange={e => setNodeConfig("text", e.target.value)} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", marginTop: 6, fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>Bot token and chat ID are set in your Telegram integration settings.</div>
        </div>
      );

    case "whatsapp_send":
      return (
        <div>
          <label style={labelStyle}>RECIPIENT NUMBER (with country code)</label>
          <input style={inputStyle} value={cfg.to || ""} placeholder="+2348012345678" onChange={e => setNodeConfig("to", e.target.value)} />
          <label style={labelStyle}>MESSAGE TEXT</label>
          <textarea rows={3} style={taStyle} value={cfg.text || ""} placeholder="Leave blank to use AI output." onChange={e => setNodeConfig("text", e.target.value)} />
        </div>
      );

    case "twitter_post": {
      const tweetText = cfg.text || "";
      return (
        <div>
          <label style={labelStyle}>TWEET TEXT (max 280 chars)</label>
          <textarea rows={3} style={taStyle} value={tweetText} maxLength={280} placeholder="Leave blank to use AI output (will be truncated to 280 chars)." onChange={e => setNodeConfig("text", e.target.value)} />
          <div style={{ fontSize: 10, color: tweetText.length > 250 ? "#FBBF24" : "rgba(232,238,255,0.3)", marginTop: 4, fontFamily: "'DM Mono',monospace", textAlign: "right" }}>{tweetText.length} / 280</div>
        </div>
      );
    }

    case "linkedin_post":
      return (
        <div>
          <label style={labelStyle}>POST TEXT</label>
          <textarea rows={4} style={taStyle} value={cfg.text || ""} placeholder="Leave blank to use AI output." onChange={e => setNodeConfig("text", e.target.value)} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", marginTop: 6, fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>LinkedIn enforces rate limits — posts too frequent may be rejected.</div>
        </div>
      );

    case "facebook_post":
      return (
        <div>
          <label style={labelStyle}>POST TEXT</label>
          <textarea rows={4} style={taStyle} value={cfg.text || ""} placeholder="Leave blank to use AI output. Posts to your first connected Facebook page." onChange={e => setNodeConfig("text", e.target.value)} />
        </div>
      );

    case "facebook_comment_reply":
      return (
        <div>
          <label style={labelStyle}>COMMENT ID (leave blank to use trigger context)</label>
          <input style={inputStyle} value={cfg.comment_id || ""} placeholder="{{commentId}} or leave blank" onChange={e => setNodeConfig("comment_id", e.target.value)} />
          <label style={labelStyle}>REPLY MESSAGE</label>
          <textarea rows={3} style={taStyle} value={cfg.message || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("message", e.target.value)} />
        </div>
      );

    case "facebook_dm_reply":
      return (
        <div>
          <label style={labelStyle}>MESSAGE</label>
          <textarea rows={3} style={taStyle} value={cfg.message || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("message", e.target.value)} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", marginTop: 6, fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>Replies to the Messenger DM sender — no recipient ID needed when triggered by facebook.new_message.</div>
        </div>
      );

    case "instagram_comment_reply":
      return (
        <div>
          <label style={labelStyle}>COMMENT ID (leave blank to use trigger context)</label>
          <input style={inputStyle} value={cfg.comment_id || ""} placeholder="{{commentId}} or leave blank" onChange={e => setNodeConfig("comment_id", e.target.value)} />
          <label style={labelStyle}>REPLY MESSAGE</label>
          <textarea rows={3} style={taStyle} value={cfg.message || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("message", e.target.value)} />
        </div>
      );

    case "instagram_dm_reply":
      return (
        <div>
          <label style={labelStyle}>MESSAGE</label>
          <textarea rows={3} style={taStyle} value={cfg.message || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("message", e.target.value)} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", marginTop: 6, fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>Replies to the Instagram DM sender — 24-hour reply window applies. Trigger must fire within 24h of the inbound DM.</div>
        </div>
      );

    case "youtube_comment_reply":
      return (
        <div>
          <label style={labelStyle}>COMMENT ID (leave blank to use trigger context)</label>
          <input style={inputStyle} value={cfg.comment_id || ""} placeholder="{{commentId}} or leave blank" onChange={e => setNodeConfig("comment_id", e.target.value)} />
          <label style={labelStyle}>REPLY MESSAGE</label>
          <textarea rows={3} style={taStyle} value={cfg.message || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("message", e.target.value)} />
        </div>
      );

    case "slack_thread_reply":
      return (
        <div>
          <label style={labelStyle}>MESSAGE</label>
          <textarea rows={3} style={taStyle} value={cfg.message || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("message", e.target.value)} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", marginTop: 6, fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>Replies in-thread to the Slack message that triggered this workflow (uses slack_ts from context).</div>
        </div>
      );

    case "telegram_reply":
      return (
        <div>
          <label style={labelStyle}>MESSAGE</label>
          <textarea rows={3} style={taStyle} value={cfg.message || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("message", e.target.value)} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", marginTop: 6, fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>Replies to the chat that triggered this workflow (uses chatId from context).</div>
        </div>
      );

    case "whatsapp_reply":
      return (
        <div>
          <label style={labelStyle}>MESSAGE</label>
          <textarea rows={3} style={taStyle} value={cfg.message || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("message", e.target.value)} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", marginTop: 6, fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>Replies to the WhatsApp sender (reads phone from context.from, set by whatsapp.incoming_message trigger).</div>
        </div>
      );

    case "twitter_comment_reply":
      return (
        <div>
          <label style={labelStyle}>TWEET ID TO REPLY TO</label>
          <input style={inputStyle} value={cfg.tweet_id || ""} placeholder="{{tweet_id}} or hardcoded tweet ID" onChange={e => setNodeConfig("tweet_id", e.target.value)} />
          <label style={labelStyle}>REPLY TEXT (max 280 chars)</label>
          <textarea rows={3} style={taStyle} value={cfg.message || ""} maxLength={280} placeholder="Leave blank to use AI output." onChange={e => setNodeConfig("message", e.target.value)} />
        </div>
      );

    case "twitter_dm_reply":
      return (
        <div>
          <label style={labelStyle}>MESSAGE</label>
          <textarea rows={3} style={taStyle} value={cfg.message || ""} placeholder="Leave blank to use AI output ({{ai_output}})" onChange={e => setNodeConfig("message", e.target.value)} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", marginTop: 6, fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>Replies to the Twitter/X DM sender (reads dm_sender_id from context, set by twitter_new_dm trigger).</div>
        </div>
      );

    case "condition":
      return (
        <div>
          <label style={labelStyle}>FIELD TO CHECK</label>
          <input style={inputStyle} value={cfg.field || ""} placeholder="e.g. trigger.email.subject" onChange={e => setNodeConfig("field", e.target.value)} />
          <label style={labelStyle}>OPERATOR</label>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={cfg.operator || "contains"} onChange={e => setNodeConfig("operator", e.target.value)}>
            {["contains", "not_contains", "equals", "not_equals", "greater_than", "less_than", "exists", "not_exists"].map(op => (
              <option key={op} value={op} style={{ background: "#04060F" }}>{op.replace(/_/g, " ")}</option>
            ))}
          </select>
          <label style={labelStyle}>VALUE</label>
          <input style={inputStyle} value={cfg.value || ""} placeholder="e.g. Invoice" onChange={e => setNodeConfig("value", e.target.value)} />
        </div>
      );

    case "filter":
      return (
        <div>
          <label style={labelStyle}>CONDITION FIELD</label>
          <input style={inputStyle} value={cfg.field || ""} placeholder="e.g. trigger.email.from" onChange={e => setNodeConfig("field", e.target.value)} />
          <label style={labelStyle}>OPERATOR</label>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={cfg.operator || "contains"} onChange={e => setNodeConfig("operator", e.target.value)}>
            {["contains", "equals", "not_equals", "exists"].map(op => (
              <option key={op} value={op} style={{ background: "#04060F" }}>{op.replace(/_/g, " ")}</option>
            ))}
          </select>
          <label style={labelStyle}>VALUE</label>
          <input style={inputStyle} value={cfg.value || ""} onChange={e => setNodeConfig("value", e.target.value)} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", marginTop: 6, fontFamily: "'DM Mono',monospace", fontStyle: "italic" }}>Stops the workflow if the condition is NOT met.</div>
        </div>
      );

    case "delay":
      return (
        <div>
          <label style={labelStyle}>DELAY DURATION (seconds)</label>
          <input type="number" min={1} style={inputStyle} value={cfg.seconds ?? 60} onChange={e => setNodeConfig("seconds", Math.max(1, Number(e.target.value)))} />
          <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>1 = 1 second · 60 = 1 minute · 3600 = 1 hour</div>
        </div>
      );

    case "database":
      return (
        <div>
          <label style={labelStyle}>OPERATION</label>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={cfg.operation || "query"} onChange={e => setNodeConfig("operation", e.target.value)}>
            {["query", "insert", "update", "delete"].map(op => (
              <option key={op} value={op} style={{ background: "#04060F" }}>{op}</option>
            ))}
          </select>
          <label style={labelStyle}>TABLE</label>
          <input style={inputStyle} value={cfg.table || ""} placeholder="e.g. leads" onChange={e => setNodeConfig("table", e.target.value)} />
          <label style={labelStyle}>FILTER / DATA (JSON)</label>
          <textarea rows={3} style={taStyle} value={cfg.filter || ""} placeholder={'{"email": "{{trigger.email.from}}"}'} onChange={e => setNodeConfig("filter", e.target.value)} />
        </div>
      );

    case "webhook":
    case "http_request":
      return (
        <div>
          <label style={labelStyle}>URL</label>
          <input style={inputStyle} value={cfg.url || ""} placeholder="https://api.example.com/endpoint" onChange={e => setNodeConfig("url", e.target.value)} />
          <label style={labelStyle}>METHOD</label>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={cfg.method || "POST"} onChange={e => setNodeConfig("method", e.target.value)}>
            {["POST", "GET", "PUT", "PATCH", "DELETE"].map(m => (
              <option key={m} value={m} style={{ background: "#04060F" }}>{m}</option>
            ))}
          </select>
          <label style={labelStyle}>HEADERS (JSON, optional)</label>
          <textarea rows={2} style={taStyle} value={cfg.headers || ""} placeholder={'{"Authorization": "Bearer {{token}}"}'} onChange={e => setNodeConfig("headers", e.target.value)} />
          <label style={labelStyle}>BODY (JSON or text, optional)</label>
          <textarea rows={3} style={taStyle} value={cfg.body || ""} onChange={e => setNodeConfig("body", e.target.value)} />
        </div>
      );

    case "code": {
      const op = cfg.operation || "uppercase";
      return (
        <div>
          <label style={labelStyle}>OPERATION</label>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={op} onChange={e => setNodeConfig("operation", e.target.value)}>
            {["uppercase", "lowercase", "trim", "word_count", "char_count", "truncate", "replace", "template", "extract_emails", "extract_urls", "extract_numbers", "json_parse", "json_extract"].map(o => (
              <option key={o} value={o} style={{ background: "#04060F" }}>{o.replace(/_/g, " ")}</option>
            ))}
          </select>
          <label style={labelStyle}>INPUT FIELD (optional)</label>
          <input style={inputStyle} value={cfg.input || ""} placeholder="Leave blank to use {{last_output}}" onChange={e => setNodeConfig("input", e.target.value)} />
          {op === "truncate" && (
            <>
              <label style={labelStyle}>LENGTH</label>
              <input type="number" min={1} style={inputStyle} value={cfg.length ?? 200} onChange={e => setNodeConfig("length", Number(e.target.value))} />
            </>
          )}
          {op === "replace" && (
            <>
              <label style={labelStyle}>FIND</label>
              <input style={inputStyle} value={cfg.find || ""} onChange={e => setNodeConfig("find", e.target.value)} />
              <label style={labelStyle}>REPLACE WITH</label>
              <input style={inputStyle} value={cfg.replace_with || ""} onChange={e => setNodeConfig("replace_with", e.target.value)} />
            </>
          )}
          {op === "template" && (
            <>
              <label style={labelStyle}>TEMPLATE</label>
              <textarea rows={3} style={taStyle} value={cfg.template || ""} placeholder="Hello {{trigger.email.from}}" onChange={e => setNodeConfig("template", e.target.value)} />
            </>
          )}
          {op === "json_extract" && (
            <>
              <label style={labelStyle}>PATH</label>
              <input style={inputStyle} value={cfg.path || ""} placeholder="e.g. data.user.email" onChange={e => setNodeConfig("path", e.target.value)} />
            </>
          )}
        </div>
      );
    }

    case "router":
      return (
        <div>
          <div style={{ fontSize: 11, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", lineHeight: 1.7, marginTop: 8 }}>
            <div style={{ color: "#FBBF24", fontWeight: 700, marginBottom: 6 }}>MULTI-BRANCH ROUTER</div>
            Connect this node to <strong style={{ color: "#E8EEFF" }}>multiple nodes</strong> using the right connector dot.
            Each connected node runs as its own parallel branch, all firing at once.
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", lineHeight: 1.6 }}>
              Example: Router → Gmail Reply<br />
              Router → Slack Post<br />
              Router → Twitter Post<br />
              <span style={{ color: "#FBBF24" }}>All 3 run at the same time.</span>
            </div>
          </div>
          <label style={labelStyle}>ROUTER LABEL (optional)</label>
          <input style={inputStyle} value={cfg.label || ""} placeholder="e.g. Notify all channels" onChange={e => setNodeConfig("label", e.target.value)} />
        </div>
      );

    case "set_variable":
      return (
        <div>
          <label style={labelStyle}>VARIABLE NAME</label>
          <input style={inputStyle} value={cfg.key || ""} placeholder="e.g. customer_email" onChange={e => setNodeConfig("key", e.target.value)} />
          <label style={labelStyle}>VALUE</label>
          <input style={inputStyle} value={cfg.value || ""} placeholder="{{trigger.email.from}} or a static value" onChange={e => setNodeConfig("value", e.target.value)} />
        </div>
      );

    default: {
      const rawJson = JSON.stringify(cfg, null, 2);
      return (
        <div>
          <label style={labelStyle}>RAW CONFIG (JSON)</label>
          <textarea
            rows={8}
            style={taStyle}
            defaultValue={rawJson}
            onBlur={e => {
              try {
                const parsed = JSON.parse(e.target.value);
                setNodes(ns => ns.map(n => n.id === node.id ? { ...n, config: parsed } : n));
              } catch {
                // invalid JSON — ignore
              }
            }}
          />
        </div>
      );
    }
  }
}

// ─── ContextVariables accordion ───────────────────────────────────────────────
function ContextVariables() {
  const [open, setOpen] = useState(false);
  const vars = [
    { v: "{{trigger.email.from}}",    d: "sender email" },
    { v: "{{trigger.email.subject}}", d: "email subject" },
    { v: "{{trigger.email.body}}",    d: "email body text" },
    { v: "{{trigger.slack.text}}",    d: "Slack message text" },
    { v: "{{trigger.slack.channel}}", d: "Slack channel ID" },
    { v: "{{ai_output}}",             d: "last AI Generate output" },
    { v: "{{last_output}}",           d: "previous step output" },
  ];
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(232,238,255,0.45)", cursor: "pointer", fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: 700, letterSpacing: "0.06em", padding: 0, width: "100%" }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        AVAILABLE VARIABLES
      </button>
      {open && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {vars.map(({ v, d }) => (
            <div key={v} style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: "#00C896", flexShrink: 0, userSelect: "all" }}>{v}</span>
              <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: "rgba(232,238,255,0.3)", textAlign: "right" }}>{d}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Trace helpers ────────────────────────────────────────────────────────────
// FIX #7: map all backend status variants to display colors
const TRACE_COLORS: Record<string, string> = {
  pending:   "rgba(232,238,255,0.2)",
  running:   "#38BDF8",
  success:   "#00C896",
  completed: "#00C896",
  failed:    "#FB7185",
  skipped:   "#FBBF24",
  filtered:  "#FBBF24",
  cancelled: "#FBBF24",
  paused:    "#FBBF24",
};

function TraceStatusIcon({ status }: { status: string }) {
  const n = normaliseStatus(status);
  if (n === "success")  return <CheckCircle2 size={11} color="#00C896" />;
  if (n === "failed")   return <XCircle size={11} color="#FB7185" />;
  if (n === "skipped")  return <XCircle size={11} color="#FBBF24" />;
  if (n === "paused")   return <PauseCircle size={11} color="#FBBF24" />;
  if (n === "running")  return <RefreshCw size={11} color="#38BDF8" style={{ animation: "spin-slow 1s linear infinite" }} />;
  return <Clock size={11} color="rgba(232,238,255,0.25)" />;
}

// ─── NodeBox ──────────────────────────────────────────────────────────────────
function NodeBox({
  node, selected, connecting, traceStatus, onSelect, onDelete, onConnectorClick,
  onPauseToggle, onFanout, onContextMenu,
}: {
  node: Node;
  selected: boolean;
  connecting: boolean;
  traceStatus: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onConnectorClick: (id: string, e: React.MouseEvent) => void;
  onPauseToggle?: () => void;
  onFanout?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const entry = NODE_CATALOG.find(n => n.executorType === node.executorType) || NODE_CATALOG[0];
  const Icon = entry.icon;
  const traceColor = traceStatus ? (TRACE_COLORS[traceStatus] || TRACE_COLORS.pending) : null;
  const isPaused = !!node.config?.paused;
  const isDisabled = !!node.config?.disabled;

  const borderColor = isPaused
    ? "rgba(251,191,36,0.55)"
    : isDisabled
    ? "rgba(255,255,255,0.05)"
    : traceColor ?? (selected ? entry.color : "rgba(255,255,255,0.09)");

  const boxShadow = traceStatus === "running"
    ? "0 0 0 3px rgba(56,189,248,0.25), 0 0 20px rgba(56,189,248,0.15)"
    : (traceStatus === "success" || traceStatus === "completed")
    ? "0 0 0 2px rgba(0,200,150,0.2), 0 0 12px rgba(0,200,150,0.12)"
    : traceStatus === "failed"
    ? "0 0 0 2px rgba(251,113,133,0.25), 0 0 12px rgba(251,113,133,0.12)"
    : isPaused
    ? "0 0 0 2px rgba(251,191,36,0.2), 0 0 10px rgba(251,191,36,0.1)"
    : selected
    ? `0 0 20px ${entry.color}30`
    : undefined;

  // Long-press for mobile context menu
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      if (onContextMenu) {
        const touch = e.touches[0];
        onContextMenu({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {}, stopPropagation: () => {} } as any);
      }
    }, 500);
  };
  const onTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div
      data-testid={`node-${node.id}`}
      onClick={() => onSelect(node.id)}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "absolute", left: node.x, top: node.y,
        width: 150, background: isDisabled ? "rgba(8,11,22,0.7)" : "rgba(8,11,22,0.97)",
        border: `1.5px solid ${borderColor}`,
        borderRadius: 12, padding: "10px 12px", cursor: "pointer", userSelect: "none",
        boxShadow: boxShadow ?? "0 2px 16px rgba(0,0,0,0.35)",
        transition: "border-color 0.25s, box-shadow 0.25s",
        zIndex: selected ? 10 : 1,
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {/* Running shimmer */}
      {traceStatus === "running" && (
        <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.06) 50%, transparent 100%)", animation: "trace-shimmer 1.4s ease-in-out infinite", pointerEvents: "none" }} />
      )}

      {/* Paused overlay tint */}
      {isPaused && (
        <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(251,191,36,0.04)", pointerEvents: "none" }} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: `${entry.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={12} color={entry.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: entry.color, fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>{entry.label.toUpperCase()}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#E8EEFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.label}</div>
        </div>
      </div>

      {/* Left connector — input port */}
      <div style={{ position: "absolute", top: "50%", left: -6, width: 12, height: 12, borderRadius: "50%", background: "#04060F", border: `2px solid ${entry.color}70`, transform: "translateY(-50%)", zIndex: 5 }} />

      {/* Right connector — tap-to-connect output port */}
      <div
        onClick={e => { e.stopPropagation(); onConnectorClick(node.id, e); }}
        style={{
          position: "absolute", top: "50%", right: -6, width: 14, height: 14, borderRadius: "50%",
          background: connecting ? "#00C896" : isPaused ? "rgba(251,191,36,0.7)" : entry.color,
          border: `2px solid ${connecting ? "#00C896" : "rgba(8,11,22,0.8)"}`,
          transform: "translateY(-50%)",
          cursor: "pointer",
          boxShadow: connecting ? "0 0 10px #00C896, 0 0 0 3px rgba(0,200,150,0.2)" : isPaused ? "0 0 6px rgba(251,191,36,0.5)" : `0 0 6px ${entry.color}60`,
          animation: connecting ? "pulse-dot 1s ease-in-out infinite" : undefined,
          zIndex: 30,
          transition: "background 0.15s, box-shadow 0.15s",
        }}
      />

      {/* Fan-out "+" — available on ALL nodes, positioned bottom-right with clear separation from output dot */}
      {onFanout && !connecting && (
        /* 44×44 transparent tap target, centered on the same visual position as
           the previous 22×22 circle. The inner div carries all the visual styles
           so the large transparent hit area is invisible to the user. */
        <button
          onClick={e => { e.stopPropagation(); onFanout(); }}
          title="Add fan-out branch (Router → new node)"
          aria-label="Add fan-out branch"
          style={{
            position: "absolute",
            bottom: -25, right: -7,   // keeps visual center identical to bottom:-14 right:4 at 22px
            width: 44, height: 44,     // full 44×44 accessible tap target
            borderRadius: "50%",
            background: "transparent", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 31, padding: 0,
          }}
          onMouseEnter={e => {
            const v = (e.currentTarget as HTMLButtonElement).querySelector('.fanout-visual') as HTMLElement | null;
            if (v) { v.style.background = "rgba(0,200,150,0.28)"; v.style.borderColor = "rgba(0,200,150,0.8)"; }
          }}
          onMouseLeave={e => {
            const v = (e.currentTarget as HTMLButtonElement).querySelector('.fanout-visual') as HTMLElement | null;
            if (v) { v.style.background = "rgba(0,200,150,0.12)"; v.style.borderColor = "rgba(0,200,150,0.45)"; }
          }}
        >
          <div
            className="fanout-visual"
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "rgba(0,200,150,0.12)",
              border: "1.5px solid rgba(0,200,150,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
              pointerEvents: "none",
            }}
          >
            <Plus size={11} color="#00C896" />
          </div>
        </button>
      )}

      {/* Node-level pause/resume pill — visible on ALL nodes */}
      {onPauseToggle && (
        <button
          onClick={e => { e.stopPropagation(); onPauseToggle(); }}
          title={isPaused ? "Resume this node" : "Pause this node"}
          style={{
            position: "absolute", bottom: -8, left: 8,
            background: isPaused ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.04)",
            border: isPaused ? "1.5px solid rgba(251,191,36,0.5)" : "1.5px solid rgba(255,255,255,0.09)",
            borderRadius: 10, padding: "2px 6px",
            display: "flex", alignItems: "center", gap: 3,
            cursor: "pointer", zIndex: 31,
            transition: "background 0.15s, border-color 0.15s",
          }}
        >
          {isPaused
            ? <><PauseCircle size={8} color="#FBBF24" /><span style={{ fontSize: 7, color: "#FBBF24", fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>PAUSED</span></>
            : <><PlayCircle size={8} color="rgba(232,238,255,0.3)" /><span style={{ fontSize: 7, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace" }}>ACTIVE</span></>}
        </button>
      )}

      {/* Trace badge */}
      {traceStatus && (
        <div style={{ position: "absolute", top: -8, right: -8, width: 20, height: 20, borderRadius: "50%", background: "#04060F", border: `1.5px solid ${traceColor ?? "#FBBF24"}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}>
          <TraceStatusIcon status={traceStatus} />
        </div>
      )}

      {/* Delete badge */}
      {selected && !traceStatus && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(node.id); }}
          style={{ position: "absolute", top: -10, right: -10, width: 24, height: 24, borderRadius: "50%", background: "#FB7185", border: "2px solid #04060F", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 20 }}
        >
          <Trash2 size={11} color="white" />
        </button>
      )}
    </div>
  );
}

// ─── TraceStatusBar ───────────────────────────────────────────────────────────
function TraceStatusBar({
  run, stepStatuses, nodeCount, onDismiss,
}: {
  run: any;
  // FIX #2: stepStatuses is now an array indexed by step position
  stepStatuses: string[];
  nodeCount: number;
  onDismiss: () => void;
}) {
  // FIX #7: treat "completed" as success
  const successCount = stepStatuses.filter(s => s === "success" || s === "completed").length;
  const failedCount  = stepStatuses.filter(s => s === "failed").length;
  const runningCount = stepStatuses.filter(s => s === "running").length;

  const rawStatus   = run?.status || "running";
  const isLive      = rawStatus === "running";
  const isFailed    = rawStatus === "failed";
  // FIX #7: backend sets "completed" not "success"
  const isSuccess   = rawStatus === "success" || rawStatus === "completed";

  const statusColor = isFailed ? "#FB7185" : isSuccess ? "#00C896" : "#38BDF8";
  const statusLabel = isFailed ? "FAILED" : isSuccess ? "COMPLETED" : "RUNNING";

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(4,6,15,0.96)", borderTop: `1px solid ${statusColor}30`,
      padding: "10px 16px", display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, animation: isLive ? "pulse-dot 1s ease-in-out infinite" : undefined }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: statusColor, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em" }}>{statusLabel}</span>
      </div>

      <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.08)" }} />

      <div style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
        {runningCount > 0 && <span style={{ color: "#38BDF8" }}>{runningCount} running</span>}
        <span style={{ color: "#00C896" }}>{successCount} done</span>
        {failedCount > 0 && <span style={{ color: "#FB7185" }}>{failedCount} failed</span>}
        <span style={{ color: "rgba(232,238,255,0.3)" }}>/ {nodeCount} steps</span>
      </div>

      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", minWidth: 40 }}>
        <div style={{ height: "100%", width: `${nodeCount > 0 ? (successCount / nodeCount) * 100 : 0}%`, background: isFailed ? "#FB7185" : "#00C896", borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>

      {run?.duration_ms && (
        <span style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{run.duration_ms}ms</span>
      )}

      <button onClick={onDismiss} style={{ background: "none", border: "none", color: "rgba(232,238,255,0.3)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── RunsPanel ────────────────────────────────────────────────────────────────
function RunsPanel({ workflowId, onReplay }: { workflowId: string; onReplay?: (runId: string) => void }) {
  const { data: runs = [], isLoading } = useWorkflowRuns(workflowId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // FIX #7: handle "completed" as success colour
  const statusColor = (s: string) => {
    if (s === "success" || s === "completed") return "#00C896";
    if (s === "failed") return "#FB7185";
    if (s === "running") return "#38BDF8";
    return "#FBBF24";
  };
  const statusIcon = (s: string) => {
    if (s === "success" || s === "completed") return <CheckCircle2 size={13} color="#00C896" />;
    if (s === "failed")  return <XCircle size={13} color="#FB7185" />;
    if (s === "running") return <RefreshCw size={13} color="#38BDF8" style={{ animation: "spin-slow 1s linear infinite" }} />;
    return <Clock size={13} color="#FBBF24" />;
  };

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 12 }}>EXECUTION HISTORY</div>
      {isLoading ? <div className="af-shimmer" style={{ height: 120, borderRadius: 8 }} /> :
       runs.length === 0 ? <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(232,238,255,0.2)", fontSize: 12 }}>No runs yet</div> :
       <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
         {(runs as any[]).slice(0, 20).map((r: any) => {
           const isOpen = expandedId === r.id;
           const sc = statusColor(r.status);
           // FIX #5: logs is the actual field, shape: [{step, type, name, logs:[]}]
           const steps: any[] = r.logs || [];
           return (
             <div key={r.id} style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${isOpen ? sc + "40" : "rgba(255,255,255,0.05)"}`, transition: "border-color 0.2s" }}>
               <button
                 onClick={() => setExpandedId(isOpen ? null : r.id)}
                 style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: isOpen ? `${sc}0A` : "rgba(255,255,255,0.02)", border: "none", cursor: "pointer", textAlign: "left" }}
               >
                 {statusIcon(r.status)}
                 <div style={{ flex: 1, minWidth: 0 }}>
                   <div style={{ fontSize: 11, color: "#E8EEFF", fontFamily: "'DM Mono',monospace" }}>Run #{r.id?.slice?.(-6) || r.id}</div>
                   {r.duration_ms != null && <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)" }}>{r.duration_ms}ms</div>}
                 </div>
                 <div style={{ fontSize: 10, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>
                   {r.started_at ? new Date(r.started_at).toLocaleTimeString() : ""}
                 </div>
                 <ChevronDown size={12} color="rgba(232,238,255,0.3)" style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
               </button>

               {isOpen && (
                 <div style={{ padding: "0 12px 12px 12px", background: `${sc}06` }}>
                   {/* FIX #5: render steps from logs array with correct fields */}
                   {steps.length > 0 && (
                     <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                       <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 2 }}>STEPS</div>
                       {steps.map((s: any, i: number) => {
                         // logs entries: { step (index), type, name, logs: [{level,msg,ts}], attempt }
                         const stepLogs: any[] = s.logs || [];
                         const lastLog = stepLogs[stepLogs.length - 1];
                         const hasError = stepLogs.some((l: any) => l.level === "error");
                         const stepSc = hasError ? "#FB7185" : "#00C896";
                         // Bug fix: for a router step, executor.js logs each branch's
                         // actual result (e.g. "[branch-0] Replied to jane@x.com" or
                         // "[branch-0] Gmail not connected") BEFORE its own final
                         // "Router: N/M branches completed" summary line. Previously
                         // this only rendered `lastLog` — the summary — so the real
                         // per-branch outcome (including Gmail send/reply failures
                         // happening inside a fan-out branch) was computed correctly
                         // by the executor but never visible anywhere in this UI.
                         const branchLogs = s.type === "router"
                           ? stepLogs.filter((l: any) => /^\[branch-\d+\]/.test(l.msg || ""))
                           : [];
                         return (
                           <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 8px", background: "rgba(0,0,0,0.15)", borderRadius: 6 }}>
                             <div style={{ width: 6, height: 6, borderRadius: "50%", background: stepSc, flexShrink: 0, marginTop: 4 }} />
                             <div style={{ flex: 1, minWidth: 0 }}>
                               <div style={{ fontSize: 10, color: "#E8EEFF", fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                 {s.name || s.type || `step-${(s.step ?? i) + 1}`}
                               </div>
                               {branchLogs.length > 0 ? (
                                 branchLogs.map((bl: any, bi: number) => (
                                   <div key={bi} style={{
                                     fontSize: 9, fontFamily: "'DM Mono',monospace", marginTop: 2,
                                     color: bl.level === "error" ? "#FB7185" : "rgba(232,238,255,0.4)",
                                     overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                   }}>
                                     {bl.msg}
                                   </div>
                                 ))
                               ) : lastLog?.msg && (
                                 <div style={{ fontSize: 9, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                   {lastLog.msg}
                                 </div>
                               )}
                             </div>
                             <div style={{ fontSize: 9, color: stepSc, fontFamily: "'DM Mono',monospace", fontWeight: 700, flexShrink: 0 }}>
                               {hasError ? "FAILED" : "OK"}
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   )}

                   {onReplay && (
                     <button
                       onClick={() => onReplay(r.id)}
                       style={{
                         width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                         background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)",
                         borderRadius: 8, padding: "9px 0",
                         color: "#38BDF8", fontSize: 12, fontWeight: 700,
                         cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                       }}
                     >
                       <RefreshCw size={12} /> Replay on canvas
                     </button>
                   )}
                 </div>
               )}
             </div>
           );
         })}
       </div>
      }
    </div>
  );
}

// ─── WarningBanner ────────────────────────────────────────────────────────────
function WarningBanner({ missingPlatforms, onDismiss }: { missingPlatforms: string[]; onDismiss: () => void }) {
  if (missingPlatforms.length === 0) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)",
      borderRadius: 10, padding: "10px 14px", margin: "8px 12px 0",
      flexWrap: "wrap",
    }}>
      <AlertTriangle size={14} color="#FBBF24" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, color: "rgba(232,238,255,0.75)", fontFamily: "'DM Sans',sans-serif" }}>
        This workflow uses{" "}
        <strong style={{ color: "#FBBF24" }}>{missingPlatforms.join(", ")}</strong>
        {" "}— connect {missingPlatforms.length === 1 ? "it" : "them"} before activating.{" "}
        <a href="/connections" style={{ color: "#38BDF8", textDecoration: "underline" }}>Connect now →</a>
      </span>
      <button onClick={onDismiss} style={{ background: "none", border: "none", color: "rgba(232,238,255,0.3)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function WorkflowBuilder({ id }: WorkflowBuilderProps) {
  const nav = useNavigate();
  const { data, isLoading } = useWorkflow(id);
  const updateWF   = useUpdateWorkflow(id);
  const triggerWF  = useTriggerWorkflow();
  const { toast }  = useToast();
  const { data: connections = [] } = useConnections();

  const [nodes, setNodes]       = useState<Node[]>([]);
  const [edges, setEdges]       = useState<Edge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName]         = useState("Workflow");
  const [tab, setTab]           = useState<"canvas" | "runs" | "config">("canvas");
  const [saving, setSaving]     = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOff, setDragOff]   = useState({ x: 0, y: 0 });
  const [search, setSearch]     = useState("");
  const [connecting, setConnecting]               = useState<{ fromId: string } | null>(null);
  // (autoConnectPrompt removed — connecting nodes now happens instantly on add, no dialog needed)
  const [retrying, setRetrying] = useState(false);
  const [warnDismissed, setWarnDismissed] = useState(false);

  // Context menu for right-click / long-press on nodes
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);

  // Fan-out picker state
  const [fanoutPickerOpen, setFanoutPickerOpen] = useState(false);
  const [fanoutSourceNodeId, setFanoutSourceNodeId] = useState<string | null>(null);

  // make.com-style generic "+" on a connector — inserts a new node into the
  // middle of an existing edge, splitting it into two. Reuses the same node
  // catalog as the sidebar's addNode flow rather than a second catalog.
  const [edgeInsertPickerOpen, setEdgeInsertPickerOpen] = useState(false);
  const [edgeInsertTargetId, setEdgeInsertTargetId] = useState<string | null>(null);

  // FIX #1 & #3: use the existing useWorkflowRun hook instead of raw useQuery
  // traceRunId is set after trigger by polling /runs for the newest run
  const [traceRunId, setTraceRunId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nextId    = useRef(1);

  // ── Camera (pan + zoom) ──────────────────────────────────────────────────
  // make.com-style infinite canvas: nodes live in a fixed "world" coordinate
  // space (node.x / node.y never change due to panning or zooming). The
  // camera just transforms how that world is projected onto the screen via
  // a single CSS transform on the world layer. This is what was missing
  // before — node positions were being read/written directly in *screen*
  // pixels, which is what produced the disconnected floating line bug.
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  // Convert a screen-space (clientX/clientY) point to world-space coordinates,
  // accounting for the canvas element's own offset on the page plus the
  // current camera pan/zoom. Every place that used to do `e.clientX - dragOff.x`
  // now goes through this so node.x/node.y stay in one consistent space.
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const offX = rect?.left ?? 0;
    const offY = rect?.top ?? 0;
    return {
      x: (clientX - offX - camera.x) / camera.zoom,
      y: (clientY - offY - camera.y) / camera.zoom,
    };
  }, [camera]);

  const clampZoom = (z: number) => Math.min(1.6, Math.max(0.3, z));

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    setCamera(cam => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const offX = rect?.left ?? 0;
      const offY = rect?.top ?? 0;
      const px = clientX - offX;
      const py = clientY - offY;
      const newZoom = clampZoom(cam.zoom * factor);
      // Keep the point under the cursor/finger stationary while zooming
      const worldX = (px - cam.x) / cam.zoom;
      const worldY = (py - cam.y) / cam.zoom;
      return {
        zoom: newZoom,
        x: px - worldX * newZoom,
        y: py - worldY * newZoom,
      };
    });
  }, []);

  const zoomIn  = () => zoomAt((canvasRef.current?.clientWidth ?? 0) / 2, (canvasRef.current?.clientHeight ?? 0) / 2, 1.2);
  const zoomOut = () => zoomAt((canvasRef.current?.clientWidth ?? 0) / 2, (canvasRef.current?.clientHeight ?? 0) / 2, 1 / 1.2);
  const zoomReset = () => setCamera({ x: 0, y: 0, zoom: 1 });

  // Wheel = pan (trackpad/mouse drag scroll); Ctrl/Cmd+wheel or pinch = zoom
  const onCanvasWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01);
      zoomAt(e.clientX, e.clientY, factor);
    } else {
      setCamera(cam => ({ ...cam, x: cam.x - e.deltaX, y: cam.y - e.deltaY }));
    }
  }, [zoomAt]);

  // Touch pinch-to-zoom + two-finger / drag pan for mobile
  const touchDist = (t: TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  };

  const onCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = { dist: touchDist(e.touches), zoom: camera.zoom };
      panStart.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        camX: camera.x, camY: camera.y,
      };
    } else if (e.touches.length === 1 && !dragging && !connecting) {
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, camX: camera.x, camY: camera.y };
    }
  };

  const onCanvasTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault();
      const newDist = touchDist(e.touches);
      const factor = newDist / pinchStart.current.dist;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const targetZoom = clampZoom(pinchStart.current.zoom * factor);
      zoomAt(midX, midY, targetZoom / camera.zoom);
    } else if (e.touches.length === 1 && isPanning) {
      const dx = e.touches[0].clientX - panStart.current.x;
      const dy = e.touches[0].clientY - panStart.current.y;
      setCamera(cam => ({ ...cam, x: panStart.current.camX + dx, y: panStart.current.camY + dy }));
    }
  };

  const onCanvasTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsPanning(false);
      pinchStart.current = null;
    }
  };

  // Mouse-drag panning on empty canvas (middle-click or click-drag on background)
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (dragging || connecting) return;
    // Only start a background pan if the click started on the canvas itself,
    // not on a node (nodes call stopPropagation in their own onMouseDown).
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y };
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setCamera(cam => ({ ...cam, x: panStart.current.camX + dx, y: panStart.current.camY + dy }));
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isPanning]);

  const [triggerType, setTriggerType]     = useState("manual");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});

  // PRIMARY: WebSocket execution stream — gives real-time node status via WS events
  const { execution } = useExecutionStream(id);
  const wsIsActive = execution.phase === "running" || execution.phase === "starting";
  const wsIsDone   = execution.phase === "completed" || execution.phase === "failed";

  // FALLBACK: HTTP poll via useWorkflowRun when WS has no data yet
  const { data: traceRun } = useWorkflowRun(id, traceRunId ?? "");

  // Build stepStatuses: prefer WebSocket node states, fall back to log-based polling
  const stepStatuses = useMemo<string[]>(() => {
    if (!nodes.length) return [];

    // WebSocket path — execution.nodes is keyed by node id
    if ((wsIsActive || wsIsDone) && execution.nodes.length > 0) {
      return nodes.map(n => {
        const ns = execution.nodes.find((s: any) => s.id === n.id || s.name === n.label);
        if (ns) return ns.status; // "pending"|"running"|"success"|"failed"|"skipped"
        return wsIsActive ? "pending" : "pending";
      });
    }

    // HTTP poll fallback — use logs array from run row
    if (!traceRun) return [];
    const logs: any[]          = traceRun.logs || [];
    const stepsCompleted: number = traceRun.steps_completed ?? 0;
    const isStillRunning        = traceRun.status === "running";

    return nodes.map((_n, idx) => {
      const logEntry = logs.find((l: any) => l.step === idx);
      if (logEntry) {
        const hasError = (logEntry.logs || []).some((l: any) => l.level === "error");
        return hasError ? "failed" : "success";
      }
      if (idx < stepsCompleted) return "success";
      if (idx === stepsCompleted && isStillRunning) return "running";
      return "pending";
    });
  }, [nodes, execution.nodes, wsIsActive, wsIsDone, traceRun]);

  // ── Hydration ──────────────────────────────────────────────────────────────
  // Defensive coordinate range: anything outside this window is treated as
  // corrupt/leftover positional data (e.g. from a deleted node, or a stale
  // template default) rather than a real, intentionally-placed node. Without
  // this clamp, a single bad x/y on a saved node produces a connector that
  // stretches out into empty canvas space and reads as a "floating" line
  // disconnected from everything else, even though the guard against
  // missing node ids (`if (!fn || !tn) return null`) is satisfied.
  const SANE_COORD_MIN = -2000;
  const SANE_COORD_MAX = 6000;
  useEffect(() => {
    if (!data) return;
    setName((data as any).name || "Workflow");
    setTriggerType((data as any).trigger_type || "manual");
    setTriggerConfig((data as any).trigger_config || {});
    const ns = (data as any).nodes || [];
    const es = (data as any).edges || [];
    const hydrated = ns.map((n: any, i: number) => {
      let x = n.x ?? 60 + i * 160;
      let y = n.y ?? 150;
      if (!Number.isFinite(x) || x < SANE_COORD_MIN || x > SANE_COORD_MAX) {
        console.warn(`[WorkflowBuilder] node ${n.id || i} had an out-of-range x (${n.x}); resetting to a safe default so it can't render a stray floating connector.`);
        x = 60 + i * 160;
      }
      if (!Number.isFinite(y) || y < SANE_COORD_MIN || y > SANE_COORD_MAX) {
        console.warn(`[WorkflowBuilder] node ${n.id || i} had an out-of-range y (${n.y}); resetting to a safe default so it can't render a stray floating connector.`);
        y = 150;
      }
      return {
        id: n.id || `n${i}`,
        executorType: n.type || "ai_generate",
        label: n.label || n.name || "Node",
        x,
        y,
        config: n.config || {},
      };
    });
    setNodes(hydrated);
    const nodeIds = new Set(hydrated.map((n: any) => n.id));
    const hydratedEdges = es
      .map((e: any, i: number) => ({ id: `e${i}`, from: e.from || e.source, to: e.to || e.target }))
      // Orphaned edges — references to node ids that no longer exist in this
      // workflow's saved node list — are dropped here rather than left for
      // the render-time guard to skip silently, so stale data never has a
      // chance to reach the SVG layer in the first place.
      .filter((e: any) => {
        const valid = nodeIds.has(e.from) && nodeIds.has(e.to);
        if (!valid) {
          console.warn(`[WorkflowBuilder] dropped edge ${e.id} — references a node id that doesn't exist (${e.from} -> ${e.to}).`);
        }
        return valid;
      });
    setEdges(hydratedEdges);
    if (ns.length > 0) nextId.current = ns.length + 1;
  }, [data]);

  // ── Node-level pause toggle (per-node, stored in node.config.paused) ────────
  const toggleNodePause = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const wasPaused = !!node.config?.paused;
    // Optimistic local update
    setNodes(ns => ns.map(n =>
      n.id === nodeId
        ? { ...n, config: { ...n.config, paused: !wasPaused, paused_at: wasPaused ? null : new Date().toISOString() } }
        : n
    ));
    // Persist to backend (best-effort — non-blocking; also saved on next full Save)
    try {
      await api.patch(`/workflows/${id}/steps/${nodeId}/${wasPaused ? 'resume' : 'pause'}`);
    } catch {
      // If endpoint not available, state is still reflected locally and saved on next Save press
    }
    toast({
      title: wasPaused ? "Node resumed" : "Node paused",
      description: wasPaused
        ? `${node.label} will execute normally.`
        : `${node.label} will be skipped during execution.`,
    });
  };

  // ── Node-level disable toggle ───────────────────────────────────────────────
  const toggleNodeDisable = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const wasDisabled = !!node.config?.disabled;
    setNodes(ns => ns.map(n =>
      n.id === nodeId
        ? { ...n, config: { ...n.config, disabled: !wasDisabled } }
        : n
    ));
    toast({ title: wasDisabled ? "Node enabled" : "Node disabled", description: wasDisabled ? `${node.label} is now active.` : `${node.label} will be skipped.` });
  };

  // ── Duplicate node ─────────────────────────────────────────────────────────
  const duplicateNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const dup: Node = {
      ...node,
      id: `n${nextId.current++}`,
      x: node.x + 20,
      y: node.y + 80,
      config: { ...node.config, paused: false, disabled: false },
    };
    setNodes(ns => [...ns, dup]);
    toast({ title: "Duplicated", description: `${node.label} copied to canvas.` });
  };

  // ── Rename node ────────────────────────────────────────────────────────────
  const renameNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newLabel = window.prompt("Rename node:", node.label);
    if (newLabel && newLabel.trim()) {
      setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, label: newLabel.trim() } : n));
    }
  };

  // ── Fan-out: insert router + new branch from any node ─────────────────────
  const insertFanoutBranch = (sourceNodeId: string, catalogEntry: CatalogNode) => {
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return;

    // Bug fix: previously this only looked for an existing router by checking
    // "does an edge FROM sourceNodeId point at a router node?" — which only
    // covers tapping "+" on a plain node that already fans into a router.
    // Tapping "+" directly ON the router itself (the natural way to add a
    // second/third branch) was never handled: sourceNodeId IS the router's
    // own id, so that lookup searched for an edge from the router to some
    // OTHER node and could misidentify an unrelated downstream node as "the
    // existing router," producing a corrupted edge graph. Checking
    // sourceNode.executorType === 'router' first covers this directly.
    const existingRouter = sourceNode.executorType === 'router'
      ? sourceNode
      : (() => {
          const existingRouterEdge = edges.find(e => e.from === sourceNodeId);
          return existingRouterEdge
            ? nodes.find(n => n.id === existingRouterEdge.to && n.executorType === 'router') || null
            : null;
        })();

    const newBranchId = `n${nextId.current++}`;
    // Bug fix: Date.now() alone is not guaranteed unique across two edges
    // created within the same millisecond — a duplicate id breaks React's
    // key-based reconciliation and can cause edges to silently fail to
    // render. Suffixing with the new node's id (always unique) fixes this.
    const edgeId = `e${Date.now()}-${newBranchId}`;

    if (existingRouter) {
      const branchCount = edges.filter(e => e.from === existingRouter.id).length;
      const newBranchNode: Node = {
        id: newBranchId,
        executorType: catalogEntry.executorType,
        label: catalogEntry.label,
        x: existingRouter.x + 160,
        y: existingRouter.y + 50 + branchCount * 90,
        config: {},
      };
      setNodes(ns => [...ns, newBranchNode]);
      setEdges(es => [...es, { id: edgeId, from: existingRouter.id, to: newBranchNode.id }]);
      toast({ title: "Branch added", description: `New ${catalogEntry.label} branch wired to router.` });
    } else {
      const routerId = `n${nextId.current++}`;
      const routerNode: Node = {
        id: routerId,
        executorType: 'router',
        label: 'Fan-out Router',
        x: sourceNode.x + 160,
        y: sourceNode.y,
        config: {},
      };
      const newBranchNode: Node = {
        id: newBranchId,
        executorType: catalogEntry.executorType,
        label: catalogEntry.label,
        x: sourceNode.x + 320,
        y: sourceNode.y + 90,
        config: {},
      };
      const downstream = edges.filter(e => e.from === sourceNodeId);
      const downstreamIds = new Set(downstream.map(e => e.to));
      setEdges(es => [
        ...es.filter(e => e.from !== sourceNodeId),
        { id: `e${Date.now()}-${routerId}`, from: sourceNodeId, to: routerId },
        ...downstream.map(e => ({ ...e, from: routerId })),
        { id: edgeId,                       from: routerId,    to: newBranchId },
      ]);
      setNodes(ns => [
        ...ns.map(n => downstreamIds.has(n.id) ? { ...n, y: n.y - 50 } : n),
        routerNode,
        newBranchNode,
      ]);
      toast({ title: "Fan-out created", description: `Router + ${catalogEntry.label} branch inserted.` });
    }

    setFanoutPickerOpen(false);
    setFanoutSourceNodeId(null);
  };

  // ── Add node ───────────────────────────────────────────────────────────────
  const addNode = (entry: CatalogNode) => {
    // Bug fix: previously this read `nodes`/`edges` directly from the render
    // closure to compute the new node's x-position and which node to
    // auto-connect from. setNodes/setEdges are async and batched, so clicking
    // multiple sidebar catalog entries in quick succession (before React
    // commits the first click's state update) meant every click after the
    // first still saw the pre-click nodes/edges — producing an auto-connect
    // edge wired to the wrong (stale) "last node," or occasionally no edge
    // at all. This is the root cause of nodes appearing on canvas with no
    // visible connector lines between them. Using the functional updater
    // form for both setNodes and setEdges guarantees each call always
    // computes against the most recently committed state, even when several
    // addNode() calls are queued back-to-back in the same tick.
    setNodes(ns => {
      const newNode: Node = {
        id: `n${nextId.current++}`,
        executorType: entry.executorType,
        label: entry.label,
        // make.com-style horizontal flow — tight 150px-wide cards sit on a
        // 160px pitch, a clean ~10px gap, matching how make.com packs its
        // modules close together with just enough room for the connector line.
        x: ns.length === 0 ? 60 : Math.max(...ns.map(n => n.x)) + 160,
        y: 140,
        config: {},
      };

      // Auto-connect: wire to the most recent node immediately, no confirmation needed.
      // (Previously this only opened a dialog the user could dismiss, leaving nodes
      // visibly disconnected on the canvas — not how make.com behaves.)
      if (ns.length >= 1) {
        const lastNode = ns[ns.length - 1];
        setEdges(es => {
          const alreadyLinked = es.some(e => e.from === lastNode.id && e.to === newNode.id);
          if (alreadyLinked) return es;
          return [...es, { id: `e${Date.now()}-${newNode.id}`, from: lastNode.id, to: newNode.id }];
        });
        toast({ title: "Connected", description: `${lastNode.label} → ${newNode.label}` });
      }

      return [...ns, newNode];
    });
  };

  // Part 4: make.com-style generic "+" on a connector — splits the edge into
  // two by inserting a brand-new node at its midpoint. Reuses the same node
  // catalog used by the sidebar's addNode flow, not a second picker.
  const insertNodeOnEdge = (edgeId: string, entry: CatalogNode) => {
    const edge = edges.find(ed => ed.id === edgeId);
    if (!edge) return;
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;

    const newNode: Node = {
      id: `n${nextId.current++}`,
      executorType: entry.executorType,
      label: entry.label,
      x: (fromNode.x + toNode.x) / 2,
      y: (fromNode.y + toNode.y) / 2,
      config: {},
    };

    setNodes(ns => [...ns, newNode]);
    setEdges(es => [
      ...es.filter(ed => ed.id !== edgeId),
      { id: `e${Date.now()}`, from: edge.from, to: newNode.id },
      { id: `e${Date.now() + 1}`, from: newNode.id, to: edge.to },
    ]);
    toast({ title: "Node inserted", description: `${entry.label} added between ${fromNode.label} and ${toNode.label}.` });
    setEdgeInsertPickerOpen(false);
    setEdgeInsertTargetId(null);
  };

  // ── Delete node ────────────────────────────────────────────────────────────
  const deleteNode = (nodeId: string) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId));
    setEdges(es => es.filter(e => e.from !== nodeId && e.to !== nodeId));
    if (selected === nodeId) setSelected(null);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      if (triggerType !== "manual" && triggerType !== "schedule" && triggerType !== "webhook") {
        try {
          const validation = await workflowsAPI.validate({ name, trigger_type: triggerType, trigger_config: triggerConfig });
          if (validation.errors && validation.errors.length > 0) {
            toast({ title: "Cannot save", description: validation.errors.join("; "), variant: "destructive" });
            setSaving(false);
            return;
          }
          if (validation.warnings && validation.warnings.length > 0) {
            toast({ title: "Saved with warnings", description: validation.warnings.join("; ") });
          }
        } catch { /* Validation endpoint unavailable — proceed */ }
      }
      await updateWF.mutateAsync({
        name,
        // Map executorType back to "type" so the backend executor receives the correct step type
        nodes: nodes.map(n => ({ ...n, type: n.executorType })),
        edges,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
      });
      toast({ title: "Saved!", description: "Workflow updated." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Retry (re-trigger) from context of a failed node ─────────────────────
  const retryFromNode = async (nodeIndex: number) => {
    setRetrying(true);
    try {
      // FIX #6: backend doesn't handle from_node_id as a resume, it's just triggerData.
      // We pass it as metadata so future backend support is ready. A new run starts.
      await triggerWF.mutateAsync({ id, data: { from_node_index: nodeIndex, previous_run_id: traceRunId } });
      toast({ title: "Re-triggered", description: "New run started. Previous run context sent as trigger data." });
      // Poll for new run
      await startTrace();
    } catch (e: any) {
      toast({ title: "Retry failed", description: e?.message, variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  // FIX #1: /trigger returns { ok, queued } — no run_id.
  // Poll /runs after trigger to grab the newest run's id.
  const startTrace = async () => {
    // Wait a tick for the run to be inserted
    await new Promise(r => setTimeout(r, 800));
    try {
      const res: any = await workflowsAPI.runs(id);
      const runsList: any[] = res.runs || res || [];
      const newest = runsList[0]; // list is DESC by started_at
      if (newest?.id) {
        setTraceRunId(newest.id);
        setTab("canvas");
      }
    } catch {
      // Can't get runs — fallback to runs tab
      setTab("runs");
    }
  };

  // ── Trigger ────────────────────────────────────────────────────────────────
  const trigger = async () => {
    if (nodes.length === 0) {
      toast({ title: "No nodes", description: "Add at least one node to the canvas before running.", variant: "destructive" });
      return;
    }
    // Clear old trace first so canvas resets
    setTraceRunId(null);
    try {
      await triggerWF.mutateAsync({ id });
      toast({ title: "Workflow triggered!", description: "Watching for live updates…" });
      // Poll /runs to get the run id for HTTP fallback (WS may already be firing)
      await startTrace();
    } catch (e: any) {
      toast({ title: "Trigger failed", description: e?.message, variant: "destructive" });
    }
  };

  // ── Drag ───────────────────────────────────────────────────────────────────
  // Node positions (node.x / node.y) live in WORLD space, not screen space.
  // dragOff is captured in world units too, so panning/zooming mid-drag can't
  // desync the node from the cursor (this is what previously caused nodes —
  // and therefore their edges — to drift away from where they visually sit).
  const onMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (connecting) {
      if (connecting.fromId !== nodeId) {
        const exists = edges.some(ed => ed.from === connecting.fromId && ed.to === nodeId);
        if (!exists) setEdges(es => [...es, { id: `e${Date.now()}`, from: connecting.fromId, to: nodeId }]);
      }
      setConnecting(null);
      return;
    }
    setSelected(nodeId);
    const node = nodes.find(n => n.id === nodeId)!;
    const world = screenToWorld(e.clientX, e.clientY);
    setDragging(nodeId);
    setDragOff({ x: world.x - node.x, y: world.y - node.y });
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const world = screenToWorld(e.clientX, e.clientY);
    setNodes(ns => ns.map(n => n.id === dragging ? { ...n, x: world.x - dragOff.x, y: world.y - dragOff.y } : n));
  }, [dragging, dragOff, screenToWorld]);

  const onMouseUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  // ── Right-dot connector click ──────────────────────────────────────────────
  const onConnectorClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connecting) {
      if (connecting.fromId !== nodeId) {
        const exists = edges.some(ed => ed.from === connecting.fromId && ed.to === nodeId);
        if (!exists) setEdges(es => [...es, { id: `e${Date.now()}`, from: connecting.fromId, to: nodeId }]);
      }
      setConnecting(null);
    } else {
      setConnecting({ fromId: nodeId });
    }
  };

  // ── Platform connection gating ─────────────────────────────────────────────
  const connectedPlatforms = useMemo(
    () => new Set(
      (connections as any[])
        .map((c: any) => (c.platform || c.name || "").toLowerCase())
        .filter(Boolean)
    ),
    [connections]
  );

  const missingPlatforms = useMemo(() => {
    const required = new Set(
      nodes
        .map(n => NODE_CATALOG.find(c => c.executorType === n.executorType)?.requiredPlatform)
        .filter((p): p is string => !!p)
    );
    return [...required].filter(p => !connectedPlatforms.has(p));
  }, [nodes, connectedPlatforms]);

  // ── Filtered catalog ───────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filtered = q
    ? NODE_CATALOG.filter(n => n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q))
    : NODE_CATALOG;

  const selNode     = nodes.find(n => n.id === selected);
  const selIdx      = selected ? nodes.findIndex(n => n.id === selected) : -1;
  // Active trace = WS stream running OR we have a polled run id
  const isTracing   = wsIsActive || wsIsDone || !!traceRunId;
  const traceIsLive = wsIsActive || traceRun?.status === "running";

  if (isLoading) return (
    <div style={{ height: "100vh", background: "#04060F", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="af-loader" />
    </div>
  );

  return (
    <PageTransition variant="push" speed="snappy">
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 0 #00C89660; }
          50%       { box-shadow: 0 0 0 6px #00C89600; }
        }
        @keyframes trace-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#04060F", overflow: "hidden" }}>

        {/* ── Top bar ── */}
        <div style={{ height: 56, background: "rgba(8,11,22,0.97)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, padding: "0 16px", flexShrink: 0, zIndex: 20 }}>
          <button onClick={() => nav("/workflows")} data-testid="button-back" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(232,238,255,0.5)", cursor: "pointer", fontSize: 13, padding: "6px 10px", borderRadius: 8, fontFamily: "'DM Sans',sans-serif" }}>
            <ArrowLeft size={15} /> Back
          </button>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />
          <input value={name} onChange={e => setName(e.target.value)} data-testid="input-workflow-name" style={{ flex: 1, background: "none", border: "none", color: "#E8EEFF", fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif", outline: "none" }} />

          {/* Live trace badge */}
          {isTracing && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: traceIsLive ? "rgba(56,189,248,0.1)" : "rgba(0,200,150,0.1)", border: `1px solid ${traceIsLive ? "rgba(56,189,248,0.3)" : "rgba(0,200,150,0.3)"}`, borderRadius: 20, padding: "4px 10px", flexShrink: 0 }}>
              <Radio size={11} color={traceIsLive ? "#38BDF8" : "#00C896"} style={{ animation: traceIsLive ? "pulse-dot 1s ease-in-out infinite" : undefined }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: traceIsLive ? "#38BDF8" : "#00C896", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em" }}>
                {traceIsLive ? "LIVE"
                  : wsIsDone ? execution.phase.toUpperCase()
                  : (traceRun?.status === "completed" ? "COMPLETED" : (traceRun?.status?.toUpperCase() || "TRACE"))}
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            {(["canvas", "runs", "config"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? "rgba(0,200,150,0.1)" : "transparent", border: `1px solid ${tab === t ? "rgba(0,200,150,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 8, padding: "5px 12px", color: tab === t ? "#00C896" : "rgba(232,238,255,0.4)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />
          <button onClick={trigger} disabled={triggerWF.isPending} data-testid="button-trigger" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 8, padding: "6px 14px", color: "#38BDF8", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", opacity: triggerWF.isPending ? 0.6 : 1 }}>
            <Zap size={13} /> {triggerWF.isPending ? "Running…" : "Run"}
          </button>
          <button onClick={save} disabled={saving} data-testid="button-save" style={{ display: "flex", alignItems: "center", gap: 6, background: "#00C896", border: "none", borderRadius: 8, padding: "6px 16px", color: "#04060F", fontSize: 13, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif" }}>
            <Save size={13} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* ── Pre-activation warning banner ── */}
        {tab === "canvas" && !warnDismissed && missingPlatforms.length > 0 && (
          <WarningBanner missingPlatforms={missingPlatforms} onDismiss={() => setWarnDismissed(true)} />
        )}

        {/* ── Body ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── Left panel ── */}
          {tab === "canvas" && (
            <div style={{ width: 220, background: "rgba(8,11,22,0.97)", borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", padding: "10px 8px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Search size={11} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(232,238,255,0.25)", pointerEvents: "none" }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search nodes…"
                  style={{ ...inputStyle, paddingLeft: 28, fontSize: 12, borderRadius: 8, padding: "8px 10px 8px 28px" }}
                />
              </div>

              {(q ? [null] : CATEGORY_ORDER).map(cat => {
                const items = cat ? filtered.filter(n => n.category === cat) : filtered;
                if (items.length === 0) return null;

                // Build subgroup buckets — items without a subGroup appear in a leading undefined bucket
                const subGroupOrder: (string | undefined)[] = [];
                const subGroupBuckets = new Map<string | undefined, CatalogNode[]>();
                for (const item of items) {
                  const sg = item.subGroup;
                  if (!subGroupBuckets.has(sg)) { subGroupBuckets.set(sg, []); subGroupOrder.push(sg); }
                  subGroupBuckets.get(sg)!.push(item);
                }
                const hasSubGroups = subGroupOrder.some(sg => sg !== undefined);

                return (
                  <div key={cat || "results"} style={{ marginBottom: 4 }}>
                    {cat && (
                      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.25)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", padding: "6px 6px 4px", textTransform: "uppercase" }}>
                        {cat}
                      </div>
                    )}
                    {subGroupOrder.map((sg, sgIdx) => {
                      const sgItems = subGroupBuckets.get(sg)!;
                      return (
                        <div key={sg ?? "__none__"}>
                          {hasSubGroups && sg && (
                            <div style={{
                              fontSize: 8, fontWeight: 700, color: "rgba(232,238,255,0.18)",
                              fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em",
                              padding: sgIdx === 0 ? "2px 6px 3px" : "6px 6px 3px",
                              textTransform: "uppercase",
                              borderTop: sgIdx > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                              marginTop: sgIdx > 0 ? 4 : 0,
                            }}>
                              — {sg}
                            </div>
                          )}
                          {sgItems.map(entry => {
                            const Icon = entry.icon;
                            const isLocked = !!(entry.requiredPlatform && !connectedPlatforms.has(entry.requiredPlatform));
                            return (
                              <button
                                key={entry.executorType}
                                data-testid={`add-node-${entry.executorType}`}
                                onClick={() => addNode(entry)}
                                style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, padding: "7px 8px", cursor: "pointer", marginBottom: 2, color: "#E8EEFF", fontFamily: "'DM Sans',sans-serif", textAlign: "left", transition: "all 0.13s", opacity: isLocked ? 0.65 : 1 }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${entry.color}12`; (e.currentTarget as HTMLElement).style.borderColor = `${entry.color}30`; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.04)"; }}
                              >
                                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${entry.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, position: "relative" }}>
                                  <Icon size={13} color={entry.color} />
                                  {isLocked && (
                                    <div style={{ position: "absolute", bottom: -3, right: -3, width: 12, height: 12, borderRadius: "50%", background: "#080B12", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <Lock size={7} color="#FBBF24" />
                                    </div>
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "#E8EEFF", lineHeight: 1.3 }}>
                                    {entry.label}
                                  </div>
                                  <div style={{ fontSize: 10, color: "rgba(232,238,255,0.35)", lineHeight: 1.4, marginTop: 1 }}>
                                    {isLocked ? `Connect ${entry.requiredPlatform} to use` : entry.description}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <div style={{ marginTop: "auto", padding: "10px 6px 4px", fontSize: 9, color: "rgba(232,238,255,0.2)", fontFamily: "'DM Mono',monospace", lineHeight: 1.6 }}>
                TAP NODE TO ADD<br />
                DRAG TO REPOSITION<br />
                TAP RIGHT DOT → CONNECT
              </div>
            </div>
          )}

          {/* ── Canvas ── */}
          {tab === "canvas" && (
            <div
              ref={canvasRef}
              onClick={() => { setSelected(null); if (connecting) setConnecting(null); }}
              onMouseDown={onCanvasMouseDown}
              onWheel={onCanvasWheel}
              onTouchStart={onCanvasTouchStart}
              onTouchMove={onCanvasTouchMove}
              onTouchEnd={onCanvasTouchEnd}
              style={{
                flex: 1, position: "relative", overflow: "hidden",
                background: "#04060F",
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
                backgroundSize: `${28 * camera.zoom}px ${28 * camera.zoom}px`,
                backgroundPosition: `${camera.x}px ${camera.y}px`,
                cursor: isPanning ? "grabbing" : connecting ? "crosshair" : "grab",
                touchAction: "none",
              }}
            >
              {/* Zoom controls — make.com style, bottom-right */}
              <div style={{ position: "absolute", bottom: 14, right: 14, zIndex: 40, display: "flex", flexDirection: "column", gap: 4, background: "rgba(8,11,22,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 4 }}>
                <button onClick={e => { e.stopPropagation(); zoomIn(); }} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "rgba(232,238,255,0.6)", cursor: "pointer", fontSize: 16, borderRadius: 6 }}>+</button>
                <button onClick={e => { e.stopPropagation(); zoomReset(); }} style={{ height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "rgba(232,238,255,0.35)", cursor: "pointer", fontSize: 9, fontFamily: "'DM Mono',monospace" }}>{Math.round(camera.zoom * 100)}%</button>
                <button onClick={e => { e.stopPropagation(); zoomOut(); }} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "rgba(232,238,255,0.6)", cursor: "pointer", fontSize: 16, borderRadius: 6 }}>−</button>
              </div>

              {connecting && (
                <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", background: "rgba(0,200,150,0.15)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 20, padding: "8px 18px", fontSize: 12, color: "#00C896", fontFamily: "'DM Mono',monospace", zIndex: 100, pointerEvents: "none", whiteSpace: "nowrap" }}>
                  Tap a node to connect — or tap canvas to cancel
                </div>
              )}

              {nodes.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <GitBranch size={48} color="rgba(0,200,150,0.15)" style={{ marginBottom: 16 }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(232,238,255,0.2)", fontFamily: "'Syne',sans-serif" }}>Select a template or add nodes from the left</div>
                  <div style={{ fontSize: 13, color: "rgba(232,238,255,0.1)", marginTop: 6 }}>Drag to reposition · Tap connector dot to wire · Pinch or scroll to zoom</div>
                </div>
              )}

              {/* World layer — every node and edge lives inside this single transformed
                  layer, so panning/zooming the camera moves them together as one rigid
                  scene. This is the piece that was missing before: nodes and edges were
                  drawn directly in screen space with no shared transform, which is why
                  the connector line in the bug report floated independently of the nodes. */}
              <div
                style={{
                  position: "absolute", top: 0, left: 0,
                  transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
                  transformOrigin: "0 0",
                }}
              >
                {/* SVG edges — make.com-style smooth curves with circular junction dots.
                    Idle/resting connectors stay flat and quiet (no glow, no motion).
                    A glowing traveling pulse is intentionally added only while an edge's
                    source step is actively running, so live data-flow is visible at a
                    glance without making the resting canvas look busy. See the
                    "Live data-flow pulse" block below for that animation. */}
                <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
                  {edges.map(e => {
                    const fn = nodes.find(n => n.id === e.from);
                    const tn = nodes.find(n => n.id === e.to);
                    if (!fn || !tn) return null;
                    // Connect from the right output dot of the source node to the left
                    // input dot of the target node — both dots sit at vertical-center,
                    // exactly on the node's edge (see NodeBox: left dot at left:-6,
                    // right dot at right:-6, both top:50%). Matching those exact offsets
                    // here is what keeps the line glued to the dots instead of floating.
                    const nodeW = 150;
                    const nodeH = 58; // matches NodeBox's tightened header-row height
                    const x1 = fn.x + nodeW + 1; // right dot center (right: -6 + 7 radius ≈ +1 past edge)
                    const y1 = fn.y + nodeH / 2;
                    const x2 = tn.x - 1;         // left dot center (left: -6 + 7 radius ≈ -1 before edge)
                    const y2 = tn.y + nodeH / 2;

                    // make.com-style: a short, gentle curve that hugs a straight line when
                    // nodes are vertically aligned — make.com's connectors are nearly flat,
                    // not a wide exaggerated S-bow, and the control points stay close to
                    // the straight path between the two dots.
                    const dx = Math.max(Math.abs(x2 - x1) * 0.3, 18);
                    const cp1x = x1 + dx;
                    const cp1y = y1;
                    const cp2x = x2 - dx;
                    const cp2y = y2;
                    const pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

                    const fi = nodes.findIndex(n => n.id === e.from);
                    const ti = nodes.findIndex(n => n.id === e.to);
                    const fromDone = fi >= 0 && (stepStatuses[fi] === "success" || stepStatuses[fi] === "completed");
                    const toDone   = ti >= 0 && (stepStatuses[ti] === "success" || stepStatuses[ti] === "completed");
                    const bothDone = fromDone && toDone;
                    const isRunningEdge = isTracing && stepStatuses[fi] === "running";

                    // Feature 3: node-level paused edge — dimmed when the source node is paused
                    const fromNode = fi >= 0 ? nodes[fi] : null;
                    const isPausedEdge = !!(fromNode?.config?.paused);

                    // Edge color logic:
                    //  - Paused (idle):   dim red-ish to signal "this path is blocked"
                    //  - Running NOW:     bright cyan — the data-flow animation reads on top
                    //  - Both steps done: saturated green — this path ran successfully
                    //  - Otherwise tracing (steps not yet reached): very dim white
                    //  - Idle (no run):   neutral gray, readable against dark canvas
                    const edgeColor = isPausedEdge && !isTracing
                      ? "rgba(251,113,133,0.25)"
                      : isRunningEdge
                      ? "rgba(56,189,248,0.5)"   // brighter for the active connector
                      : bothDone
                      ? "#00C896"
                      : isTracing
                      ? "rgba(255,255,255,0.14)"
                      : "rgba(180,190,210,0.75)";

                    const isIdleEdge = !isPausedEdge && !isTracing && !bothDone;
                    const edgeDash = isIdleEdge ? "4 4" : undefined;
                    const edgeWidth = bothDone ? 1.5 : isRunningEdge ? 2 : 1;
                    // Endpoint dots — previous pass shrank these to r=2 at 0.6 opacity in
                    // the new neutral gray, which read as literally invisible on an actual
                    // phone screen rather than merely "subtle." Bumped back up slightly so
                    // they're reliably visible while still reading as quieter than the
                    // original r=3 full-saturation version.
                    const dotColor = bothDone ? "#00C896" : edgeColor;
                    const dotOpacity = 1;

                    // Delete badge stays at the true connector midpoint.
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    // Part 4 "+" sits just past the source node's right edge rather than
                    // glued to the connector's midpoint — sitting mid-line made it easy to
                    // miss-tap into the node body next to it (which opens node config, not
                    // this picker) on short connectors. Clamped to the actual gap between
                    // the two nodes so it can't overshoot into the target node's body when
                    // nodes sit close together at the standard 160px spacing.
                    // Small fixed gap from the source node's edge — enough visual
                    // separation that the button doesn't look glued to the node, while
                    // staying clamped so it can't overshoot into the target node's body
                    // at the standard ~10-16px gap between nodes.
                    const gapMid = (x1 + x2) / 2;
                    const plusX = Math.min(x1 + 12, gapMid);
                    const plusY = y1 + 10;

                    return (
                      <g key={e.id}>
                        {/* Main edge — clean rounded line, no arrowhead marker. The path
                            itself never glows; the glow effect lives on the separate
                            traveling pulse circles rendered below while this edge is
                            actively running (see "Live data-flow pulse"). */}
                        <path
                          d={pathD}
                          stroke={edgeColor}
                          strokeWidth={edgeWidth}
                          strokeLinecap="round"
                          strokeDasharray={edgeDash}
                          fill="none"
                          style={{ transition: "stroke 0.35s, stroke-width 0.2s" }}
                        />

                        {/* Endpoint dots — small, muted circles exactly on the output/input
                            ports, matching make.com's quiet junction markers. Only these two. */}
                        <circle cx={x1} cy={y1} r={3.5} fill={dotColor} opacity={dotOpacity} />
                        <circle cx={x2} cy={y2} r={3.5} fill={dotColor} opacity={dotOpacity} />

                        {/* Live data-flow pulse — visible only while this edge's source
                            step is actively running. Uses two concentric animated circles:
                            an outer soft halo (large, low-opacity) + an inner bright core,
                            so the moving pulse reads clearly as "data is flowing here right now"
                            even at a glance and on small mobile viewports. The paused-edge
                            dim treatment (isPausedEdge) is intentionally left static/unchanged. */}
                        {isRunningEdge && (
                          <g>
                            {/* Outer glow halo */}
                            <circle r="7" fill="rgba(56,189,248,0.22)">
                              <animateMotion dur="1.1s" repeatCount="indefinite" path={pathD} />
                            </circle>
                            {/* Inner bright core */}
                            <circle r="4" fill="#38BDF8">
                              <animateMotion dur="1.1s" repeatCount="indefinite" path={pathD} />
                            </circle>
                          </g>
                        )}

                        {/* Invisible fat hit-area for tap-to-delete */}
                        <path
                          d={pathD}
                          stroke="transparent"
                          strokeWidth={20}
                          fill="none"
                          style={{ cursor: "pointer", pointerEvents: "stroke" }}
                          onClick={ev => {
                            ev.stopPropagation();
                            if (window.confirm(`Remove this connection?`)) {
                              setEdges(es => es.filter(ed => ed.id !== e.id));
                            }
                          }}
                          onMouseEnter={ev => { (ev.target as SVGPathElement).setAttribute("stroke", "rgba(251,113,133,0.2)"); }}
                          onMouseLeave={ev => { (ev.target as SVGPathElement).setAttribute("stroke", "transparent"); }}
                        />

                        {/* Mid-point delete badge — always visible at low opacity rather than
                            hover-triggered. SVG <animate begin="mouseover"> never fires on
                            touch devices, which made this button invisible and effectively
                            untappable on mobile. Always-on and subtle at rest, same as
                            make.com's own connector controls, which don't require a hover
                            state either. */}
                        <g
                          style={{ cursor: "pointer", pointerEvents: "all" }}
                          onClick={ev => {
                            ev.stopPropagation();
                            setEdges(es => es.filter(ed => ed.id !== e.id));
                          }}
                        >
                          <circle cx={midX} cy={midY - 10} r={10} fill="rgba(8,11,22,0.9)" stroke="rgba(251,113,133,0.55)" strokeWidth={1.5} opacity={0.85} className="edge-delete-btn" />
                          <text x={midX} y={midY - 10 + 4.5} textAnchor="middle" fontSize="13" fill="#FB7185" fontWeight="bold" pointerEvents="none" opacity={0.9}>
                            ×
                          </text>
                        </g>

                        {/* Part 4: generic "+" on the connector — inserts a new node at
                            this edge's midpoint, splitting it into two. Offset from the
                            delete badge above so the two click targets never overlap.
                            Always visible (not hover-only) for the same touch-device
                            reason as the delete badge above. */}
                        <g
                          style={{ cursor: "pointer", pointerEvents: "all" }}
                          onClick={ev => {
                            ev.stopPropagation();
                            setEdgeInsertTargetId(e.id);
                            setEdgeInsertPickerOpen(true);
                          }}
                        >
                          <circle cx={plusX} cy={plusY} r={9} fill="rgba(8,11,22,0.9)" stroke="rgba(0,200,150,0.55)" strokeWidth={1.5} opacity={0.85} className="edge-insert-btn" />
                          <g pointerEvents="none" opacity={0.9}>
                            <line x1={plusX - 4} y1={plusY} x2={plusX + 4} y2={plusY} stroke="#00C896" strokeWidth={1.5} strokeLinecap="round" />
                            <line x1={plusX} y1={plusY - 4} x2={plusX} y2={plusY + 4} stroke="#00C896" strokeWidth={1.5} strokeLinecap="round" />
                          </g>
                        </g>
                      </g>
                    );
                  })}
                </svg>


                {nodes.map((n, idx) => (
                  <div key={n.id} style={{ position: "absolute", left: n.x, top: n.y }} onMouseDown={e => onMouseDown(e, n.id)}>
                    <NodeBox
                      node={n}
                      selected={selected === n.id}
                      connecting={connecting?.fromId === n.id}
                      traceStatus={isTracing ? (stepStatuses[idx] ?? "pending") : null}
                      onSelect={setSelected}
                      onDelete={deleteNode}
                      onConnectorClick={onConnectorClick}
                      onPauseToggle={() => toggleNodePause(n.id)}
                      onFanout={() => { setFanoutSourceNodeId(n.id); setFanoutPickerOpen(true); }}
                      onContextMenu={e => setContextMenu({ nodeId: n.id, x: e.clientX, y: e.clientY })}
                    />
                  </div>
                ))}
              </div>

              {nodes.length > 0 && !isTracing && (
                <div style={{ position: "absolute", bottom: 14, left: 14, zIndex: 10, pointerEvents: "none" }}>
                  <div style={{ background: "rgba(8,11,22,0.8)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "4px 12px", fontSize: 10, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace" }}>
                    {nodes.length} node{nodes.length !== 1 ? "s" : ""} · {edges.length} edge{edges.length !== 1 ? "s" : ""}
                  </div>
                </div>
              )}

              {/* Fan-out node picker — full categorized catalog, available from any node */}
              {fanoutPickerOpen && (
                <div
                  style={{ position: "absolute", inset: 0, zIndex: 200, background: "rgba(4,6,15,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => { setFanoutPickerOpen(false); setFanoutSourceNodeId(null); }}
                >
                  <div
                    style={{ background: "rgba(8,11,22,0.98)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 16, padding: 24, width: 340, maxWidth: "92vw", maxHeight: "78vh", overflowY: "auto" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 4 }}>Add Fan-out Branch</div>
                    <div style={{ fontSize: 11, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", marginBottom: 16 }}>
                      A Router node will be inserted. Pick any node type for the new branch:
                    </div>

                    {CATEGORY_ORDER.map(cat => {
                      const items = NODE_CATALOG.filter(c => c.category === cat);
                      if (items.length === 0) return null;

                      // Build subgroup buckets within this category
                      const sgOrder: (string | undefined)[] = [];
                      const sgBuckets = new Map<string | undefined, CatalogNode[]>();
                      for (const item of items) {
                        const sg = item.subGroup;
                        if (!sgBuckets.has(sg)) { sgBuckets.set(sg, []); sgOrder.push(sg); }
                        sgBuckets.get(sg)!.push(item);
                      }
                      const hasSub = sgOrder.some(sg => sg !== undefined);

                      return (
                        <div key={cat} style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", marginBottom: 6, textTransform: "uppercase" }}>
                            {cat}
                          </div>
                          {sgOrder.map((sg, sgIdx) => (
                            <div key={sg ?? "__none__"}>
                              {hasSub && sg && (
                                <div style={{
                                  fontSize: 8, fontWeight: 700, color: "rgba(232,238,255,0.2)",
                                  fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em",
                                  padding: sgIdx === 0 ? "0 0 4px" : "8px 0 4px",
                                  textTransform: "uppercase",
                                  borderTop: sgIdx > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                                  marginTop: sgIdx > 0 ? 4 : 0,
                                }}>
                                  — {sg}
                                </div>
                              )}
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {sgBuckets.get(sg)!.map(entry => {
                                  const Icon = entry.icon;
                                  const isLocked = !!(entry.requiredPlatform && !connectedPlatforms.has(entry.requiredPlatform));
                                  return (
                                    <button
                                      key={entry.executorType}
                                      onClick={() => fanoutSourceNodeId && insertFanoutBranch(fanoutSourceNodeId, entry)}
                                      style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${isLocked ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.09)"}`, borderRadius: 10, padding: "9px 12px", cursor: "pointer", transition: "background 0.15s", opacity: isLocked ? 0.6 : 1, textAlign: "left", width: "100%" }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${entry.color}12`; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
                                    >
                                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${entry.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                                        <Icon size={13} color={entry.color} />
                                        {isLocked && (
                                          <div style={{ position: "absolute", bottom: -3, right: -3, width: 12, height: 12, borderRadius: "50%", background: "#080B12", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Lock size={7} color="#FBBF24" />
                                          </div>
                                        )}
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF" }}>{entry.label}</div>
                                        <div style={{ fontSize: 10, color: isLocked ? "#FBBF24" : "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace" }}>
                                          {isLocked ? `Connect ${entry.requiredPlatform} to use` : entry.description}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    <button
                      onClick={() => { setFanoutPickerOpen(false); setFanoutSourceNodeId(null); }}
                      style={{ width: "100%", marginTop: 8, background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px", color: "rgba(232,238,255,0.4)", fontSize: 12, cursor: "pointer" }}
                    >Cancel</button>
                  </div>
                </div>
              )}

              {/* Part 4: generic "+" node-insert picker — reuses the full NODE_CATALOG,
                  same list the sidebar's addNode flow uses, not a second catalog. */}
              {edgeInsertPickerOpen && (
                <div
                  style={{ position: "absolute", inset: 0, zIndex: 200, background: "rgba(4,6,15,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => { setEdgeInsertPickerOpen(false); setEdgeInsertTargetId(null); }}
                >
                  <div
                    style={{ background: "rgba(8,11,22,0.98)", border: "1px solid rgba(0,200,150,0.3)", borderRadius: 16, padding: 24, width: 300, maxWidth: "90vw", maxHeight: "70vh", overflowY: "auto" }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 4 }}>Insert Node</div>
                    <div style={{ fontSize: 11, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", marginBottom: 16 }}>
                      Pick a node to insert on this connector — it will split into two.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {NODE_CATALOG.map(entry => {
                        const Icon = entry.icon;
                        const isLocked = !!(entry.requiredPlatform && !connectedPlatforms.has(entry.requiredPlatform));
                        return (
                          <button
                            key={entry.executorType}
                            onClick={() => edgeInsertTargetId && insertNodeOnEdge(edgeInsertTargetId, entry)}
                            style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "9px 12px", cursor: "pointer", transition: "background 0.15s", opacity: isLocked ? 0.65 : 1 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${entry.color}12`; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
                          >
                            <div style={{ width: 26, height: 26, borderRadius: 7, background: `${entry.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Icon size={12} color={entry.color} />
                            </div>
                            <div style={{ flex: 1, textAlign: "left" }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#E8EEFF" }}>{entry.label}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => { setEdgeInsertPickerOpen(false); setEdgeInsertTargetId(null); }}
                      style={{ width: "100%", marginTop: 14, background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px", color: "rgba(232,238,255,0.4)", fontSize: 12, cursor: "pointer" }}
                    >Cancel</button>
                  </div>
                </div>
              )}

              {/* Right-click / long-press context menu */}
              {contextMenu && (() => {
                const cmNode = nodes.find(n => n.id === contextMenu.nodeId);
                if (!cmNode) return null;
                const isPaused = !!cmNode.config?.paused;
                const isDisabled = !!cmNode.config?.disabled;
                const cmIdx = nodes.findIndex(n => n.id === contextMenu.nodeId);
                const menuItems: Array<{ label: string; icon: React.ReactNode; action: () => void; danger?: boolean; color?: string }> = [
                  {
                    label: isPaused ? "Resume node" : "Pause node",
                    icon: isPaused ? <PlayCircle size={13} /> : <PauseCircle size={13} />,
                    action: () => { toggleNodePause(contextMenu.nodeId); setContextMenu(null); },
                    color: isPaused ? "#00C896" : "#FBBF24",
                  },
                  {
                    label: isDisabled ? "Enable node" : "Disable node",
                    icon: isDisabled ? <PlayCircle size={13} /> : <StopCircle size={13} />,
                    action: () => { toggleNodeDisable(contextMenu.nodeId); setContextMenu(null); },
                    color: isDisabled ? "#00C896" : "rgba(232,238,255,0.5)",
                  },
                  {
                    label: "Duplicate",
                    icon: <Copy size={13} />,
                    action: () => { duplicateNode(contextMenu.nodeId); setContextMenu(null); },
                  },
                  {
                    label: "Rename",
                    icon: <Pencil size={13} />,
                    action: () => { renameNode(contextMenu.nodeId); setContextMenu(null); },
                  },
                  {
                    label: "Edit / Configure",
                    icon: <Settings2 size={13} />,
                    action: () => { setSelected(contextMenu.nodeId); setContextMenu(null); },
                  },
                  {
                    label: "Inspect last run",
                    icon: <Eye size={13} />,
                    action: () => { setTab("runs"); setContextMenu(null); },
                  },
                  {
                    label: "Retry from here",
                    icon: <RefreshCw size={13} />,
                    action: () => { retryFromNode(cmIdx); setContextMenu(null); },
                  },
                  {
                    label: "Delete node",
                    icon: <Trash2 size={13} />,
                    action: () => { deleteNode(contextMenu.nodeId); setContextMenu(null); },
                    danger: true,
                  },
                ];
                return (
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 500 }}
                    onClick={() => setContextMenu(null)}
                    onContextMenu={e => { e.preventDefault(); setContextMenu(null); }}
                  >
                    <div
                      style={{
                        position: "fixed",
                        left: Math.min(contextMenu.x, window.innerWidth - 200),
                        top: Math.min(contextMenu.y, window.innerHeight - (menuItems.length * 38 + 16)),
                        width: 196,
                        background: "rgba(8,11,22,0.97)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                        padding: "6px 0",
                        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                        backdropFilter: "blur(12px)",
                        zIndex: 501,
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div style={{ padding: "6px 12px 4px", fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4 }}>
                        {cmNode.label.toUpperCase()}
                      </div>
                      {menuItems.map((item, i) => (
                        <button
                          key={i}
                          onClick={item.action}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            width: "100%", background: "none", border: "none",
                            padding: "8px 12px", cursor: "pointer", textAlign: "left",
                            color: item.danger ? "#FB7185" : item.color ?? "rgba(232,238,255,0.8)",
                            fontSize: 12, fontFamily: "'DM Sans',sans-serif",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = item.danger ? "rgba(251,113,133,0.1)" : "rgba(255,255,255,0.05)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* FIX: use WS run data when available, fall back to polled run */}
              {isTracing && (wsIsActive || wsIsDone || traceRun) && (
                <TraceStatusBar
                  run={wsIsDone || wsIsActive
                    ? { status: execution.phase, duration_ms: execution.durationMs }
                    : traceRun}
                  stepStatuses={stepStatuses}
                  nodeCount={nodes.length}
                  onDismiss={() => { setTraceRunId(null); }}
                />
              )}
            </div>
          )}

          {/* ── Runs tab ── */}
          {tab === "runs" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <RunsPanel
                workflowId={id}
                onReplay={(runId) => {
                  setTraceRunId(runId);
                  setTab("canvas");
                }}
              />
            </div>
          )}

          {/* ── Config tab ── */}
          {tab === "config" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              <div className="af-glass" style={{ borderRadius: 16, padding: "24px", maxWidth: 600 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E8EEFF", fontFamily: "'Syne',sans-serif", marginBottom: 20 }}>Workflow Settings</div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8 }}>NAME</label>
                  <input value={name} onChange={e => setName(e.target.value)} data-testid="input-config-name" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 14px", color: "#E8EEFF", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 4 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 8 }}>TRIGGER TYPE</label>
                  <select value={triggerType} onChange={e => { setTriggerType(e.target.value); setTriggerConfig({}); }} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 14px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer", boxSizing: "border-box" }}>
                    {TRIGGER_TYPES.map(tt => <option key={tt.value} value={tt.value} style={{ background: "#04060F" }}>{tt.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <TriggerConfigFields triggerType={triggerType} triggerConfig={triggerConfig} setTriggerConfig={setTriggerConfig} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,238,255,0.4)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 12 }}>STATISTICS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { label: "Total Nodes",  val: nodes.length },
                      { label: "Connections",  val: edges.length },
                      { label: "Trigger",      val: TRIGGER_TYPES.find(t => t.value === triggerType)?.label || triggerType },
                      { label: "Status",       val: (data as any)?.is_active ? "Active" : "Paused" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#00C896", fontFamily: "'DM Mono',monospace" }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: "rgba(232,238,255,0.35)" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 8, background: "#00C896", border: "none", borderRadius: 10, padding: "10px 20px", color: "#04060F", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                  <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* ── Right panel: node config ── */}
          {tab === "canvas" && selected && selNode && (
            <div style={{ width: 260, background: "rgba(8,11,22,0.97)", borderLeft: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", padding: "16px", flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,238,255,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 14 }}>NODE CONFIG</div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>LABEL</label>
                <input
                  data-testid="input-node-label"
                  value={selNode.label}
                  onChange={e => setNodes(ns => ns.map(n => n.id === selected ? { ...n, label: e.target.value } : n))}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "8px 10px", color: "#E8EEFF", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>TYPE</label>
                {(() => {
                  const entry = NODE_CATALOG.find(n => n.executorType === selNode.executorType);
                  const color = entry?.color || "#00C896";
                  return (
                    <div style={{ fontSize: 11, color, fontFamily: "'DM Mono',monospace", background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 8, padding: "6px 10px", letterSpacing: "0.04em" }}>
                      {selNode.executorType.toUpperCase()}
                    </div>
                  );
                })()}
              </div>

              {/* FIX #2: trace step result uses stepStatuses[selIdx] */}
              {isTracing && selIdx >= 0 && stepStatuses[selIdx] && stepStatuses[selIdx] !== "pending" && (() => {
                const status = stepStatuses[selIdx];
                const color = TRACE_COLORS[status] || TRACE_COLORS.pending;
                // Find the log entry for this step index
                const logEntry = (traceRun?.logs || []).find((l: any) => l.step === selIdx);
                const stepLogs: any[] = logEntry?.logs || [];
                const lastLog = stepLogs[stepLogs.length - 1];
                const errorLog = stepLogs.find((l: any) => l.level === "error");
                return (
                  <div style={{ marginBottom: 14, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px", border: `1px solid ${color}30` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(232,238,255,0.35)", fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", marginBottom: 6 }}>STEP RESULT</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <TraceStatusIcon status={status} />
                      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'DM Mono',monospace" }}>
                        {status.toUpperCase()}
                      </span>
                    </div>
                    {lastLog?.msg && !errorLog && (
                      <div style={{ fontSize: 10, color: "rgba(232,238,255,0.5)", fontFamily: "'DM Mono',monospace", marginTop: 6, wordBreak: "break-all", maxHeight: 80, overflow: "hidden" }}>
                        {lastLog.msg.slice(0, 160)}{lastLog.msg.length > 160 ? "…" : ""}
                      </div>
                    )}
                    {errorLog && (
                      <div style={{ fontSize: 10, color: "#FB7185", fontFamily: "'DM Mono',monospace", marginTop: 6, wordBreak: "break-all" }}>
                        {errorLog.msg.slice(0, 160)}
                      </div>
                    )}

                    {/* FIX #6: retry starts a fresh run, clarified in label */}
                    {(status === "failed") && (
                      <button
                        onClick={() => retryFromNode(selIdx)}
                        disabled={retrying}
                        style={{
                          marginTop: 10, width: "100%",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          background: retrying ? "rgba(251,113,133,0.05)" : "rgba(251,113,133,0.12)",
                          border: "1px solid rgba(251,113,133,0.35)",
                          borderRadius: 8, padding: "9px 0",
                          color: "#FB7185", fontSize: 12, fontWeight: 700,
                          cursor: retrying ? "not-allowed" : "pointer",
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        <RotateCcw size={12} style={{ animation: retrying ? "spin-slow 1s linear infinite" : undefined }} />
                        {retrying ? "Triggering…" : "Re-trigger workflow"}
                      </button>
                    )}
                  </div>
                );
              })()}

              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 2 }} />
              <NodeConfigFields node={selNode} setNodes={setNodes} />
              <ContextVariables />

              <button
                onClick={() => deleteNode(selected)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)", borderRadius: 10, padding: "11px", color: "#FB7185", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", marginTop: 18 }}
              >
                <Trash2 size={13} /> Delete Node
              </button>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
