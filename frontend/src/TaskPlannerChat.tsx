/**
 * TaskPlannerChat.tsx
 * ===================
 *
 * A specialized chat component for the Task Planning Copilot.
 * This component provides a streamlined chat interface focused on
 * task planning and project breakdown.
 *
 * ## Key Features
 * ---------------
 * 1. **CopilotChat Integration**: Uses CopilotKit's chat component
 * 2. **Planning-Focused Suggestions**: Quick prompts for common planning tasks
 * 3. **State-Aware Instructions**: Guides the agent to use display_plan tool
 *
 * ## How It Works
 * ---------------
 * The chat sends messages to the Pydantic AI backend via CopilotKit runtime.
 * The agent processes messages and can:
 * - Call display_plan() to show the task plan in TaskPlannerDisplay
 * - Call add_task() to add individual tasks
 * - Call add_subtask() to break down tasks further
 *
 * All state changes are synchronized via the AG-UI protocol's
 * StateSnapshotEvent mechanism.
 *
 * Usage:
 *   <CopilotKit runtimeUrl="/api/copilotkit" agent="pydantic-agent">
 *     <TaskPlannerChat />
 *     <TaskPlannerDisplay />
 *   </CopilotKit>
 */

import React from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

/**
 * TaskPlannerChat - Chat interface for the task planning agent.
 *
 * This component wraps CopilotChat with task-planning-specific
 * configuration including:
 * - Custom suggestions for common planning requests
 * - Instructions that guide the agent to use state tools
 * - Initial message explaining capabilities
 */
export function TaskPlannerChat(): React.ReactElement {
  return (
    <CopilotChat
      className="h-full"
      /**
       * Suggestions appear as quick-action buttons in the chat.
       * Users can click these to send pre-defined messages.
       */
      suggestions={[
        {
          title: "Plan a project",
          message:
            "Help me plan a web application project with frontend, backend, and deployment phases.",
        },
        {
          title: "Break down a task",
          message:
            "I need to implement user authentication. Break this down into subtasks with time estimates.",
        },
        {
          title: "Add dependencies",
          message:
            "Review the current plan and add any missing dependencies between tasks.",
        },
        {
          title: "Prioritize work",
          message:
            "Look at the current tasks and suggest priority adjustments based on dependencies.",
        },
      ]}
      /**
       * Labels customize the chat interface text.
       */
      labels={{
        initial:
          "Hello! I'm a task planning assistant. Tell me about a project or task you'd like to plan, and I'll help break it down into manageable pieces with priorities, phases, and time estimates.",
        placeholder: "Describe what you want to plan...",
      }}
      /**
       * Instructions guide the agent's behavior.
       * These are sent with each message to ensure consistent responses.
       */
      instructions={`
        You are a sophisticated task planning assistant. Your primary role is to:
        1. Help users break down complex projects into manageable tasks
        2. Create subtasks with realistic time estimates
        3. Set appropriate priorities and phases
        4. Identify dependencies between tasks

        IMPORTANT: Always use the display_plan tool to show the plan to the user.
        Do NOT describe the plan in text - use the tool instead.

        When creating plans:
        - Break work into 3-7 main tasks
        - Each task should have 2-5 subtasks
        - Include time estimates (hours)
        - Set appropriate complexity levels
        - Identify dependencies between tasks

        After displaying the plan, provide a brief 1-2 sentence summary.
      `}
    />
  );
}

export default TaskPlannerChat;
