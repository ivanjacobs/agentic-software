/**
 * TaskPlannerDisplay.tsx
 * ======================
 *
 * Frontend component for the Task Planning Copilot shared state example.
 * This demonstrates bidirectional state synchronization between the
 * Pydantic AI agent and the React frontend via the AG-UI protocol.
 *
 * ## How Shared State Works in the Frontend
 * -----------------------------------------
 * 1. **useCoAgent Hook**: Connects to the agent's shared state
 *    - `state`: Current state from the agent (read-only view)
 *    - `setState`: Function to update state (sends changes back to agent)
 *
 * 2. **State Updates Flow**:
 *    - Agent calls display_plan() → StateSnapshotEvent → Frontend receives
 *    - User changes dropdown → setState() → State sent with next message
 *
 * 3. **TypeScript Interface**: Must match the Python Pydantic model exactly!
 *    - Field names must be identical (snake_case)
 *    - Types must be compatible
 *
 * ## Components
 * -------------
 * - TaskPlannerDisplay: Main component with useCoAgent
 * - TaskCard: Individual task display with expandable subtasks
 * - DropdownSelect: Generic dropdown component for enum fields
 * - FilterBar: Task filtering by phase and priority
 * - ProgressBar: Visual progress indicator
 * - SubtaskList: Expandable subtask management
 *
 * Based on: https://dojo.ag-ui.com/pydantic-ai/feature/shared_state
 * Similar to AgentStateDisplay.tsx but for task planning
 */

import React, { useState, useCallback } from "react";
import { useCoAgent } from "@copilotkit/react-core";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================
// These types MUST match the Python Pydantic models in task_planner.py

/**
 * Complexity levels for tasks.
 * Maps to: backend/task_planner.py::ComplexityLevel
 */
type ComplexityLevel =
  | "Trivial"
  | "Simple"
  | "Moderate"
  | "Complex"
  | "Highly Complex";

/**
 * Priority levels for tasks.
 * Maps to: backend/task_planner.py::Priority
 */
type Priority = "Critical" | "High" | "Medium" | "Low" | "Backlog";

/**
 * Project phases.
 * Maps to: backend/task_planner.py::Phase
 */
type Phase =
  | "Discovery"
  | "Planning"
  | "Development"
  | "Testing"
  | "Deployment"
  | "Maintenance";

/**
 * Task categories (multiple can be selected).
 * Maps to: backend/task_planner.py::TaskCategory
 */
type TaskCategory =
  | "Research"
  | "Design"
  | "Coding"
  | "Documentation"
  | "Review"
  | "Meeting"
  | "Infrastructure"
  | "Security";

/**
 * Status of subtasks.
 * Maps to: backend/task_planner.py::SubtaskStatus
 */
type SubtaskStatus =
  | "Not Started"
  | "In Progress"
  | "Blocked"
  | "Completed"
  | "Cancelled";

/**
 * A subtask within a task.
 * Maps to: backend/task_planner.py::Subtask
 */
interface Subtask {
  id: string;
  title: string;
  description: string;
  status: SubtaskStatus;
  estimated_hours: number;
  assignee: string;
}

/**
 * A task in the plan.
 * Maps to: backend/task_planner.py::Task
 */
interface Task {
  id: string;
  title: string;
  description: string;
  complexity: ComplexityLevel;
  priority: Priority;
  phase: Phase;
  categories: TaskCategory[];
  subtasks: Subtask[];
  dependencies: string[];
  estimated_hours: number;
  notes: string;
}

/**
 * The complete task plan state.
 * Maps to: backend/task_planner.py::TaskPlanSnapshot
 *
 * This is the shared state that syncs between agent and frontend.
 */
