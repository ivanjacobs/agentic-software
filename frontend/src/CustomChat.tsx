import React, { useState, useEffect } from "react";
import { useFrontendTool, useHumanInTheLoop, useLangGraphInterrupt, useCopilotAction } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

// Type definitions
interface Step {
  description: string;
  status: "enabled" | "disabled" | "executing";
}

interface StepsFeedbackArgs {
  steps?: (string | Step)[];
}

interface StepsFeedbackResponse {
  accepted: boolean;
  steps?: Step[];
}

interface StepsFeedbackProps {
  args: StepsFeedbackArgs;
  respond?: (response: StepsFeedbackResponse) => void;
  status: "executing" | "waiting" | string;
}

interface InterruptEvent {
  value?: {
    steps?: (string | Step)[];
  };
}

interface InterruptHumanInTheLoopProps {
  event: InterruptEvent;
  resolve: (response: string) => void;
}


// Haiku types for generative UI
interface Haiku {
  japanese: string[];
  english: string[];
  image_name: string | null;
  gradient: string;
}

// Valid image names for haiku generation
const VALID_IMAGE_NAMES = [
  "Osaka_Castle_Turret_Stone_Wall_Pine_Trees_Daytime.jpg",
  "Tokyo_Skyline_Night_Tokyo_Tower_Mount_Fuji_View.jpg",
  "Itsukushima_Shrine_Miyajima_Floating_Torii_Gate_Sunset_Long_Exposure.jpg",
  "Takachiho_Gorge_Waterfall_River_Lush_Greenery_Japan.jpg",
  "Bonsai_Tree_Potted_Japanese_Art_Green_Foliage.jpeg",
  "Shirakawa-go_Gassho-zukuri_Thatched_Roof_Village_Aerial_View.jpg",
  "Ginkaku-ji_Silver_Pavilion_Kyoto_Japanese_Garden_Pond_Reflection.jpg",
  "Senso-ji_Temple_Asakusa_Cherry_Blossoms_Kimono_Umbrella.jpg",
  "Cherry_Blossoms_Sakura_Night_View_City_Lights_Japan.jpg",
  "Mount_Fuji_Lake_Reflection_Cherry_Blossoms_Sakura_Spring.jpg",
];

/**
 * HaikuCard - Displays a haiku with Japanese and English text
 */
function HaikuCard({ haiku }: { haiku: Partial<Haiku> }): React.ReactElement {
  return (
    <div
      data-testid="haiku-card"
      style={{ background: haiku.gradient }}
      className="relative bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 rounded-2xl my-6 p-8 max-w-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
    >
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl -z-0" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-indigo-400/10 to-pink-400/10 rounded-full blur-3xl -z-0" />

      {/* Haiku Text */}
      <div className="relative z-10 flex flex-col items-center space-y-6">
        {haiku.japanese?.map((line, index) => (
          <div
            key={index}
            className="flex flex-col items-center text-center space-y-2 animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <p
              data-testid="haiku-japanese-line"
              className="font-serif font-bold text-4xl md:text-5xl bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent tracking-wide"
            >
              {line}
            </p>
            <p
              data-testid="haiku-english-line"
              className="font-light text-base md:text-lg text-slate-600 dark:text-slate-400 italic max-w-md"
            >
              {haiku.english?.[index]}
            </p>
          </div>
        ))}
      </div>

      {/* Image */}
      {haiku.image_name && (
        <div className="relative z-10 mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
          <div className="relative group overflow-hidden rounded-2xl shadow-xl">
            <img
              data-testid="haiku-image"
              src={`/images/${haiku.image_name}`}
              alt={haiku.image_name}
              className="object-cover w-full h-64 md:h-80 transform transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </div>
      )}
    </div>
  );
}

// Note: HeadlessChat doesn't use any CopilotKit hooks - it's fully independent

/**
 * StepsFeedback - Inline approval UI that renders in the chat
 * Allows users to select/deselect steps and confirm or reject
 */
