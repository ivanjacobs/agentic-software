# AG-UI Protocol Test

Demonstration of the [AG-UI (Agent-User Interaction) Protocol](https://docs.ag-ui.com/) with Pydantic AI and CopilotKit.

This project showcases two key AG-UI features:

1. **Human-in-the-Loop (HITL)**: Action approval workflow
2. **Shared State**: Bidirectional state synchronization for task planning

---

## Table of Contents

- [What is AG-UI?](#what-is-ag-ui)
- [Protocol Principles](#protocol-principles)
- [Architecture](#architecture)
- [Complete Setup Guide](#complete-setup-guide)
- [Demo Modes](#demo-modes)
- [Understanding the Code](#understanding-the-code)
- [Resources](#resources)

---

## What is AG-UI?

The **Agent-User Interaction Protocol (AG-UI)** is an open, lightweight, event-based protocol that standardizes how AI agents connect to user-facing applications.

> *"AG-UI bridges traditional client-server architectures with the dynamic, stateful nature of modern AI systems."*
> — [AG-UI Documentation](https://docs.ag-ui.com/introduction)

![AG-UI Logo](https://mintlify.s3.us-west-1.amazonaws.com/copilotkit/logo/ag-ui-logo-dark.svg)

### Why AG-UI?

Traditional REST/GraphQL APIs break down with agentic systems because agents exhibit three challenging characteristics:

| Challenge | Description |
|-----------|-------------|
| **Long-running streams** | Agents process work across multi-turn sessions with intermediate outputs |
| **Nondeterministic behavior** | Agents dynamically control UI in unpredictable ways |
| **Mixed I/O types** | Agents combine structured data (tool calls, state updates) with unstructured content (text, voice) |

### Core Capabilities

- **Streaming Chat**: Token-level updates with session resume/cancel
- **Generative UI**: Dynamic component rendering
- **Shared State**: Read-write synchronization between agent and UI
- **Frontend Tools**: Backend-coordinated actions executed in the browser
- **Human-in-the-Loop**: Interrupts and approval workflows

---

## Protocol Principles

### Event-Driven Architecture

AG-UI uses **16 standardized event types** for unidirectional streaming from agents to frontends:

```
┌─────────────────────────────────────────────────────────────────┐
│                         EVENT TYPES                             │
├─────────────────────────────────────────────────────────────────┤
│  LIFECYCLE        │  TEXT             │  TOOLS                  │
│  ─────────────    │  ────             │  ─────                  │
│  RUN_STARTED      │  TEXT_MESSAGE_    │  TOOL_CALL_START       │
│  RUN_FINISHED     │    START          │  TOOL_CALL_ARGS        │
│  RUN_ERROR        │    CONTENT        │  TOOL_CALL_END         │
│                   │    END            │                         │
├─────────────────────────────────────────────────────────────────┤
│  STATE            │  SPECIAL                                    │
│  ─────            │  ───────                                    │
│  STATE_SNAPSHOT   │  RAW                                        │
│  STATE_DELTA      │  CUSTOM                                     │
│  MESSAGES_SNAPSHOT│                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Key Event Patterns

| Pattern | Purpose | Example |
|---------|---------|---------|
| **Start-Content-End** | Stream data incrementally | `TEXT_MESSAGE_START` → `TEXT_MESSAGE_CONTENT` (×N) → `TEXT_MESSAGE_END` |
| **Snapshot-Delta** | Efficient state sync | `STATE_SNAPSHOT` (full) or `STATE_DELTA` (patch) |
| **Lifecycle** | Track run boundaries | `RUN_STARTED` → events... → `RUN_FINISHED` |

### Shared State Flow

The core innovation of AG-UI is **bidirectional state synchronization**:

```
┌──────────────────┐                      ┌──────────────────┐
│   BACKEND        │                      │   FRONTEND       │
│   (Python)       │                      │   (React)        │
├──────────────────┤                      ├──────────────────┤
│                  │                      │                  │
│  StateDeps[T]    │                      │  useCoAgent<T>() │
│       │          │                      │       │          │
│       ▼          │                      │       ▼          │
│  ctx.deps.state  │  ◀─── SSE Stream ─── │  state (read)    │
│       │          │       Events         │       │          │
│       │          │                      │       │          │
│  StateSnapshot   │  ─── state.body ──▶  │  setState()      │
│  Event emitted   │       (next req)     │  (write)         │
│                  │                      │                  │
└──────────────────┘                      └──────────────────┘
```

**How it works:**

1. **Agent → Frontend**: Agent tools return `StateSnapshotEvent` which streams to the UI
2. **Frontend → Agent**: User changes call `setState()`, included in next request body
3. **Both sides share the same state model** (Pydantic on backend, TypeScript on frontend)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FULL STACK ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │   vLLM Server   │  GPU-accelerated LLM inference                       │
│   │   (Port 8000)   │  OpenAI-compatible API                               │
│   └────────┬────────┘                                                       │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │  Pydantic AI    │  Agent with tools + shared state                     │
│   │  Backend        │  AG-UI event emission                                │
│   │  (Port 8001)    │  StateDeps for state management                      │
│   └────────┬────────┘                                                       │
│            │ AG-UI Events (SSE)                                            │
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │  CopilotKit     │  AG-UI client adapter                                │
│   │  Runtime        │  Request/response bridging                           │
│   │  (Port 4000)    │  Tool registration                                   │
│   └────────┬────────┘                                                       │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │  React App      │  useCoAgent hook for state                           │
│   │  (Port 3000)    │  CopilotChat component                               │
│   │                 │  TaskPlannerDisplay / AgentStateDisplay              │
│   └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Setup Guide

### Prerequisites

- **Python 3.10+** with pip
- **Node.js 18+** with npm
- **Docker** (for vLLM) or **OpenAI API key**
- **NVIDIA GPUs** (if using vLLM locally)

### Step 1: Start the LLM Server

You have two options: local vLLM or OpenAI API.

#### Option A: Local vLLM Server (Recommended for Production)

vLLM provides fast, OpenAI-compatible inference for local LLMs.

```bash
# Pull and run vLLM with Llama 4 Scout model
docker run -d \
  --gpus '"device=0,1,2,3,4,5,6,7"' \
  --name llama4-scout \
  --network host \
  --ipc host \
  -v /models/llama4-scout:/models/llama4-scout \
  vllm/vllm-openai:v0.10.2 \
  --model=/models/llama4-scout \
  --served-model-name=llama4-scout \
  --gpu-memory-utilization=0.90 \
  --host=0.0.0.0 \
  --port=8000 \
  --max-model-len=1000000 \
  --enable-auto-tool-choice \
  --tool-call-parser=llama4_pythonic \
  --chat-template=examples/tool_chat_template_llama4_pythonic.jinja \
  --tensor-parallel-size=8
```

**Key vLLM Parameters Explained:**

| Parameter | Description |
|-----------|-------------|
| `--gpus '"device=0,1,2,3,4,5,6,7"'` | Use all 8 GPUs |
| `--network host` | Use host networking for low latency |
| `--ipc host` | Shared memory for tensor parallelism |
| `--served-model-name` | Name exposed via API (used in backend config) |
| `--enable-auto-tool-choice` | **Required** for AG-UI tool calls |
| `--tool-call-parser=llama4_pythonic` | Parser for Llama 4's tool format |
| `--chat-template` | Jinja template for tool call formatting |
| `--tensor-parallel-size=8` | Distribute model across 8 GPUs |

**For smaller setups (single GPU):**

```bash
docker run -d \
  --gpus all \
  --name llama4-scout \
  -p 8000:8000 \
  vllm/vllm-openai:v0.10.2 \
  --model=/path/to/model \
  --served-model-name=llama4-scout \
  --enable-auto-tool-choice \
  --tool-call-parser=llama4_pythonic
```

**Verify vLLM is running:**

```bash
curl http://localhost:8000/v1/models
# Should return: {"data":[{"id":"llama4-scout",...}]}
```

#### Option B: OpenAI API

If you don't have local GPUs, use OpenAI:

```bash
# Set your API key
export OPENAI_API_KEY=your-key-here  # Linux/Mac
set OPENAI_API_KEY=your-key-here     # Windows
```

Then modify the backend to use OpenAI (see [Model Configuration](#model-configuration) below).

### Step 2: Start the Pydantic AI Backend

```bash
cd tests/ag_ui_test/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run the Task Planner backend (Shared State demo)
python task_planner.py

# OR run the HITL backend
# python main.py
```

**Expected output:**

```
============================================================
Task Planning Copilot - AG-UI Shared State Demo
============================================================

Endpoints:
  POST /  - AG-UI streaming endpoint

Features:
  - Shared state synchronization
  - Task breakdown with subtasks
  - Priority and complexity levels
  ...
============================================================
INFO:     Uvicorn running on http://localhost:8001
```

### Step 3: Start the Frontend

```bash
cd tests/ag_ui_test/frontend

# Install dependencies
npm install

# Start both CopilotKit runtime and Vite dev server
npm start
```

**Or run them separately (for debugging):**

```bash
# Terminal 1: CopilotKit runtime (proxies to Pydantic AI backend)
npm run server

# Terminal 2: Vite dev server (React app)
npm run dev
```

### Step 4: Open the Application

Navigate to **http://localhost:3000**

1. Select demo mode using the toggle:
   - **Task Planner (Shared State)** - for task_planner.py backend
   - **Human-in-the-Loop** - for main.py backend

2. Try the suggested prompts or type your own!

---

## Demo Modes

### Task Planner (Shared State Demo)

**Backend**: `task_planner.py`

Demonstrates **bidirectional state synchronization** where:
- Agent creates structured task plans
- UI displays tasks with dropdown menus
- User modifications sync back to agent

**Try saying:**
- "Plan a website redesign project"
- "Help me break down building a mobile app"
- "Create a plan for migrating to cloud infrastructure"

**State Model:**

```python
class TaskPlanSnapshot(BaseModel):
    project_name: str
    project_description: str
    current_phase: Phase              # Dropdown menu
    tasks: list[Task]                 # Task cards
    selected_priority_filter: Priority | None
    selected_phase_filter: Phase | None
    last_updated: str
    planning_complete: bool
```

**Enum Dropdowns:**

| Enum | Values |
|------|--------|
| `ComplexityLevel` | Trivial, Simple, Moderate, Complex, Highly Complex |
| `Priority` | Critical, High, Medium, Low, Backlog |
| `Phase` | Discovery, Planning, Development, Testing, Deployment, Maintenance |
| `TaskCategory` | Research, Design, Coding, Documentation, Review, Meeting, Infrastructure, Security |

### Human-in-the-Loop Demo

**Backend**: `main.py`

Demonstrates **approval workflows** where:
- Agent proposes sensitive actions
- User approves/rejects in sidebar
- Agent executes only approved actions

**Try saying:**
- "Delete the file config.json"
- "Send an email to bob@example.com"
- "Execute the code snippet"

---

## Understanding the Code

### Backend: Shared State Implementation

```python
# 1. Define state as a Pydantic model
class TaskPlanSnapshot(BaseModel):
    project_name: str
    tasks: list[Task]
    # ... other fields match frontend TypeScript types

# 2. Create agent with StateDeps (enables shared state)
agent = Agent(
    model,
    deps_type=StateDeps[TaskPlanSnapshot]  # <-- Key line!
)

# 3. Tools return StateSnapshotEvent to sync state
@agent.tool_plain
async def display_plan(project_name: str, tasks: list[dict]) -> StateSnapshotEvent:
    snapshot = TaskPlanSnapshot(
        project_name=project_name,
        tasks=parsed_tasks
    )
    # This event streams to the frontend!
    return StateSnapshotEvent(
        type=EventType.STATE_SNAPSHOT,
        snapshot=snapshot.model_dump()
    )

# 4. Dynamic instructions can read current state
@agent.instructions
async def instructions(ctx: RunContext[StateDeps[TaskPlanSnapshot]]) -> str:
    return f"""
    Current project: {ctx.deps.state.project_name}
    Number of tasks: {len(ctx.deps.state.tasks)}
    """
```

### Frontend: State Connection

```typescript
// 1. Define TypeScript types matching Python models EXACTLY
interface TaskPlanState {
  project_name: string;  // snake_case like Python!
  tasks: Task[];
  current_phase: Phase;
  // ... must match Python model
}

// 2. Use useCoAgent hook to connect to shared state
const { state, setState } = useCoAgent<TaskPlanState>({
  name: "pydantic-agent",  // Must match agent name
  initialState: {
    project_name: "",
    tasks: [],
    current_phase: "Discovery"
  }
});

// 3. Render state in UI
return (
  <div>
    <h2>{state.project_name}</h2>
    {state.tasks.map(task => (
      <TaskCard key={task.id} task={task} />
    ))}
  </div>
);

// 4. Update state (syncs back to agent on next message)
const handlePriorityChange = (taskId: string, newPriority: Priority) => {
  setState(prev => ({
    ...prev,
    tasks: prev.tasks.map(t =>
      t.id === taskId ? { ...t, priority: newPriority } : t
    )
  }));
};
```

### Model Configuration

The backends are configured to use a local vLLM server by default:

```python
# For local vLLM (default)
model = OpenAIChatModel(
    "llama4-scout",  # Must match --served-model-name
    provider=OpenAIProvider(
        base_url="http://localhost:8000/v1",
        api_key="not-needed"
    )
)

# For OpenAI API
model = OpenAIChatModel("gpt-4o-mini")
# Requires OPENAI_API_KEY environment variable
```

---

## Key Files

### Backend

| File | Description |
|------|-------------|
| `backend/task_planner.py` | **Shared State Demo** - Enums, task models, display_plan tool |
| `backend/main.py` | **HITL Demo** - propose_action, approve/reject workflow |
| `backend/requirements.txt` | Python dependencies |

### Frontend

| File | Description |
|------|-------------|
| `frontend/src/App.tsx` | Main app with demo toggle |
| `frontend/src/TaskPlannerDisplay.tsx` | Shared state UI with dropdowns |
| `frontend/src/TaskPlannerChat.tsx` | Planning-focused chat |
| `frontend/src/AgentStateDisplay.tsx` | HITL approval UI |
| `frontend/src/CustomChat.tsx` | HITL chat with generative UI |
| `frontend/server.js` | CopilotKit runtime proxy |

---

## Troubleshooting

### vLLM Issues

```bash
# Check if vLLM is running
docker ps | grep llama4-scout

# View logs
docker logs llama4-scout

# Test the API
curl http://localhost:8000/v1/models

# Common issues:
# - Out of GPU memory: reduce --max-model-len or --gpu-memory-utilization
# - Tool calls not working: ensure --enable-auto-tool-choice is set
```

### Backend Issues

```bash
# Check if backend is responding
curl http://localhost:8001/health

# Common issues:
# - "Connection refused": Backend not running or wrong port
# - "Model not found": vLLM not running or wrong model name
```

### Frontend Issues

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Common issues:
# - CORS errors: Backend not allowing frontend origin
# - State not updating: Check useCoAgent hook name matches agent
```

---

## Protocol Comparison

| Feature | AG-UI Protocol | Vercel AI SDK | LangServe |
|---------|---------------|---------------|-----------|
| **Streaming** | SSE with typed events | SSE with data/text | SSE |
| **State Sync** | Built-in (StateDeps) | Manual | Manual |
| **Tools** | Typed events | Tool messages | Runnable |
| **Framework** | Framework-agnostic | Next.js focused | LangChain |
| **Frontend** | Any (CopilotKit, custom) | React | Custom |

---

## Resources

### Official Documentation

| Resource | Link |
|----------|------|
| **AG-UI Protocol** | https://docs.ag-ui.com/ |
| **AG-UI Events** | https://docs.ag-ui.com/concepts/events |
| **AG-UI Architecture** | https://docs.ag-ui.com/concepts/architecture |
| **Pydantic AI AG-UI** | https://ai.pydantic.dev/ui/ag-ui/ |
| **CopilotKit** | https://docs.copilotkit.ai/ |
| **CopilotKit Shared State** | https://docs.copilotkit.ai/coagents/shared-state |

### Interactive Examples

| Resource | Link |
|----------|------|
| **AG-UI Dojo** | https://dojo.ag-ui.com/ |
| **Shared State Example** | https://dojo.ag-ui.com/pydantic-ai/feature/shared_state |

### GitHub Repositories

| Resource | Link |
|----------|------|
| **AG-UI Protocol** | https://github.com/ag-ui-protocol/ag-ui |
| **Pydantic AI** | https://github.com/pydantic/pydantic-ai |
| **CopilotKit** | https://github.com/CopilotKit/CopilotKit |
| **vLLM** | https://github.com/vllm-project/vllm |

### Related Protocols

| Protocol | Purpose | Link |
|----------|---------|------|
| **MCP** | Agent ↔ Tools/Data | https://modelcontextprotocol.io/ |
| **A2A** | Agent ↔ Agent | https://google.github.io/A2A/ |

---

## License

MIT