interface TaskPlanState {
  project_name: string;
  project_description: string;
  current_phase: Phase;
  tasks: Task[];
  selected_priority_filter: Priority | null;
  selected_phase_filter: Phase | null;
  last_updated: string;
  planning_complete: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** All available priority values for dropdowns */
const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low", "Backlog"];

/** All available phases for dropdowns */
const PHASES: Phase[] = [
  "Discovery",
  "Planning",
  "Development",
  "Testing",
  "Deployment",
  "Maintenance",
];

/** All available complexity levels */
const COMPLEXITY_LEVELS: ComplexityLevel[] = [
  "Trivial",
  "Simple",
  "Moderate",
  "Complex",
  "Highly Complex",
];

/** All available subtask statuses */
const SUBTASK_STATUSES: SubtaskStatus[] = [
  "Not Started",
  "In Progress",
  "Blocked",
  "Completed",
  "Cancelled",
];

/** Color mappings for priority badges */
const PRIORITY_COLORS: Record<Priority, string> = {
  Critical: "bg-red-600 text-white",
  High: "bg-orange-500 text-white",
  Medium: "bg-yellow-500 text-black",
  Low: "bg-blue-500 text-white",
  Backlog: "bg-gray-500 text-white",
};

/** Color mappings for complexity badges */
const COMPLEXITY_COLORS: Record<ComplexityLevel, string> = {
  Trivial: "bg-green-600 text-white",
  Simple: "bg-green-500 text-white",
  Moderate: "bg-yellow-500 text-black",
  Complex: "bg-orange-500 text-white",
  "Highly Complex": "bg-red-600 text-white",
};

/** Color mappings for phase badges */
const PHASE_COLORS: Record<Phase, string> = {
  Discovery: "bg-purple-500 text-white",
  Planning: "bg-blue-500 text-white",
  Development: "bg-green-500 text-white",
  Testing: "bg-yellow-500 text-black",
  Deployment: "bg-orange-500 text-white",
  Maintenance: "bg-gray-500 text-white",
};

/** Icons for subtask statuses */
const STATUS_ICONS: Record<SubtaskStatus, string> = {
  "Not Started": "\u25CB", // Circle
  "In Progress": "\u25D4", // Half circle
  Blocked: "\u26D4",       // No entry
  Completed: "\u2713",     // Checkmark
  Cancelled: "\u2717",     // X mark
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * DropdownSelect - A reusable dropdown component for selecting enum values.
 *
 * This component renders a native select element styled consistently.
 * When the user changes the selection, it calls the onChange callback.
 *
 * @param label - Display label for the dropdown
 * @param value - Currently selected value
 * @param options - Array of available options
 * @param onChange - Callback when selection changes
 * @param className - Optional additional CSS classes
 */
interface DropdownSelectProps<T extends string> {
  label: string;
  value: T | null;
  options: T[];
  onChange: (value: T | null) => void;
  allowNull?: boolean;
  nullLabel?: string;
  className?: string;
}

function DropdownSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  allowNull = false,
  nullLabel = "All",
  className = "",
}: DropdownSelectProps<T>): React.ReactElement {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <select
        value={value || ""}
        onChange={(e) => {
          const newValue = e.target.value;
          onChange(newValue === "" ? null : (newValue as T));
        }}
        className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors cursor-pointer"
      >
        {allowNull && <option value="">{nullLabel}</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * ProgressBar - Visual progress indicator.
 *
 * Shows completion percentage with color coding:
 * - 0-30%: Red
 * - 30-70%: Yellow
 * - 70-100%: Green
 *
 * @param completed - Number of completed items
 * @param total - Total number of items
 * @param label - Optional label to display
 */
interface ProgressBarProps {
  completed: number;
  total: number;
  label?: string;
}

function ProgressBar({
  completed,
  total,
  label,
}: ProgressBarProps): React.ReactElement {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Determine color based on percentage
  let barColor = "bg-red-500";
  if (percentage >= 70) barColor = "bg-green-500";
  else if (percentage >= 30) barColor = "bg-yellow-500";

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{label}</span>
          <span>
            {completed}/{total} ({percentage}%)
          </span>
        </div>
      )}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Badge - A small label component for displaying status/category.
 *
 * @param text - Text to display
 * @param colorClass - Tailwind color classes
 */
interface BadgeProps {
  text: string;
  colorClass: string;
}

function Badge({ text, colorClass }: BadgeProps): React.ReactElement {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${colorClass}`}
    >
      {text}
    </span>
  );
}

/**
 * SubtaskList - Expandable list of subtasks within a task.
 *
 * Features:
 * - Collapsible/expandable UI
 * - Status dropdown for each subtask
 * - Progress tracking
 *
 * @param subtasks - Array of subtasks
 * @param onStatusChange - Callback when subtask status changes
 */
interface SubtaskListProps {
  subtasks: Subtask[];
  onStatusChange: (subtaskId: string, newStatus: SubtaskStatus) => void;
}

function SubtaskList({
  subtasks,
  onStatusChange,
}: SubtaskListProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  if (subtasks.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic">No subtasks defined</div>
    );
  }

  const completedCount = subtasks.filter(
    (s) => s.status === "Completed"
  ).length;

  return (
    <div className="mt-2">
      {/* Header with expand/collapse toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors w-full"
      >
        <span className="text-xs">{isExpanded ? "\u25BC" : "\u25B6"}</span>
        <span>
          Subtasks ({completedCount}/{subtasks.length})
        </span>
        <ProgressBar
          completed={completedCount}
          total={subtasks.length}
        />
      </button>

      {/* Expandable subtask list */}
      {isExpanded && (
        <div className="mt-2 ml-4 space-y-2">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg"
            >
              {/* Status icon */}
              <span className="text-lg">{STATUS_ICONS[subtask.status]}</span>

              {/* Subtask title and description */}
              <div className="flex-1">
                <div
                  className={`text-sm ${
                    subtask.status === "Completed"
                      ? "line-through text-gray-500"
                      : "text-white"
                  }`}
                >
                  {subtask.title}
                </div>
                {subtask.description && (
                  <div className="text-xs text-gray-400">
                    {subtask.description}
                  </div>
                )}
              </div>

              {/* Time estimate */}
              <span className="text-xs text-gray-400">
                {subtask.estimated_hours}h
              </span>

              {/* Status dropdown */}
              <select
                value={subtask.status}
                onChange={(e) =>
                  onStatusChange(subtask.id, e.target.value as SubtaskStatus)
                }
                className="bg-gray-700 text-xs text-white rounded px-2 py-1 border border-gray-600"
              >
                {SUBTASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * TaskCard - Display component for a single task.
 *
 * Features:
 * - Shows task metadata (title, description, badges)
 * - Dropdown menus for priority, phase, complexity
 * - Expandable subtask list
 * - Dependencies display
 *
 * @param task - The task data
 * @param allTasks - All tasks (for dependency lookup)
 * @param onUpdate - Callback when task is updated
 */
interface TaskCardProps {
  task: Task;
  allTasks: Task[];
  onUpdate: (updatedTask: Task) => void;
}

function TaskCard({
  task,
  allTasks,
  onUpdate,
}: TaskCardProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle dropdown changes
  const handlePriorityChange = (newPriority: Priority | null) => {
    if (newPriority) {
      onUpdate({ ...task, priority: newPriority });
    }
  };

  const handlePhaseChange = (newPhase: Phase | null) => {
    if (newPhase) {
      onUpdate({ ...task, phase: newPhase });
    }
  };

  const handleComplexityChange = (newComplexity: ComplexityLevel | null) => {
    if (newComplexity) {
      onUpdate({ ...task, complexity: newComplexity });
    }
  };

  const handleSubtaskStatusChange = (
    subtaskId: string,
    newStatus: SubtaskStatus
  ) => {
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, status: newStatus } : st
    );
    onUpdate({ ...task, subtasks: updatedSubtasks });
  };

  // Find dependency task names
  const dependencyNames = task.dependencies
    .map((depId) => allTasks.find((t) => t.id === depId)?.title)
    .filter(Boolean);

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors">
      {/* Header: Title + Badges */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <h3 className="text-white font-semibold text-lg">{task.title}</h3>
          {task.description && (
            <p className="text-gray-400 text-sm mt-1">{task.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge text={task.priority} colorClass={PRIORITY_COLORS[task.priority]} />
          <Badge text={task.phase} colorClass={PHASE_COLORS[task.phase]} />
        </div>
      </div>

      {/* Dropdown Controls */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <DropdownSelect
          label="Priority"
          value={task.priority}
          options={PRIORITIES}
          onChange={handlePriorityChange}
        />
        <DropdownSelect
          label="Phase"
          value={task.phase}
          options={PHASES}
          onChange={handlePhaseChange}
        />
        <DropdownSelect
          label="Complexity"
          value={task.complexity}
          options={COMPLEXITY_LEVELS}
          onChange={handleComplexityChange}
        />
      </div>

      {/* Categories */}
      {task.categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.categories.map((cat) => (
            <span
              key={cat}
              className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Time Estimate */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
        <span>{"\u23F1"}</span>
        <span>Estimated: {task.estimated_hours} hours</span>
      </div>

      {/* Dependencies */}
      {dependencyNames.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <span>{"\u{1F517}"}</span>
          <span>Depends on: {dependencyNames.join(", ")}</span>
        </div>
      )}

      {/* Subtasks */}
      <SubtaskList
        subtasks={task.subtasks}
        onStatusChange={handleSubtaskStatusChange}
      />

      {/* Expand/Collapse Notes */}
      {task.notes && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-gray-400 hover:text-white"
          >
            {isExpanded ? "Hide notes \u25B2" : "Show notes \u25BC"}
          </button>
          {isExpanded && (
            <p className="mt-2 text-sm text-gray-300 bg-gray-900/50 p-2 rounded">
              {task.notes}
            </p>
          )}
        </div>
      )}

      {/* Task ID for debugging */}
      <div className="mt-2 text-xs text-gray-600 font-mono">ID: {task.id}</div>
    </div>
  );
}

/**
 * FilterBar - Controls for filtering the task list.
 *
 * @param priorityFilter - Currently selected priority filter
 * @param phaseFilter - Currently selected phase filter
 * @param onPriorityChange - Callback when priority filter changes
 * @param onPhaseChange - Callback when phase filter changes
 */
interface FilterBarProps {
  priorityFilter: Priority | null;
  phaseFilter: Phase | null;
  onPriorityChange: (value: Priority | null) => void;
  onPhaseChange: (value: Phase | null) => void;
}

function FilterBar({
  priorityFilter,
  phaseFilter,
  onPriorityChange,
  onPhaseChange,
}: FilterBarProps): React.ReactElement {
  return (
    <div className="flex gap-4 p-3 bg-gray-800/30 rounded-lg mb-4">
      <DropdownSelect
        label="Filter by Priority"
        value={priorityFilter}
        options={PRIORITIES}
        onChange={onPriorityChange}
        allowNull
        nullLabel="All Priorities"
      />
      <DropdownSelect
        label="Filter by Phase"
        value={phaseFilter}
        options={PHASES}
        onChange={onPhaseChange}
        allowNull
        nullLabel="All Phases"
      />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * TaskPlannerDisplay - Main component for the task planning shared state UI.
 *
 * This component demonstrates the AG-UI protocol's shared state feature:
 *
 * 1. **useCoAgent Hook**:
 *    - Connects to the "pydantic-agent" agent
 *    - Receives state updates via StateSnapshotEvent
 *    - Can modify state via setState (changes sync back to agent)
 *
 * 2. **State Synchronization**:
 *    - Agent calls display_plan() → StateSnapshotEvent emitted
 *    - Frontend receives snapshot → state updated → UI re-renders
 *    - User changes dropdown → setState() called → state updated
 *    - Next message includes updated state
 *
 * 3. **UI Features**:
 *    - Project overview with name and description
 *    - Filter bar for priority and phase
 *    - Task cards with expandable subtasks
 *    - Dropdown menus for all enum fields
 *    - Progress tracking
 *
 * Usage:
 *   <CopilotKit runtimeUrl="/api/copilotkit" agent="pydantic-agent">
 *     <TaskPlannerDisplay />
 *   </CopilotKit>
 */
export function TaskPlannerDisplay(): React.ReactElement {
  // =========================================================================
  // SHARED STATE CONNECTION
  // =========================================================================
  // The useCoAgent hook is the key to AG-UI shared state:
  // - `state`: The current state received from the agent
  // - `setState`: Function to update state (syncs back to agent)
  // - `name`: Must match the agent name in the backend

  const { state, setState } = useCoAgent<TaskPlanState>({
    name: "pydantic-agent", // Must match agent configuration
    initialState: {
      project_name: "",
      project_description: "",
      current_phase: "Discovery",
      tasks: [],
      selected_priority_filter: null,
      selected_phase_filter: null,
      last_updated: "",
      planning_complete: false,
    },
  });

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  /**
   * Handle changes to filter dropdowns.
   * Updates the state which will sync with the agent.
   */
  const handlePriorityFilterChange = useCallback(
    (value: Priority | null) => {
      setState((prev) => ({
        ...prev,
        selected_priority_filter: value,
      }));
    },
    [setState]
  );

  const handlePhaseFilterChange = useCallback(
    (value: Phase | null) => {
      setState((prev) => ({
        ...prev,
        selected_phase_filter: value,
      }));
    },
    [setState]
  );

  /**
   * Handle updates to individual tasks.
   * Called when user changes task properties via dropdowns.
   */
  const handleTaskUpdate = useCallback(
    (updatedTask: Task) => {
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === updatedTask.id ? updatedTask : t
        ),
        last_updated: new Date().toISOString(),
      }));
    },
    [setState]
  );

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================

  // Apply filters to task list
  const filteredTasks = state?.tasks?.filter((task) => {
    if (
      state.selected_priority_filter &&
      task.priority !== state.selected_priority_filter
    ) {
      return false;
    }
    if (
      state.selected_phase_filter &&
      task.phase !== state.selected_phase_filter
    ) {
      return false;
    }
    return true;
  }) || [];

  // Calculate overall progress
  const totalSubtasks = state?.tasks?.reduce(
    (sum, task) => sum + task.subtasks.length,
    0
  ) || 0;
  const completedSubtasks = state?.tasks?.reduce(
    (sum, task) =>
      sum + task.subtasks.filter((st) => st.status === "Completed").length,
    0
  ) || 0;

  // Calculate total estimated hours
  const totalHours = state?.tasks?.reduce(
    (sum, task) => sum + task.estimated_hours,
    0
  ) || 0;

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              state?.planning_complete
                ? "bg-green-500"
                : "bg-yellow-500 animate-pulse"
            }`}
          />
          Task Planner
          {state?.planning_complete && (
            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded ml-2">
              COMPLETE
            </span>
          )}
        </h2>

        {/* Last Updated */}
        {state?.last_updated && (
          <span className="text-xs text-gray-500">
            Updated: {new Date(state.last_updated).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Project Info */}
      {state?.project_name && (
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
          <h3 className="text-white font-medium">{state.project_name}</h3>
          {state.project_description && (
            <p className="text-sm text-gray-400 mt-1">
              {state.project_description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>Phase: {state.current_phase}</span>
            <span>Tasks: {state.tasks?.length || 0}</span>
            <span>Est. Hours: {totalHours}</span>
          </div>
        </div>
      )}

      {/* Overall Progress */}
      {totalSubtasks > 0 && (
        <div className="mb-4">
          <ProgressBar
            completed={completedSubtasks}
            total={totalSubtasks}
            label="Overall Progress"
          />
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        priorityFilter={state?.selected_priority_filter || null}
        phaseFilter={state?.selected_phase_filter || null}
        onPriorityChange={handlePriorityFilterChange}
        onPhaseChange={handlePhaseFilterChange}
      />

      {/* Task List */}
      {filteredTasks.length > 0 ? (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              allTasks={state?.tasks || []}
              onUpdate={handleTaskUpdate}
            />
          ))}
        </div>
      ) : state?.tasks?.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 text-4xl mb-2">{"\u{1F4DD}"}</div>
          <p className="text-gray-400">No tasks yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Ask the assistant to help plan your project
          </p>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400">
          No tasks match the current filters
        </div>
      )}

      {/* How to Use */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Try saying:</h3>
        <div className="space-y-1 text-xs text-gray-500">
          <div className="bg-gray-700/50 p-2 rounded font-mono">
            "Plan a website redesign project"
          </div>
          <div className="bg-gray-700/50 p-2 rounded font-mono">
            "Help me break down building a mobile app"
          </div>
          <div className="bg-gray-700/50 p-2 rounded font-mono">
            "Create a plan for migrating to cloud infrastructure"
          </div>
        </div>
      </div>

      {/* AG-UI Info */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-400">
            About Shared State
          </summary>
          <div className="mt-2 space-y-1">
            <p>
              This panel demonstrates AG-UI's shared state feature. When the
              agent calls <code className="text-blue-400">display_plan()</code>,
              it emits a StateSnapshotEvent that updates this UI.
            </p>
            <p className="mt-2">
              Changes you make in the dropdowns above are synced back to the
              agent via <code className="text-blue-400">setState()</code>.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

export default TaskPlannerDisplay;