const StepsFeedback: React.FC<StepsFeedbackProps> = ({ args, respond, status }) => {
  const [localSteps, setLocalSteps] = useState<Step[]>([]);
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "executing" && localSteps.length === 0 && args?.steps) {
      setLocalSteps(args.steps.map(step => ({
        description: typeof step === "string" ? step : step.description || "",
        status: typeof step === "object" && step.status ? step.status : "enabled",
      })));
    }
  }, [status, args?.steps, localSteps]);

  if (!args?.steps || args.steps.length === 0) {
    return null;
  }

  const steps = localSteps.length > 0 ? localSteps : args.steps.map(step => ({
    description: typeof step === "string" ? step : step.description || "",
    status: "enabled" as const,
  }));
  const enabledCount = steps.filter((step) => step.status === "enabled").length;

  const handleStepToggle = (index: number): void => {
    setLocalSteps((prevSteps) =>
      prevSteps.map((step, i) =>
        i === index
          ? { ...step, status: step.status === "enabled" ? "disabled" : "enabled" }
          : step
      )
    );
  };

  const handleReject = (): void => {
    if (respond) {
      setAccepted(false);
      respond({ accepted: false });
    }
  };

  const handleConfirm = (): void => {
    if (respond) {
      setAccepted(true);
      respond({ accepted: true, steps: localSteps.filter((step) => step.status === "enabled") });
    }
  };

  return (
    <div data-testid="select-steps" className="flex my-2">
      <div className="relative rounded-xl w-full max-w-[500px] p-4 shadow-lg backdrop-blur-sm bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700/50">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Select Steps
            </h2>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-400">
                {enabledCount}/{steps.length} Selected
              </div>
              <div
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  status === "executing"
                    ? "bg-blue-900/30 text-blue-300 border border-blue-500/30"
                    : "bg-slate-700 text-slate-300"
                }`}
              >
                {status === "executing" ? "Ready" : "Waiting"}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-1.5 rounded-full overflow-hidden bg-slate-700">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${steps.length > 0 ? (enabledCount / steps.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Steps list */}
        <div className="space-y-2 mb-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center p-2.5 rounded-lg transition-all duration-300 ${
                step.status === "enabled"
                  ? "bg-gradient-to-r from-blue-900/20 to-purple-900/10 border border-blue-500/30"
                  : "bg-slate-800/30 border border-slate-600/30"
              }`}
            >
              <label data-testid="step-item" className="flex items-center cursor-pointer w-full">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={step.status === "enabled"}
                    onChange={() => handleStepToggle(index)}
                    className="sr-only"
                    disabled={status !== "executing"}
                  />
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                      step.status === "enabled"
                        ? "bg-gradient-to-br from-blue-500 to-purple-600 border-blue-500"
                        : "border-slate-400 bg-slate-700"
                    } ${status !== "executing" ? "opacity-60" : ""}`}
                  >
                    {step.status === "enabled" && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span
                  data-testid="step-text"
                  className={`ml-2.5 text-sm font-medium transition-all duration-300 ${
                    step.status !== "enabled"
                      ? "line-through text-slate-500"
                      : "text-white"
                  } ${status !== "executing" ? "opacity-60" : ""}`}
                >
                  {step.description}
                </span>
              </label>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        {accepted === null && (
          <div className="flex justify-center gap-3">
            <button
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                status !== "executing"
                  ? "opacity-50 cursor-not-allowed bg-gray-600"
                  : "hover:scale-105 shadow-md hover:shadow-lg bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
              }`}
              disabled={status !== "executing"}
              onClick={handleReject}
            >
              <span className="mr-1">{"\u2717"}</span> Reject
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                status !== "executing"
                  ? "opacity-50 cursor-not-allowed bg-gray-400"
                  : "hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
              }`}
              disabled={status !== "executing"}
              onClick={handleConfirm}
            >
              <span className="mr-1">{"\u2713"}</span> Confirm
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold bg-green-800/50">
                {enabledCount}
              </span>
            </button>
          </div>
        )}

        {/* Result State */}
        {accepted !== null && (
          <div className="flex justify-center">
            <div
              className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 ${
                accepted
                  ? "bg-green-900/30 text-green-300 border border-green-500/30"
                  : "bg-red-900/30 text-red-300 border border-red-500/30"
              }`}
            >
              <span className="text-base">{accepted ? "\u2713" : "\u2717"}</span>
              {accepted ? "Accepted" : "Rejected"}
            </div>
          </div>
        )}

        {/* Decorative elements */}
        <div className="absolute top-2 right-2 w-12 h-12 rounded-full blur-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
        <div className="absolute bottom-2 left-2 w-8 h-8 rounded-full blur-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10" />
      </div>
    </div>
  );
};

