/**
 * blueprintToSteps — client-side port of nodesToSteps() from routes/workflows.js
 *
 * NOTE: Keep this file in lockstep with routes/workflows.js nodesToSteps().
 * If you update the BFS logic, edge handling, or router fan-out in either file,
 * update the other file too. Both files implement the same algorithm.
 *
 * Converts a flat {nodes, edges} blueprint (the shape the AI emits and the
 * Workflow Builder saves) into a flat ordered steps array (the shape the
 * executor and /api/workflows/validate expect).
 *
 * Used by WorkflowCard in pages/AIChat.tsx to prepare the payload for
 * POST /api/workflows/validate before allowing the user to create a workflow.
 */

export interface BlueprintNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
}

export interface BlueprintEdge {
  from: string;
  to: string;
}

export interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
}

// Maps node type names from the builder/AI to executor step types.
// Types already in VALID_STEP_TYPES pass through unchanged.
const NODE_TYPE_TO_STEP_TYPE: Record<string, string> = {
  trigger:   'trigger',
  action:    'http_request',
  condition: 'condition',
  ai:        'ai_generate',
  notify:    'slack_post',
  webhook:   'http_request',
  filter:    'filter',
  code:      'transform',
  database:  'database',
};

/**
 * blueprintToSteps — BFS walk from the trigger node, following from/to edges.
 * Router nodes fan out into parallel_branches just like the backend version.
 *
 * @param nodes - array of blueprint nodes
 * @param edges - array of {from, to} edges (NOT React Flow source/target)
 * @returns ordered flat step array suitable for the executor
 */
export function blueprintToSteps(nodes: BlueprintNode[], edges: BlueprintEdge[]): WorkflowStep[] {
  if (!nodes || nodes.length === 0) return [];

  const startNode = nodes.find(n => n.type === 'trigger') || nodes[0];
  if (!startNode) return [];

  // Build adjacency map: nodeId → [nextNodeId, ...]
  const edgeMap: Record<string, string[]> = {};
  for (const edge of (edges || [])) {
    if (!edgeMap[edge.from]) edgeMap[edge.from] = [];
    edgeMap[edge.from].push(edge.to);
  }

  // Build a branch sub-step list starting from startId (for router fan-out)
  function buildBranch(startId: string, visitedSet: Set<string>): WorkflowStep[] {
    const branchSteps: WorkflowStep[] = [];
    const bQueue: string[] = [startId];
    const bVisited = new Set(visitedSet);
    while (bQueue.length > 0) {
      const nId = bQueue.shift()!;
      if (bVisited.has(nId)) continue;
      bVisited.add(nId);
      const n = nodes.find(x => x.id === nId);
      if (!n) continue;
      const t = NODE_TYPE_TO_STEP_TYPE[n.type] ?? n.type ?? 'action';
      branchSteps.push({ id: n.id, type: t, name: n.label || n.type, config: n.config || {} });
      for (const nextId of (edgeMap[nId] || [])) bQueue.push(nextId);
    }
    return branchSteps;
  }

  // BFS walk from trigger node
  const ordered: WorkflowStep[] = [];
  const visited = new Set<string>();
  const queue: string[] = [startNode.id];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    const rawType = node.type || '';
    const stepType = NODE_TYPE_TO_STEP_TYPE[rawType] ?? rawType;
    const isRouter = rawType === 'router';

    if (isRouter) {
      // Fan-out: each outgoing edge becomes its own parallel branch
      const downstreamIds = edgeMap[nodeId] || [];
      const branches = downstreamIds.map(branchRootId => buildBranch(branchRootId, visited));
      ordered.push({
        id:     node.id,
        type:   'router',
        name:   node.label || 'Router',
        config: {
          ...(node.config || {}),
          parallel_branches: branches,
        },
      });
      // Mark all branch nodes visited so the main BFS doesn't re-emit them
      for (const branch of branches) {
        for (const s of branch) visited.add(s.id);
      }
    } else {
      ordered.push({
        id:     node.id,
        type:   stepType,
        name:   node.label || node.type,
        config: node.config || {},
      });
      for (const nextId of (edgeMap[nodeId] || [])) {
        queue.push(nextId);
      }
    }
  }

  return ordered;
}
