/**
 * App.tsx - Main Application Component
 * =====================================
 *
 * This is the root component for the AG-UI Protocol test application.
 * It demonstrates two key AG-UI features:
 *
 * 1. **Human-in-the-Loop (HITL)**: Action approval workflow
 * 2. **Shared State**: Bidirectional state synchronization for task planning
 *
 * ## Architecture Overview
 * ------------------------
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                         App.tsx                             │
 * │  ┌─────────────────────────────────────────────────────┐   │
 * │  │                   CopilotKit                         │   │
 * │  │   ┌─────────────────┐    ┌─────────────────────┐   │   │
 * │  │   │   Chat Panel    │    │    State Panel      │   │   │
 * │  │   │                 │    │                     │   │   │
 * │  │   │  CustomChat     │    │  AgentStateDisplay  │   │   │
 * │  │   │  - or -         │    │  - or -             │   │   │
 * │  │   │  TaskPlannerChat│    │  TaskPlannerDisplay │   │   │
 * │  │   └─────────────────┘    └─────────────────────┘   │   │
 * │  └─────────────────────────────────────────────────────┘   │
 * └─────────────────────────────────────────────────────────────┘
 *                           │
 *                           ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │              CopilotKit Runtime (Port 4000)                 │
 * └─────────────────────────────────────────────────────────────┘
 *                           │
 *                           ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │              Pydantic AI Backend (Port 8001)                │
 * │   - main.py: HITL demo with propose_action tool            │
 * │   - task_planner.py: Shared state with display_plan tool   │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Demo Modes
 * -------------
 *
 * 1. **HITL Demo** (main.py backend):
 *    - Demonstrates action approval workflow
 *    - Agent proposes sensitive actions
 *    - User approves/rejects in AgentStateDisplay
 *    - Agent executes approved actions
 *
 * 2. **Task Planner Demo** (task_planner.py backend):
 *    - Demonstrates shared state synchronization
 *    - Agent creates structured task plans
 *    - User can modify tasks via dropdowns
 *    - Changes sync bidirectionally
 *
 * ## Usage
 * --------
 * 1. Start the appropriate backend (main.py or task_planner.py)
 * 2. Start the frontend (npm start)
 * 3. Select the demo mode using the toggle
 * 4. Interact with the chat to see AG-UI features in action
 */

import React, { useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { AgentStateDisplay } from "./AgentStateDisplay";
import { CustomChat } from "./CustomChat";
import { TaskPlannerDisplay } from "./TaskPlannerDisplay";
import { TaskPlannerChat } from "./TaskPlannerChat";

/**
 * Available demo modes.
 * Each mode uses a different backend and showcases different AG-UI features.
 */
type DemoMode = "hitl" | "task-planner";

/**
 * DemoInfo - Information about each demo mode.
 */
interface DemoInfo {
  id: DemoMode;
  title: string;
  description: string;
  backendFile: string;
  features: string[];
}

/**
 * Demo mode configurations.
 */
const DEMOS: DemoInfo[] = [
  {
    id: "hitl",
    title: "Human-in-the-Loop",
    description: "Action approval workflow - agent proposes, user approves",
    backendFile: "main.py",
    features: [
      "propose_action tool",
      "State synchronization",
      "Approve/Reject workflow",
    ],
  },
  {
    id: "task-planner",
    title: "Task Planner (Shared State)",
    description: "Bidirectional state sync for sophisticated task planning",
    backendFile: "task_planner.py",
    features: [
      "display_plan tool",
      "Dropdown menus",
      "Progress tracking",
      "Dependencies",
    ],
  },
];

/**
 * DemoToggle - Switch between demo modes.
 *
 * @param currentMode - Currently selected mode
 * @param onModeChange - Callback when mode changes
 */
interface DemoToggleProps {
  currentMode: DemoMode;
  onModeChange: (mode: DemoMode) => void;
}

function DemoToggle({
  currentMode,
  onModeChange,
}: DemoToggleProps): React.ReactElement {
  return (
    <div className="flex gap-2">
      {DEMOS.map((demo) => (
        <button
          key={demo.id}
          onClick={() => onModeChange(demo.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            currentMode === demo.id
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          {demo.title}
        </button>
      ))}
    </div>
  );
}

/**
 * DemoInfoPanel - Display information about the current demo.
 *
 * @param demo - The demo information to display
 */
interface DemoInfoPanelProps {
  demo: DemoInfo;
}

function DemoInfoPanel({ demo }: DemoInfoPanelProps): React.ReactElement {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="font-semibold mb-2">{demo.title}</h3>
      <p className="text-sm text-gray-400 mb-3">{demo.description}</p>

      <div className="text-sm">
        <span className="text-gray-500">Backend: </span>
        <code className="text-green-400">{demo.backendFile}</code>
      </div>

      <div className="mt-3">
        <span className="text-xs text-gray-500 uppercase">Features:</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {demo.features.map((feature) => (
            <span
              key={feature}
              className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-700">
        <h4 className="text-xs text-gray-500 uppercase mb-2">Documentation</h4>
        <div className="flex gap-2 text-xs">
          <a
            href="https://ai.pydantic.dev/ui/ag-ui/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            Pydantic AI AG-UI
          </a>
          <a
            href="https://docs.copilotkit.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            CopilotKit
          </a>
          <a
            href="https://dojo.ag-ui.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            AG-UI Dojo
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * App - Main application component.
 *
 * Manages demo mode state and renders the appropriate chat and state panels
 * based on the selected mode.
 */
function App(): React.ReactElement {
  // Track which demo mode is active
  const [demoMode, setDemoMode] = useState<DemoMode>("task-planner");

  // Get the current demo info
  const currentDemo = DEMOS.find((d) => d.id === demoMode)!;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">AG-UI Protocol Test</h1>
            <DemoToggle currentMode={demoMode} onModeChange={setDemoMode} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-purple-600 px-2 py-1 rounded">
              {currentDemo.title}
            </span>
            <span className="text-sm text-gray-400">
              Pydantic AI + CopilotKit
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chat Panel */}
          <CopilotKit
            showDevConsole={false}
            runtimeUrl="/api/copilotkit"
            agent="pydantic-agent"
          >
            <div className="lg:col-span-2 h-[700px] bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              <div className="bg-blue-900/30 px-4 py-2 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-blue-300">
                  {demoMode === "hitl"
                    ? "HITL Chat - Action Approval Workflow"
                    : "Task Planner Chat - Shared State Demo"}
                </h2>
                <p className="text-xs text-gray-400">
                  {demoMode === "hitl"
                    ? "Ask the agent to perform sensitive actions (delete, send email, execute code)"
                    : "Describe a project to plan - the agent will create a structured task breakdown"}
                </p>
              </div>
              <div className="h-[calc(100%-52px)]">
                {/* Render appropriate chat based on demo mode */}
                {demoMode === "hitl" ? <CustomChat /> : <TaskPlannerChat />}
              </div>
            </div>

            {/* State Panel */}
            <div className="h-[700px] overflow-y-auto">
              {/* Render appropriate state display based on demo mode */}
              {demoMode === "hitl" ? (
                <AgentStateDisplay />
              ) : (
                <TaskPlannerDisplay />
              )}
            </div>
          </CopilotKit>
        </div>
      </main>

      {/* Info Footer */}
      <footer className="max-w-7xl mx-auto p-4">
        <DemoInfoPanel demo={currentDemo} />
      </footer>
    </div>
  );
}

export default App;