/**
 * InterruptHumanInTheLoop - For LangGraph interrupt handling
 */
const InterruptHumanInTheLoop: React.FC<InterruptHumanInTheLoopProps> = ({ event, resolve }) => {
  let initialSteps: Step[] = [];
  if (event?.value?.steps && Array.isArray(event.value.steps)) {
    initialSteps = event.value.steps.map((step) => ({
      description: typeof step === "string" ? step : step.description || "",
      status: (typeof step === "object" && step.status ? step.status : "enabled") as "enabled" | "disabled" | "executing",
    }));
  }

  const [localSteps, setLocalSteps] = useState<Step[]>(initialSteps);
  const enabledCount = localSteps.filter((step) => step.status === "enabled").length;

  const handleStepToggle = (index: number): void => {
    setLocalSteps((prevSteps) =>
      prevSteps.map((step, i) =>
        i === index
          ? { ...step, status: step.status === "enabled" ? "disabled" : "enabled" }
          : step
      )
    );
  };

  const handlePerformSteps = (): void => {
    const selectedSteps = localSteps
      .filter((step) => step.status === "enabled")
      .map((step) => step.description);
    resolve("The user selected the following steps: " + selectedSteps.join(", "));
  };

  return (
    <div data-testid="select-steps" className="flex my-2">
      <div className="relative rounded-xl w-full max-w-[500px] p-4 shadow-lg backdrop-blur-sm bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700/50">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Select Steps
            </h2>
            <div className="text-xs text-slate-400">
              {enabledCount}/{localSteps.length} Selected
            </div>
          </div>

          <div className="relative h-1.5 rounded-full overflow-hidden bg-slate-700">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${localSteps.length > 0 ? (enabledCount / localSteps.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Steps list */}
        <div className="space-y-2 mb-4">
          {localSteps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center p-2.5 rounded-lg transition-all duration-300 ${
                step.status === "enabled"
                  ? "bg-gradient-to-r from-blue-900/20 to-purple-900/10 border border-blue-500/30"
                  : "bg-slate-800/30 border border-slate-600/30"
              }`}
            >
              <label data-testid="step-item" className="flex items-center cursor-pointer w-full">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={step.status === "enabled"}
                    onChange={() => handleStepToggle(index)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                      step.status === "enabled"
                        ? "bg-gradient-to-br from-blue-500 to-purple-600 border-blue-500"
                        : "border-slate-400 bg-slate-700"
                    }`}
                  >
                    {step.status === "enabled" && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span
                  data-testid="step-text"
                  className={`ml-2.5 text-sm font-medium transition-all duration-300 ${
                    step.status !== "enabled" ? "line-through text-slate-500" : "text-white"
                  }`}
                >
                  {step.description}
                </span>
              </label>
            </div>
          ))}
        </div>

        {/* Perform Steps Button */}
        <div className="flex justify-center">
          <button
            className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white"
            onClick={handlePerformSteps}
          >
            <span className="text-base mr-1">{"\u2728"}</span> Perform Steps
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold bg-purple-800/50">
              {enabledCount}
            </span>
          </button>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-2 right-2 w-12 h-12 rounded-full blur-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
        <div className="absolute bottom-2 left-2 w-8 h-8 rounded-full blur-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10" />
      </div>
    </div>
  );
};

/**
 * CustomChat - Uses CopilotChat with useHumanInTheLoop for frontend tools
 * Based on: https://docs.copilotkit.ai/pydantic-ai/human-in-the-loop
 */
