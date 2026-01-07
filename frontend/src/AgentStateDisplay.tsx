import React from "react";
import { useCoAgent } from "@copilotkit/react-core";

// Type definitions
interface PendingAction {
  id: string;
  action_type: string;
  description: string;
  details?: Record<string, unknown>;
}

interface AgentState {
  message_count: number;
  last_topic: string;
  pending_actions: PendingAction[];
  approved_action_ids: string[];
  rejected_action_ids: string[];
  awaiting_approval: boolean;
  is_processing: boolean;
  execution_results: string[];
  error_message: string | null;
}

interface StateItemProps {
  label: string;
  value: string | number | object;
}

interface ActionCardProps {
  action: PendingAction;
  isApproved: boolean;
  isRejected: boolean;
  onApprove: () => void;
  onReject: () => void;
}

interface ToolBadgeProps {
  name: string;
  type?: "normal" | "hitl";
}

/**
 * Component that displays the shared agent state with HITL approval UI
 * This demonstrates AG-UI's state synchronization and Human-in-the-Loop features
 *
 * Based on: https://docs.copilotkit.ai/pydantic-ai/human-in-the-loop
 */
export function AgentStateDisplay(): React.ReactElement {
  // Connect to the agent's shared state with setState for HITL
  const { state, setState } = useCoAgent<AgentState>({
    name: "pydantic-agent",
    initialState: {
      message_count: 0,
      last_topic: "",
      pending_actions: [],
      approved_action_ids: [],
      rejected_action_ids: [],
      awaiting_approval: false,
      is_processing: false,
      execution_results: [],
      error_message: null,
    },
  });

  // Handle approving an action
  const handleApprove = (actionId: string): void => {
    setState((prev) => ({
      ...prev,
      approved_action_ids: [...(prev.approved_action_ids || []), actionId],
      rejected_action_ids: (prev.rejected_action_ids || []).filter(
        (id) => id !== actionId
      ),
    }));
  };

  // Handle rejecting an action
  const handleReject = (actionId: string): void => {
    setState((prev) => ({
      ...prev,
      rejected_action_ids: [...(prev.rejected_action_ids || []), actionId],
      approved_action_ids: (prev.approved_action_ids || []).filter(
        (id) => id !== actionId
      ),
    }));
  };

  const pendingActions = state?.pending_actions || [];
  const approvedIds = state?.approved_action_ids || [];
  const rejectedIds = state?.rejected_action_ids || [];
  const awaitingApproval = state?.awaiting_approval || false;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            awaitingApproval
              ? "bg-yellow-500 animate-pulse"
              : "bg-green-500 animate-pulse"
          }`}
        ></span>
        Agent State
        {awaitingApproval && (
          <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-0.5 rounded ml-2">
            AWAITING APPROVAL
          </span>
        )}
      </h2>

      {/* Basic State Info */}
      <div className="space-y-3">
        <StateItem label="Message Count" value={state?.message_count ?? 0} />
        <StateItem label="Last Topic" value={state?.last_topic || "None"} />
      </div>

      {/* HITL Pending Actions */}
      {pendingActions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Pending Actions ({pendingActions.length})
          </h3>

          <div className="space-y-3">
            {pendingActions.map((action) => {
              const isApproved = approvedIds.includes(action.id);
              const isRejected = rejectedIds.includes(action.id);

              return (
                <ActionCard
                  key={action.id}
                  action={action}
                  isApproved={isApproved}
                  isRejected={isRejected}
                  onApprove={() => handleApprove(action.id)}
                  onReject={() => handleReject(action.id)}
                />
              );
            })}
          </div>

          <p className="text-xs text-gray-500 mt-3 italic">
            Approve or reject actions, then ask the agent to execute approved
            actions.
          </p>
        </div>
      )}

      {/* Execution Results */}
      {state?.execution_results?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-green-400 mb-2">
            Executed Actions
          </h3>
          <div className="space-y-1">
            {state.execution_results.map((result, idx) => (
              <div key={idx} className="text-xs text-green-300 bg-green-900/30 p-2 rounded">
                {result}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {state?.error_message && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="text-xs text-red-400 bg-red-900/30 p-2 rounded">
            {state.error_message}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          HITL Workflow:
        </h3>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>1. Ask agent to perform sensitive action</li>
          <li>2. Review proposed action above</li>
          <li>3. Click Approve or Reject</li>
          <li>4. Tell agent to execute approved actions</li>
        </ul>
      </div>

      {/* Available Tools */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          Available Tools:
        </h3>
        <div className="flex flex-wrap gap-2">
          <ToolBadge name="propose_action" type="hitl" />
          <ToolBadge name="execute_approved_actions" type="hitl" />
          <ToolBadge name="check_approval_status" type="hitl" />
          <ToolBadge name="track_topic" type="normal" />
          <ToolBadge name="get_current_time" type="normal" />
        </div>
      </div>

      {/* Test Commands */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Try saying:</h3>
        <div className="space-y-1 text-xs text-gray-500">
          <div className="bg-gray-700/50 p-2 rounded font-mono">
            "Delete the file config.json"
          </div>
          <div className="bg-gray-700/50 p-2 rounded font-mono">
            "Send an email to bob@example.com"
          </div>
          <div className="bg-gray-700/50 p-2 rounded font-mono">
            "What time is it?"
          </div>
        </div>
      </div>
    </div>
  );
}

function StateItem({ label, value }: StateItemProps): React.ReactElement {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-mono bg-gray-700 px-2 py-1 rounded">
        {typeof value === "object" ? JSON.stringify(value) : String(value)}
      </span>
    </div>
  );
}

function ActionCard({ action, isApproved, isRejected, onApprove, onReject }: ActionCardProps): React.ReactElement {
  const getActionIcon = (type: string): string => {
    switch (type) {
      case "delete_file":
        return "\u{1F5D1}";
      case "send_email":
        return "\u{1F4E7}";
      case "execute_code":
        return "\u{26A1}";
      case "modify_settings":
        return "\u{2699}";
      default:
        return "\u{2753}";
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border ${
        isApproved
          ? "bg-green-900/30 border-green-600"
          : isRejected
          ? "bg-red-900/30 border-red-600"
          : "bg-yellow-900/20 border-yellow-600"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{getActionIcon(action.action_type)}</span>
            <span className="text-sm font-semibold text-white">
              {action.action_type}
            </span>
            <span className="text-xs text-gray-400 font-mono">
              [{action.id}]
            </span>
          </div>
          <p className="text-sm text-gray-300">{action.description}</p>
          {action.details && Object.keys(action.details).length > 0 && (
            <pre className="text-xs text-gray-400 mt-1 bg-gray-800 p-1 rounded overflow-x-auto">
              {JSON.stringify(action.details, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* Approval Buttons */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={onApprove}
          disabled={isApproved}
          className={`flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors ${
            isApproved
              ? "bg-green-600 text-white cursor-not-allowed"
              : "bg-green-700 hover:bg-green-600 text-white"
          }`}
        >
          {isApproved ? "\u2713 Approved" : "Approve"}
        </button>
        <button
          onClick={onReject}
          disabled={isRejected}
          className={`flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors ${
            isRejected
              ? "bg-red-600 text-white cursor-not-allowed"
              : "bg-red-700 hover:bg-red-600 text-white"
          }`}
        >
          {isRejected ? "\u2717 Rejected" : "Reject"}
        </button>
      </div>

      {/* Status Badge */}
      {(isApproved || isRejected) && (
        <div className="mt-2 text-center">
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              isApproved
                ? "bg-green-600 text-green-100"
                : "bg-red-600 text-red-100"
            }`}
          >
            {isApproved
              ? 'Say "execute approved actions" to proceed'
              : "Action rejected - ask agent for alternatives"}
          </span>
        </div>
      )}
    </div>
  );
}

function ToolBadge({ name, type = "normal" }: ToolBadgeProps): React.ReactElement {
  const colors =
    type === "hitl"
      ? "bg-yellow-900 text-yellow-300"
      : "bg-blue-900 text-blue-300";

  return (
    <span className={`text-xs ${colors} px-2 py-1 rounded`}>
      {name}
      {type === "hitl" && " \u{1F512}"}
    </span>
  );
}
