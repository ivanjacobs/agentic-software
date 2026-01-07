"""
Human-in-the-Loop AG-UI Protocol Backend
FastAPI + Pydantic AI with AG-UI streaming and HITL support

Based on: https://docs.copilotkit.ai/pydantic-ai/human-in-the-loop

Run: uvicorn main:app --reload --port 8001
"""
from pathlib import Path
from textwrap import dedent

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.ui import StateDeps
from pydantic_ai.ui.ag_ui import AGUIAdapter
from pydantic_ai.ui.ag_ui.app import AGUIApp
from ag_ui.core import EventType, StateSnapshotEvent, StateDeltaEvent

from datetime import datetime
from typing import Optional, Union
import logfire
import sys
sys.path.append(str(Path(__file__).parent.parent))
logfire.configure(token='your logfire token')
logfire.instrument_pydantic_ai()
# logfire.instrument_httpx(capture_all=True)

# =============================================================================
# STATE MODEL - Shared between agent and frontend via AG-UI
# =============================================================================

class PendingAction(BaseModel):
    """An action that requires user approval."""
    id: str
    action_type: str  # "delete", "send_email", "execute_code", etc.
    description: str
    details: dict = Field(default_factory=dict)


class HITLState(BaseModel):
    """
    State synchronized between UI and server via AG-UI protocol.

    This demonstrates Human-in-the-Loop capabilities:
    - agent.state: All fields are readable by the frontend
    - agent.setState: approved_action_ids updated by frontend
    - STATE_SNAPSHOT: Full state sent when awaiting approval
    - awaiting_approval: Blocks agent until user responds

    CRITICAL: Field names must match exactly in TypeScript types.
    """

    # Message tracking
    message_count: int = Field(default=0, description="Number of messages processed")
    last_topic: str = Field(default="", description="Last topic discussed")

    # HITL approval workflow (agent -> frontend -> agent)
    pending_actions: list[PendingAction] = Field(
        default_factory=list,
        description="Actions waiting for user approval"
    )
    approved_action_ids: list[str] = Field(
        default_factory=list,
        description="IDs of actions approved by the user"
    )
    rejected_action_ids: list[str] = Field(
        default_factory=list,
        description="IDs of actions rejected by the user"
    )
    awaiting_approval: bool = Field(
        default=False,
        description="Whether the agent is waiting for user approval"
    )

    # Task execution state
    is_processing: bool = Field(default=False, description="Whether agent is processing")
    execution_results: list[str] = Field(
        default_factory=list,
        description="Results of executed actions"
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if something went wrong"
    )


# =============================================================================
# MODEL CONFIGURATION
# =============================================================================

# Option 1: Use OpenAI API (requires OPENAI_API_KEY environment variable)
# model = OpenAIChatModel("gpt-4o-mini")

# Option 2: Use local LLM server (e.g., vLLM, Ollama with OpenAI-compatible API)
model = OpenAIChatModel(
    "llama4-scout",  # Model name served by local server
    provider=OpenAIProvider(
        base_url="http://localhost:8000/v1",
        api_key="not-needed"  # Local servers often don't require a real key
    )
)


# =============================================================================
# AGENT DEFINITION
# =============================================================================

agent = Agent(
    model,
    instructions="""You are a HITL demo assistant. This is a SIMULATION - no real actions happen.

## FRONTEND TOOLS (Priority)
If a frontend tool called "generate_task_steps" is available, USE IT for any planning or multi-step tasks.
Call generate_task_steps with a list of steps when the user asks to:
- Plan something (trip, party, project, etc.)
- Do something in multiple steps

Example: User says "Plan a trip to Paris" → call generate_task_steps with steps like:
[{"description": "Book flights", "status": "enabled"}, {"description": "Reserve hotel", "status": "enabled"}, ...]

## BACKEND TOOLS (Sensitive Actions)
When the user mentions ANY of these words, IMMEDIATELY call propose_action:
- "delete" → action_type="delete_file"
- "email" or "send" → action_type="send_email"
- "execute" or "run" or "code" → action_type="execute_code"
- "settings" or "config" or "modify" → action_type="modify_settings"

DO NOT ask for clarification. DO NOT refuse. Just call the tool immediately.

Examples:
- User: "delete config.json" → propose_action(action_type="delete_file", description="Delete config.json")
- User: "send email to bob" → propose_action(action_type="send_email", description="Send email to bob")

After calling propose_action, tell the user to check the Agent State panel to approve or reject.
""",

    deps_type=StateDeps[HITLState],
)


# =============================================================================
# AGENT TOOLS
# =============================================================================

