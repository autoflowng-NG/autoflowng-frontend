import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workflowsAPI, automationsAPI } from "../lib/api";
import { queryKeys, invalidate } from "../lib/queryClient";
import { useNavigate } from "react-router-dom";
import { useOrg } from "../contexts/OrgContext";
import { invalidateOrgWorkflows } from "./useOrgWorkflows";

export function useWorkflows() {
  return useQuery({
    queryKey: queryKeys.workflows,
    queryFn:  () => workflowsAPI.list().then((d: any) => d.workflows || []),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: queryKeys.workflow(id),
    queryFn:  () => workflowsAPI.get(id).then((d: any) => d.workflow),
    enabled:  !!id,
  });
}

export function useWorkflowRuns(workflowId: string) {
  return useQuery({
    queryKey: queryKeys.workflowRuns(workflowId),
    queryFn:  () => workflowsAPI.runs(workflowId).then((d: any) => d.runs || []),
    enabled:  !!workflowId,
    refetchInterval: (query) => {
      const runs = (query.state.data as any[]) || [];
      const hasActive = runs.some((r: any) => r.status === "running");
      return hasActive ? 3_000 : false;
    },
  });
}

export function useWorkflowRun(workflowId: string, runId: string) {
  return useQuery({
    queryKey: queryKeys.workflowRun(workflowId, runId),
    queryFn:  () => workflowsAPI.run(workflowId, runId).then((d: any) => d.run),
    enabled:  !!(workflowId && runId),
  });
}

export function useCreateWorkflow() {
  const { activeOrg } = useOrg();
  return useMutation({
    mutationFn: (data: any) => workflowsAPI.create(data),
    onSuccess:  () => {
      invalidate.workflows();
      invalidateOrgWorkflows(activeOrg?.id ?? null);
    },
  });
}

export function useUpdateWorkflow(id: string) {
  return useMutation({
    mutationFn: (data: any) => workflowsAPI.update(id, data),
    onSuccess:  () => { invalidate.workflow(id); invalidate.workflows(); },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  const { activeOrg } = useOrg();
  return useMutation({
    mutationFn: (id: string) => workflowsAPI.delete(id),
    onMutate:   async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.workflows });
      const prev = qc.getQueryData(queryKeys.workflows);
      qc.setQueryData(queryKeys.workflows, (old: any) => old?.filter((w: any) => w.id !== id));
      return { prev };
    },
    onError:   (err, id, ctx: any) => qc.setQueryData(queryKeys.workflows, ctx.prev),
    onSettled: () => {
      invalidate.workflows();
      invalidateOrgWorkflows(activeOrg?.id ?? null);
    },
  });
}

export function useToggleWorkflow() {
  const qc = useQueryClient();
  const { activeOrg } = useOrg();
  return useMutation({
    mutationFn: (id: string) => workflowsAPI.toggle(id),
    onMutate:   async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.workflows });
      const prev = qc.getQueryData(queryKeys.workflows);
      qc.setQueryData(queryKeys.workflows, (old: any) =>
        old?.map((w: any) => w.id === id ? { ...w, is_active: !w.is_active } : w)
      );
      return { prev };
    },
    onError:   (err, id, ctx: any) => qc.setQueryData(queryKeys.workflows, ctx.prev),
    onSuccess: (data: any, id) => {
      invalidate.workflow(id);
      invalidate.workflows();
      invalidateOrgWorkflows(activeOrg?.id ?? null);
    },
  });
}

export function useTriggerWorkflow() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) => workflowsAPI.trigger(id, data),
    onSuccess:  (res: any, { id }) => { setTimeout(() => invalidate.workflow(id), 1_000); },
  });
}


export function useAgentTasks() {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn:  () => automationsAPI.tasks.list().then((d: any) => d.tasks || []),
    refetchInterval: 10_000,
  });
}

export function useWorkflowTemplates() {
  return useQuery({
    queryKey: ["workflow-templates"],
    queryFn:  () => workflowsAPI.templates().then((d: any) => d.templates || d || []),
    staleTime: 5 * 60_000,
  });
}

export function useActivateTemplate() {
  const nav = useNavigate();
  const { activeOrg } = useOrg();
  return useMutation({
    mutationFn: (templateId: string) => workflowsAPI.activateTemplate(templateId),
    onSuccess:  (res: any) => {
      const id = res?.workflow?.id || res?.id;
      if (id) {
        invalidate.workflows();
        invalidateOrgWorkflows(activeOrg?.id ?? null);
        nav(`/workflow-builder/${id}`);
      }
    },
    onError: (err: any) => {
      console.error("[useActivateTemplate]", err);
    },
  });
}

/* ── Automations hooks ──────────────────────────────────────────────── */
export function useAutomations() {
  return useQuery({
    queryKey: ["automations"],
    queryFn:  () => automationsAPI.list().then((d: any) => d.automations || d.tasks || []),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { templateId: string; enabled: boolean }) =>
      automationsAPI.toggle(data),
    onSettled: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useRunAutomation() {
  return useMutation({
    mutationFn: (templateId: string) => automationsAPI.run(templateId),
  });
}

export function useAutomationLogs(templateId: string) {
  return useQuery({
    queryKey: ["automation-logs", templateId],
    queryFn:  () => automationsAPI.logs(templateId).then((d: any) => d.logs || []),
    enabled:  !!templateId,
  });
}
