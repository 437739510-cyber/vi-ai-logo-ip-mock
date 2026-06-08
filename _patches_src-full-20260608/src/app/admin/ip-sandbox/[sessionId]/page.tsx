"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Check, X, SkipForward, RefreshCw, AlertCircle,
  ChevronLeft, Wand2, Sparkles, ArrowRight, ImageIcon
} from "lucide-react";

interface Step {
  stepId: string;
  label: string;
  status: "pending" | "generating" | "reviewing" | "approved" | "skipped" | "failed" | "cancelled";
  estimatedCost: number;
  actualCost: number | null;
  generatedAssetUrl: string | null;
  attempts: number;
  dependsOn: string[];
  approvalNote?: string;
  rejectionReason?: string;
}

interface Session {
  sessionId: string;
  projectId: string;
  steps: Step[];
  status: "planning" | "in_progress" | "completed" | "cancelled";
  currentStepIndex: number;
  totalEstimatedCost: number;
  totalActualCost: number;
  balanceAtStart: number;
  balanceCurrent: number;
}

interface Summary {
  totalSteps: number;
  completedSteps: number;
  approvedSteps: number;
  skippedSteps: number;
  failedSteps: number;
  remainingSteps: number;
  progressPercent: number;
  currentStep: Step | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-neutral-200",
  generating: "bg-blue-400 animate-pulse",
  reviewing: "bg-amber-400",
  approved: "bg-green-500",
  skipped: "bg-neutral-300",
  failed: "bg-red-400",
  cancelled: "bg-neutral-200 line-through",
};

const STATUS_ICONS: Record<string, string> = {
  pending: "\u25CB",
  generating: "\u25D4",
  reviewing: "\u25D0",
  approved: "\u2713",
  skipped: "\u2014",
  failed: "\u2717",
  cancelled: "\u00D7",
};