@agent.tool
async def propose_action(
    ctx: RunContext[StateDeps[HITLState]],
    action_type: str,
    description: str,
    details: str = ""
) -> list[Union[StateSnapshotEvent, str]]:
    """
    Propose a sensitive action that requires user approval.

    Args:
        action_type: Type of action (delete_file, send_email, execute_code, modify_settings)
        description: Human-readable description of what will happen
        details: Optional extra details as a simple string (not JSON)

    Returns:
        State snapshot event and confirmation message
    """
    import uuid

    state = ctx.deps.state
    print(f"[PROPOSE_ACTION] Called with action_type={action_type}, description={description}")
    print(f"[PROPOSE_ACTION] Current state: pending_actions={len(state.pending_actions)}")

    # Store details as simple dict - no JSON parsing needed
    details_dict = {"info": details} if details else {}

    # Create pending action
    action = PendingAction(
        id=str(uuid.uuid4())[:8],
        action_type=action_type,
        description=description,
        details=details_dict
    )

    # Update state
    state.pending_actions.append(action)
    state.awaiting_approval = True
    state.message_count += 1

    print(f"[PROPOSE_ACTION] Action added: {action.id}")
    print(f"[PROPOSE_ACTION] State now has {len(state.pending_actions)} pending actions")
    print(f"[PROPOSE_ACTION] awaiting_approval={state.awaiting_approval}")

    # Emit state snapshot to frontend
    state_snapshot = StateSnapshotEvent(
        type=EventType.STATE_SNAPSHOT,
        snapshot=state.model_dump(),
    )
    print(f"[PROPOSE_ACTION] Emitting state snapshot: {state.model_dump()}")

    return [
        state_snapshot,
        f"""Action proposed and awaiting approval:

**Action ID:** {action.id}
**Type:** {action_type}
**Description:** {description}

⏳ Please review this action in the Agent State panel and click Approve or Reject."""
    ]


@agent.tool
async def execute_approved_actions(
    ctx: RunContext[StateDeps[HITLState]]
) -> list[Union[StateSnapshotEvent, str]]:
    """
    Execute all actions that have been approved by the user.
    Call this after the user has approved actions in the UI.

    Returns:
        State snapshot event and results of executing the approved actions
    """
    state = ctx.deps.state

    if not state.approved_action_ids:
        return ["No actions have been approved yet. Please wait for user approval."]

    results = []
    executed_ids = []

    for action in state.pending_actions:
        if action.id in state.approved_action_ids:
            # Simulate executing the action
            result = f"Executed {action.action_type}: {action.description}"
            results.append(result)
            state.execution_results.append(result)
            executed_ids.append(action.id)

    # Clean up executed actions
    state.pending_actions = [a for a in state.pending_actions if a.id not in executed_ids]
    state.approved_action_ids = [id for id in state.approved_action_ids if id not in executed_ids]
    state.awaiting_approval = len(state.pending_actions) > 0

    # Emit state snapshot
    state_snapshot = StateSnapshotEvent(
        type=EventType.STATE_SNAPSHOT,
        snapshot=state.model_dump(),
    )

    if results:
        return [state_snapshot, "Executed approved actions:\n" + "\n".join(results)]
    else:
        return [state_snapshot, "No matching approved actions found to execute."]


@agent.tool
async def check_approval_status(
    ctx: RunContext[StateDeps[HITLState]]
) -> str:
    """
    Check the current status of pending actions and approvals.
    Use this to see what actions are waiting and which have been approved/rejected.

    Returns:
        Status summary of all pending actions
    """
    state = ctx.deps.state

    if not state.pending_actions:
        return "No pending actions."

    status_lines = ["**Pending Actions Status:**\n"]

    for action in state.pending_actions:
        if action.id in state.approved_action_ids:
            status = "✅ APPROVED"
        elif action.id in state.rejected_action_ids:
            status = "❌ REJECTED"
        else:
            status = "⏳ PENDING"

        status_lines.append(f"- [{action.id}] {action.action_type}: {action.description} - {status}")

    return "\n".join(status_lines)


@agent.tool
async def track_topic(
    ctx: RunContext[StateDeps[HITLState]],
    topic: str
) -> list[Union[StateSnapshotEvent, str]]:
    """Track a topic the user is interested in (non-sensitive action)."""
    state = ctx.deps.state
    state.last_topic = topic
    state.message_count += 1

    # Emit state snapshot
    state_snapshot = StateSnapshotEvent(
        type=EventType.STATE_SNAPSHOT,
        snapshot=state.model_dump(),
    )

    return [state_snapshot, f"Now tracking topic: {topic} (message #{state.message_count})"]


