/**
 * useWebSocket — Phase 3 compatibility shim
 *
 * DEPRECATED: Components should consume useWebSocketContext() directly.
 * This shim exists to preserve any external imports without breaking changes.
 * It delegates to the shared WebSocketContext rather than creating a new connection.
 */
export { useWebSocketContext as useWebSocket } from "../contexts/WebSocketContext";
export type { WSStatus, WSQuality } from "../contexts/WebSocketContext";