export function CustomChat(): React.ReactElement {
  const [haikus, setHaikus] = useState<Haiku[]>([]);

  // Generative UI action for haiku generation (tool-based pattern)
  useCopilotAction(
    {
      name: "generate_haiku",
      description: "Generate a haiku poem in Japanese with English translation",
      parameters: [
        {
          name: "japanese",
          type: "string[]",
          required: true,
          description: "3 lines of haiku in Japanese",
        },
        {
          name: "english",
          type: "string[]",
          required: true,
          description: "3 lines of haiku translated to English",
        },
        {
          name: "image_name",
          type: "string",
          required: true,
          description: `One relevant image name from: ${VALID_IMAGE_NAMES.join(", ")}`,
        },
        {
          name: "gradient",
          type: "string",
          required: true,
          description: "CSS Gradient color for the background",
        },
      ],
      followUp: false,
      handler: async ({ japanese, english, image_name, gradient }) => {
        const newHaiku: Haiku = {
          japanese: japanese || [],
          english: english || [],
          image_name: image_name || null,
          gradient: gradient || "",
        };
        setHaikus((prev) => [newHaiku, ...prev]);
        console.log("[generate_haiku] Created haiku:", newHaiku);
        return "Haiku generated!";
      },
      render: ({ args }) => {
        if (!args.japanese) return <></>;
        return <HaikuCard haiku={args as Haiku} />;
      },
    },
    [haikus],
  );

  // Human-in-the-loop action for step approval (frontend tool pattern)
  useHumanInTheLoop({
    name: "generate_task_steps",
    description: "Generates a list of steps for the user to perform. Use this when the user asks to plan something with multiple steps.",
    parameters: [
      {
        name: "steps",
        type: "object[]",
        attributes: [
          {
            name: "description",
            type: "string",
          },
          {
            name: "status",
            type: "string",
            enum: ["enabled", "disabled", "executing"],
          },
        ],
      },
    ],
    render: ({ args, respond, status }) => {
      console.log("[useHumanInTheLoop] Rendering StepsFeedback:", { args, status });
      return <StepsFeedback args={args as StepsFeedbackArgs} respond={respond} status={status} />;
    },
  });
  const [background, setBackground] = useState<string>("");
  useFrontendTool({
    name: "change_background",
    description:
        "Change the background color of the chat. Can be anything that the CSS background attribute accepts. Regular colors, linear of radial gradients etc.",
    parameters: [
      {
        name: "background",
        type: "string",
        description: "The background. Prefer gradients. Only use when asked.",
      },
    ],
    handler: ({ background }: { background: string }) => {
      console.log("[change_background] Setting background to:", background);
      setBackground(background);
      return {
        status: "success",
        message: `Background changed to ${background}`,
      };
    },
  });
  // LangGraph interrupt handler (for LangGraph integrations)
  useLangGraphInterrupt({
    render: ({ event, resolve }) => <InterruptHumanInTheLoop event={event as InterruptEvent} resolve={resolve} />,
  });

  const customStyles = {
    '--copilot-kit-background-color': background,
  } as React.CSSProperties;

  return (
    <div
      className="h-full w-full"
      data-testid="background-container"
      style={customStyles}
    >
      <CopilotChat
        className="h-full"
        style={{ background }}
        suggestions={[
          {
            title: "Change background",
            message: "Change the background to something new.",
          },
          {
            title: "Nature Haiku",
            message: "Write me a haiku about nature.",
          },
          {
            title: "Plan a trip",
            message: "Help me plan a trip to Japan in 5 steps.",
          },
          {
            title: "Generate sonnet",
            message: "Write a short sonnet about AI.",
          },
        ]}
        labels={{
          initial: "Hello! I'm connected via the AG-UI protocol. Ask me to write a haiku, plan something, or change the background!",
        }}
        instructions="When the user asks for a haiku, use the generate_haiku tool. When the user asks to plan something, use the generate_task_steps tool. When asked to change background, use change_background tool."
      />
    </div>
  );
}

export default CustomChat;