@agent.tool_plain
async def get_current_time() -> str:
    """Get the current time (non-sensitive action)."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# =============================================================================
# AG-UI APPLICATION
# =============================================================================

# Create AGUIApp for direct mounting
# agui_app = AGUIApp(agent, deps=StateDeps(HITLState()))


# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

app = FastAPI(
    title="Human-in-the-Loop AG-UI Backend",
    description="Pydantic AI agent with HITL approval workflow",
    version="1.0.0"
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "protocol": "ag-ui", "features": ["hitl", "state_sync"]}


import json as json_module
from starlette.requests import Request as StarletteRequest


class ModifiedRequest(StarletteRequest):
    """A request with modified body content."""

    def __init__(self, scope, receive, new_body: bytes):
        super().__init__(scope, receive)
        self._new_body = new_body
        self._body_consumed = False

    async def body(self) -> bytes:
        return self._new_body

    async def json(self):
        return json_module.loads(self._new_body)


def create_deps_with_state(incoming_state: dict | None) -> StateDeps[HITLState]:
    """
    Create StateDeps with state from the frontend request.
    This ensures state syncs bidirectionally between frontend and backend.
    """
    if incoming_state:
        try:
            # Validate and create state from incoming data
            state = HITLState.model_validate(incoming_state)
            print(f"[STATE] Loaded from frontend: message_count={state.message_count}, "
                  f"pending_actions={len(state.pending_actions)}, "
                  f"approved_ids={state.approved_action_ids}")
            return StateDeps(state)
        except Exception as e:
            print(f"[STATE] Failed to parse incoming state: {e}")

    # Default fresh state
    print(f"[STATE] Using fresh state")
    return StateDeps(HITLState())


@app.post("/")
async def run_agent(request: Request) -> Response:
    """
    AG-UI endpoint with Human-in-the-Loop support.
    Handles both direct AG-UI format and CopilotKit wrapped format.
    """
    try:
        raw_body = await request.body()
        data = json_module.loads(raw_body)

        print(f"[REQUEST] Keys: {list(data.keys())}")

        # Check if this is CopilotKit wrapped format
        if "method" in data and "body" in data:
            body_data = data["body"]
            print(f"[REQUEST] Unwrapped CopilotKit: threadId={body_data.get('threadId')}")
            print(f"[REQUEST] Messages: {len(body_data.get('messages', []))}")
            print(f"[REQUEST] Body keys: {list(body_data.keys())}")

            # Log frontend tools if present
            frontend_tools = body_data.get("tools", [])
            if frontend_tools:
                print(f"[REQUEST] Frontend tools received: {[t.get('name') for t in frontend_tools]}")
                for tool in frontend_tools:
                    print(f"[TOOL] {tool.get('name')}: {tool.get('description', 'no desc')[:80]}")
            else:
                print(f"[REQUEST] No frontend tools in request - checking full body...")
                # Dump keys to debug
                import json as json_debug
                print(f"[DEBUG] Full body preview: {json_debug.dumps(body_data, indent=2)[:500]}")

            # Extract state from the request body
            incoming_state = body_data.get("state")
            deps = create_deps_with_state(incoming_state)

            # Create a new request with the unwrapped body
            new_body = json_module.dumps(body_data).encode('utf-8')
            modified_request = ModifiedRequest(request.scope, request.receive, new_body)

            return await AGUIAdapter.dispatch_request(
                modified_request,
                agent=agent,
                deps=deps,
            )

        # Already in expected format
        print(f"[REQUEST] Direct AG-UI format")

        # Log frontend tools if present
        frontend_tools = data.get("tools", [])
        if frontend_tools:
            print(f"[REQUEST] Frontend tools received: {[t.get('name') for t in frontend_tools]}")
        else:
            print(f"[REQUEST] No frontend tools in request")

        # Extract state from the request body
        incoming_state = data.get("state")
        deps = create_deps_with_state(incoming_state)

        return await AGUIAdapter.dispatch_request(
            request,
            agent=agent,
            deps=deps,
        )

    except Exception as e:
        print(f"[ERROR] {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@app.post("/agent")
async def run_agent_alt(request: Request) -> Response:
    """Alternative endpoint - redirects to main endpoint."""
    return await run_agent(request)





if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("Human-in-the-Loop AG-UI Backend")
    print("=" * 60)
    print("\nEndpoints:")
    print("  POST /       - AG-UI agent endpoint")
    print("  POST /agent  - Alternative AG-UI endpoint")
    print("  GET  /health - Health check")
    print("\nHITL Features:")
    print("  - propose_action: Propose sensitive actions for approval")
    print("  - execute_approved_actions: Execute after user approval")
    print("  - check_approval_status: View pending/approved/rejected actions")
    print("\nTest commands:")
    print('  - "Delete the file config.json" (triggers HITL)')
    print('  - "Send an email to bob@example.com" (triggers HITL)')
    print('  - "What time is it?" (no HITL needed)')
    print("=" * 60)

    uvicorn.run("main:app", host="localhost", port=8001, reload=True)