export default function IPSandboxPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [skipReason, setSkipReason] = useState("");

  // Load session
  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/ip-sandbox/session?id=${sessionId}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSession(data.session);
        setSummary(data.summary);
      }
    } catch {
      setError("Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) loadSession();
  }, [sessionId, loadSession]);

  // Action helper
  const doAction = async (action: string, stepId?: string) => {
    if (!session) return;
    setActionLoading(action);
    try {
      const res = await fetch("/api/ip-sandbox/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          action,
          stepId: stepId || summary?.currentStep?.stepId,
          note: action === "approve" ? approvalNote || undefined : (action === "skip" ? skipReason || undefined : undefined),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSession(data.session);
        setSummary(data.summary);
        if (action === "approve") setApprovalNote("");
        if (action === "skip") setSkipReason("");
      }
    } catch {
      setError(`Action ${action} failed`);
    } finally {
      setActionLoading(null);
    }
  };

  // Current step
  const currentStep = summary?.currentStep || null;
  const currentIndex = currentStep ? session?.steps.findIndex((s) => s.stepId === currentStep.stepId) ?? -1 : -1;

  // Completed steps count
  const completedCount = summary?.completedSteps ?? 0;
  const totalSteps = summary?.totalSteps ?? 0;
  const progressPercent = summary?.progressPercent ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-neutral-600 mb-4">{error}</p>
        <button onClick={loadSession} className="text-sm text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <ImageIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <p className="text-neutral-500">Session not found</p>
      </div>
    );
  }

  const isComplete = session.status === "completed" || session.status === "cancelled";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/admin/projects/${session.projectId}`}
            className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 mb-1"
          >
            <ChevronLeft className="w-3 h-3" />
            Back to project
          </Link>
          <h1 className="text-xl font-bold text-neutral-900">IP Generation Sandbox</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            session.status === "completed" ? "bg-green-50 text-green-700" :
            session.status === "cancelled" ? "bg-neutral-100 text-neutral-500" :
            "bg-blue-50 text-blue-700"
          }`}>
            {session.status === "completed" ? "Completed" :
             session.status === "cancelled" ? "Cancelled" :
             session.status === "in_progress" ? "In Progress" : "Planning"}
          </span>
        </div>
      </div>

      {/* Progress & Balance Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-neutral-700">
            Progress ({completedCount}/{totalSteps})
          </span>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <span>Used: <strong className="text-neutral-800">${session.totalActualCost.toFixed(2)}</strong></span>
            <span>Balance: <strong className="text-green-600">${session.balanceCurrent.toFixed(2)}</strong></span>
          </div>
        </div>
        <div className="w-full bg-neutral-100 rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all duration-500"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Step Progress Dots */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between">
          {session.steps.map((step, i) => {
            const isCurrent = currentStep?.stepId === step.stepId;
            const isDone = step.status === "approved" || step.status === "skipped";
            return (
              <div key={step.stepId} className="flex flex-col items-center gap-1 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isCurrent ? "bg-primary text-white ring-4 ring-primary/20 scale-110" :
                  isDone ? "bg-green-500 text-white" :
                  step.status === "cancelled" ? "bg-neutral-200 text-neutral-400" :
                  step.status === "failed" ? "bg-red-400 text-white" :
                  "bg-neutral-100 text-neutral-400"
                }`}>
                  {isDone ? "\u2713" : isCurrent ? "\u25CF" : `${i + 1}`}
                </div>
                <span className={`text-[10px] text-center leading-tight max-w-16 ${
                  isCurrent ? "text-primary font-semibold" : "text-neutral-400"
                }`}>
                  {step.label.replace(/[\u89c4\u8303\u8bbe\u8ba1\u7cfb\u7edf\u5e94\u7528]/g, "").substring(0, 4)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Step Card */}
      {currentStep && !isComplete && (
        <div className="bg-white rounded-2xl border-2 border-primary/20 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  Step {currentIndex + 1} of {totalSteps}
                </span>
                <span className="text-xs text-neutral-400">
                  Attempt {currentStep.attempts + 1}
                </span>
              </div>
              <h2 className="text-lg font-bold text-neutral-900">{currentStep.label}</h2>
              <p className="text-sm text-neutral-500 mt-0.5">
                {getStepDescription(currentStep.stepId)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-400">Estimated cost</div>
              <div className="text-lg font-bold text-amber-600">
                ${currentStep.estimatedCost.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Image Area (placeholder) */}
          <div className="bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-200 h-48 flex items-center justify-center mb-4">
            {currentStep.status === "reviewing" || currentStep.status === "approved" ? (
              <div className="text-center">
                <ImageIcon className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-400">Placeholder: generated image will appear here</p>
                <p className="text-xs text-neutral-300 mt-1">(Tongyi Wanxiang integration: future)</p>
              </div>
            ) : currentStep.status === "generating" ? (
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-2" />
                <p className="text-sm text-neutral-500">Generating...</p>
              </div>
            ) : (
              <div className="text-center">
                <Wand2 className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-400">Click "Generate" to start</p>
              </div>
            )}
          </div>

          {/* Status & Cost info */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-neutral-50 rounded-lg p-3">
              <div className="text-xs text-neutral-400">Status</div>
              <div className="text-sm font-semibold text-neutral-800 mt-0.5">
                {getStatusLabel(currentStep.status)}
              </div>
            </div>
            <div className="bg-neutral-50 rounded-lg p-3">
              <div className="text-xs text-neutral-400">Actual cost</div>
              <div className="text-sm font-semibold text-neutral-800 mt-0.5">
                {currentStep.actualCost !== null
                  ? `$${currentStep.actualCost.toFixed(2)}`
                  : "\u2014"}
              </div>
            </div>
          </div>

          {/* Approval Note (shown during reviewing) */}
          {currentStep.status === "reviewing" && (
            <div className="mb-4">
              <label className="text-xs font-medium text-neutral-500 mb-1 block">
                Approval note (optional)
              </label>
              <textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder='e.g. "\u4e3b\u5f62\u8c61\u6ee1\u610f\uff0c\u4e09\u89c6\u56fe\u4fdd\u6301\u6bd4\u4f8b"'
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          )}

          {/* Skip Reason (shown during reviewing) */}
          {currentStep.status === "reviewing" && (
            <div className="mb-4">
              <label className="text-xs font-medium text-neutral-500 mb-1 block">
                Skip reason (if skipping)
              </label>
              <input
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="Why skip this step?"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {currentStep.status === "pending" && (
              <button
                onClick={() => doAction("start_generating")}
                disabled={actionLoading !== null}
                className="flex-1 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === "start_generating" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                Generate
              </button>
            )}

            {currentStep.status === "generating" && (
              <button
                disabled
                className="flex-1 px-6 py-3 bg-neutral-200 text-neutral-500 rounded-xl flex items-center justify-center gap-2"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </button>
            )}

            {currentStep.status === "reviewing" && (
              <>
                <button
                  onClick={() => doAction("approve")}
                  disabled={actionLoading !== null}
                  className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading === "approve" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Approve & Next
                </button>
                <button
                  onClick={() => doAction("retry")}
                  disabled={actionLoading !== null}
                  className="px-4 py-3 border border-neutral-200 text-neutral-600 font-medium rounded-xl hover:bg-neutral-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={() => doAction("skip", currentStep.stepId)}
                  disabled={actionLoading !== null}
                  className="px-4 py-3 border border-neutral-200 text-neutral-500 rounded-xl hover:bg-neutral-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
              </>
            )}

            {currentStep.status === "failed" && (
              <>
                <button
                  onClick={() => doAction("retry")}
                  disabled={actionLoading !== null}
                  className="flex-1 px-6 py-3 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={() => doAction("skip", currentStep.stepId)}
                  disabled={actionLoading !== null}
                  className="px-4 py-3 border border-neutral-200 text-neutral-500 rounded-xl hover:bg-neutral-50 transition-all flex items-center justify-center gap-2"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
              </>
            )}
          </div>

          {/* Cancel session */}
          {session.status === "in_progress" && (
            <button
              onClick={() => doAction("cancel")}
              disabled={actionLoading !== null}
              className="mt-4 w-full px-4 py-2 border border-red-200 text-red-500 text-sm font-medium rounded-xl hover:bg-red-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel entire Sandbox
            </button>
          )}
        </div>
      )}

      {/* Completed State */}
      {isComplete && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            session.status === "completed" ? "bg-green-50" : "bg-neutral-100"
          }`}>
            {session.status === "completed" ? (
              <Check className="w-8 h-8 text-green-500" />
            ) : (
              <X className="w-8 h-8 text-neutral-400" />
            )}
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">
            {session.status === "completed" ? "All steps completed" : "Session cancelled"}
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            {session.status === "completed"
              ? `${summary?.approvedSteps ?? 0} approved, ${summary?.skippedSteps ?? 0} skipped`
              : "The IP generation sandbox has been cancelled"}
          </p>

          {/* Cost summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="text-xs text-neutral-400">Total cost</div>
              <div className="text-lg font-bold text-neutral-900">${session.totalActualCost.toFixed(2)}</div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="text-xs text-neutral-400">Remaining</div>
              <div className="text-lg font-bold text-green-600">${session.balanceCurrent.toFixed(2)}</div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="text-xs text-neutral-400">Steps done</div>
              <div className="text-lg font-bold text-neutral-900">{completedCount}/{totalSteps}</div>
            </div>
          </div>

          {/* All steps overview */}
          <div className="text-left space-y-1.5 mb-6">
            {session.steps.map((step) => (
              <div key={step.stepId} className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                step.status === "approved" ? "bg-green-50" :
                step.status === "skipped" ? "bg-neutral-50" : "bg-neutral-50"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{STATUS_ICONS[step.status]}</span>
                  <span className={`text-sm ${step.status === "approved" ? "text-green-800 font-medium" : "text-neutral-600"}`}>
                    {step.label}
                  </span>
                  {step.approvalNote && (
                    <span className="text-xs text-neutral-400 italic ml-2">"{step.approvalNote}"</span>
                  )}
                </div>
                <span className="text-xs text-neutral-400">
                  {step.actualCost !== null ? `$${step.actualCost.toFixed(2)}` : "$0.00"}
                </span>
              </div>
            ))}
          </div>

          <Link
            href={`/admin/projects/${session.projectId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all"
          >
            <ArrowRight className="w-4 h-4" />
            Back to project
          </Link>
        </div>
      )}

      {/* No actionable step (but not completed) */}
      {!currentStep && !isComplete && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-neutral-600">No actionable step available</p>
          <p className="text-xs text-neutral-400 mt-1">Some dependencies may need to be resolved first</p>
        </div>
      )}
    </div>
  );
}

// ========== Helpers ==========

function getStepDescription(stepId: string): string {
  const map: Record<string, string> = {
    "mascot-main": "Generate the primary mascot full-body front view",
    "mascot-three-view": "Front, side, and back views for structural consistency",
    "mascot-colors": "Define standard colors, secondary colors, and shadow colors",
    "mascot-expression": "8-12 basic expressions to build emotional vocabulary",
    "mascot-pose": "6-8 basic poses: waving, pointing, thumbs-up, etc.",
    "mascot-scene": "Character in brand contexts: packaging, store, social media",
    "mascot-packaging": "IP application on product packaging examples",
    "mascot-social": "Social media avatar, cover, sticker set applications",
    "existing-asset-sort": "Organize and catalog existing IP assets",
    "existing-usage-spec": "Build usage specs: safe zone, min size, background control",
    "existing-scene-extension": "Extend existing IP to new application scenarios",
    "existing-packaging": "Layout existing IP on packaging (scale/move only, no redraw)",
    "mascot-direction": "Generate a direction draft for brand approval",
    "mascot-main-lite": "Primary character design (lightweight version)",
    "mascot-expression-lite": "4-6 basic expressions for social media use",
  };
  return map[stepId] || "";
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Waiting to start",
    generating: "Generating...",
    reviewing: "Ready for review",
    approved: "Approved",
    skipped: "Skipped",
    failed: "Generation failed",
    cancelled: "Cancelled",
  };
  return map[status] || status;
}
