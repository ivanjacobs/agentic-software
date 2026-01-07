/**
 * Simple Express server for CopilotKit runtime API
 * This proxies requests to the Pydantic AI AG-UI backend
 *
 * Run: node server.js
 */

import express from "express";
import cors from "cors";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Create the AG-UI HttpAgent pointing to the Pydantic AI backend
const pydanticAgent = new HttpAgent({
  url: "http://localhost:8001/", // Pydantic AI AG-UI endpoint
});

// CopilotKit runtime endpoint that connects to the Pydantic AI backend
app.use("/api/copilotkit", async (req, res) => {
  // Debug logging
  console.log("\n" + "=".repeat(60));
  console.log("[CopilotKit Runtime] Incoming request");
  console.log("[CopilotKit Runtime] Method:", req.body?.method);
  console.log("[CopilotKit Runtime] Body keys:", Object.keys(req.body || {}));

  // Log nested body if present
  if (req.body?.body) {
    console.log("[CopilotKit Runtime] Nested body keys:", Object.keys(req.body.body));
  }

  // Check for tools in various locations
  const tools = req.body?.tools || req.body?.body?.tools || [];
  console.log("[CopilotKit Runtime] Tools count:", tools.length);
  if (tools.length > 0) {
    console.log("[CopilotKit Runtime] Tool names:", tools.map(t => t.name));
    // Log tool details
    tools.forEach(t => {
      console.log(`[CopilotKit Runtime] Tool '${t.name}':`, JSON.stringify(t).substring(0, 200));
    });
  } else {
    console.log("[CopilotKit Runtime] WARNING: No frontend tools in request!");
  }

  // Log messages count and content
  const messages = req.body?.messages || req.body?.body?.messages || [];
  console.log("[CopilotKit Runtime] Messages count:", messages.length);
  if (messages.length > 0) {
    messages.forEach((m, i) => {
      console.log(`[CopilotKit Runtime] Message ${i}: role=${m.role}, content=${(m.content || '').substring(0, 50)}`);
    });
  }
  console.log("=".repeat(60) + "\n");

  const runtime = new CopilotRuntime({
    agents: {
      "pydantic-agent": pydanticAgent,  // Object with agent name as key
    },
  });

  const handler = copilotRuntimeNodeHttpEndpoint({
    endpoint: "/api/copilotkit",
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
  });

  return handler(req, res);
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "copilotkit-runtime" });
});

app.listen(PORT, () => {
  console.log(`CopilotKit Runtime server running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/copilotkit`);
  console.log(`\nMake sure the Pydantic AI backend is running on http://localhost:8001`);
});
