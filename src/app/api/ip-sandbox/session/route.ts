/**
 * IP Sandbox Session API
 *
 * POST /api/ip-sandbox/session — Create a new sandbox session from a plan
 * GET  /api/ip-sandbox/session?id=xxx — Get session status
 * PATCH /api/ip-sandbox/session — Advance session (approve/skip/retry/cancel)
 */

import { NextRequest, NextResponse } from "next/server";
import { getBalance, getOrCreateAccount } from "@/lib/billing/balance";
import {
  createSession,
  approveStep,
  skipStep,
  retryStep,
  cancelSession,
  startGenerating,
  completeGeneration,
  failGeneration,
  getSessionSummary,
} from "@/lib/ip-sandbox/session";
import {
  saveSandboxSession,
  loadSandboxSession,
} from "@/lib/ip-sandbox/memory";
import { generateStepImage } from "@/lib/ip-sandbox/image-generator";
import type { IPSandboxSession } from "@/lib/ip-sandbox/types";

// ========== POST: Create Session ==========

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, accountId, plan } = body;

    if (!projectId || !accountId || !plan) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, accountId, plan" },
        { status: 400 }
      );
    }

    // Get account balance
    let balance = await getBalance(accountId);
    if (!balance) {
      // Auto-create account with default credits
      balance = await getOrCreateAccount(accountId, "default", 100000);
    }

    // Create session
    const session = createSession({
      projectId,
      accountId,
      plan,
      initialBalance: balance.remainingCredits,
    });

    // Skip creating if not_needed
    if (plan.mode === "not_needed") {
      return NextResponse.json({
        session: null,
        message: "No IP assets needed for this brand",
        summary: null,
      });
    }

    // Save
    await saveSandboxSession(session);

    return NextResponse.json({
      session,
      summary: getSessionSummary(session),
    });
  } catch (error) {
    console.error("Create sandbox session error:", error);
    return NextResponse.json(
      { error: "Failed to create sandbox session" },
      { status: 500 }
    );
  }
}

// ========== GET: Get Session ==========

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const session = await loadSandboxSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      session,
      summary: getSessionSummary(session),
    });
  } catch (error) {
    console.error("Get sandbox session error:", error);
    return NextResponse.json(
      { error: "Failed to load session" },
      { status: 500 }
    );
  }
}

// ========== PATCH: Advance Session ==========

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, action, stepId, note } = body;

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, action" },
        { status: 400 }
      );
    }

    const session = await loadSandboxSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    let result: {
      step?: any;
      nextStep?: any;
      error?: string;
    } = {};

    switch (action) {
      case "start_generating": {
        if (!stepId) {
          return NextResponse.json(
            { error: "Missing stepId" },
            { status: 400 }
          );
        }
        const step = startGenerating(session, stepId);
        if (!step) {
          return NextResponse.json(
            { error: "Step not found or not in pending state" },
            { status: 400 }
          );
        }
        // Placeholder: simulate generation immediately
        const genResult = await generateStepImage({
          step,
          brandProfile: body.brandProfile,
          mascotProfile: body.mascotProfile,
          promptSet: body.promptSet,
        });
        completeGeneration(session, stepId, genResult.actualCost, genResult.imageUrl);
        result = { step: session.steps.find((s) => s.stepId === stepId) };
        break;
      }

      case "approve": {
        if (!stepId) {
          return NextResponse.json(
            { error: "Missing stepId" },
            { status: 400 }
          );
        }
        const approveResult = approveStep(session, stepId, note);
        if (!approveResult.step) {
          return NextResponse.json(
            { error: "Step not found or not in reviewable state" },
            { status: 400 }
          );
        }
        result = {
          step: approveResult.step,
          nextStep: approveResult.nextStep,
        };
        break;
      }

      case "skip": {
        if (!stepId) {
          return NextResponse.json(
            { error: "Missing stepId" },
            { status: 400 }
          );
        }
        const skipResult = skipStep(session, stepId, note);
        if (!skipResult.step) {
          return NextResponse.json(
            { error: "Step not found or not skippable" },
            { status: 400 }
          );
        }
        result = {
          step: skipResult.step,
          nextStep: skipResult.nextStep,
        };
        break;
      }

      case "retry": {
        if (!stepId) {
          return NextResponse.json(
            { error: "Missing stepId" },
            { status: 400 }
          );
        }
        const retried = retryStep(session, stepId);
        if (!retried) {
          return NextResponse.json(
            { error: "Step not found or not retryable" },
            { status: 400 }
          );
        }
        // Re-simulate generation
        const retryResult = await generateStepImage({
          step: retried,
          brandProfile: body.brandProfile,
          mascotProfile: body.mascotProfile,
          promptSet: body.promptSet,
        });
        completeGeneration(session, stepId, retryResult.actualCost, retryResult.imageUrl);
        result = { step: session.steps.find((s) => s.stepId === stepId) };
        break;
      }

      case "cancel": {
        cancelSession(session);
        result = { step: undefined, nextStep: undefined };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Save session changes
    await saveSandboxSession(session);

    return NextResponse.json({
      session,
      summary: getSessionSummary(session),
      ...result,
    });
  } catch (error) {
    console.error("Patch sandbox session error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}
