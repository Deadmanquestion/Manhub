type DiagnoseRequest = {
  carModel?: string;
  mileage?: string;
  symptom?: string;
};

type DiagnosisResult = {
  confidence: number;
  diagnosis: string;
  estimated_cost_range: string;
  possible_causes: string[];
  recommended_actions: string[];
  recommended_parts: string[];
};

const diagnosisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    diagnosis: { type: "string" },
    confidence: { type: "number" },
    possible_causes: {
      type: "array",
      items: { type: "string" },
    },
    recommended_actions: {
      type: "array",
      items: { type: "string" },
    },
    recommended_parts: {
      type: "array",
      items: { type: "string" },
    },
    estimated_cost_range: { type: "string" },
  },
  required: [
    "diagnosis",
    "confidence",
    "possible_causes",
    "recommended_actions",
    "recommended_parts",
    "estimated_cost_range",
  ],
};

export async function POST(request: Request) {
  let body: DiagnoseRequest;

  try {
    body = await request.json();
  } catch {
    return Response.json(mockDiagnosis({}), { status: 200 });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return Response.json(mockDiagnosis(body), { status: 200 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        input: [
          {
            role: "system",
            content:
              "You are ManFix's automotive triage assistant. Return cautious customer-facing vehicle pre-diagnosis JSON only. Do not claim certainty. Always recommend technician confirmation before quote.",
          },
          {
            role: "user",
            content: JSON.stringify({
              carModel: body.carModel ?? "Unknown vehicle",
              mileage: body.mileage ?? "Unknown mileage",
              symptom: body.symptom ?? "No symptom provided",
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "manfix_car_diagnosis",
            strict: true,
            schema: diagnosisSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      return Response.json(mockDiagnosis(body), { status: 200 });
    }

    const payload = await response.json();
    const outputText = extractOutputText(payload);
    const parsed = JSON.parse(outputText) as DiagnosisResult;

    return Response.json(normalizeDiagnosis(parsed, body), { status: 200 });
  } catch {
    return Response.json(mockDiagnosis(body), { status: 200 });
  }
}

function getApiKey() {
  return typeof process !== "undefined" ? process.env.OPENAI_API_KEY : undefined;
}

function getModel() {
  return typeof process !== "undefined" && process.env.OPENAI_MODEL
    ? process.env.OPENAI_MODEL
    : "gpt-4.1-mini";
}

type OpenAiResponsePayload = {
  output?: Array<{
    content?: Array<{
      text?: unknown;
    }>;
  }>;
  output_text?: unknown;
};

function extractOutputText(payload: OpenAiResponsePayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  throw new Error("No diagnosis output text returned");
}

function normalizeDiagnosis(result: DiagnosisResult, input: DiagnoseRequest): DiagnosisResult {
  const fallback = mockDiagnosis(input);
  return {
    confidence: clampConfidence(result.confidence ?? fallback.confidence),
    diagnosis: result.diagnosis || fallback.diagnosis,
    estimated_cost_range: result.estimated_cost_range || fallback.estimated_cost_range,
    possible_causes: nonEmptyList(result.possible_causes, fallback.possible_causes),
    recommended_actions: nonEmptyList(result.recommended_actions, fallback.recommended_actions),
    recommended_parts: nonEmptyList(result.recommended_parts, fallback.recommended_parts),
  };
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 75;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function nonEmptyList(value: string[] | undefined, fallback: string[]) {
  return Array.isArray(value) && value.length > 0 ? value : fallback;
}

function mockDiagnosis(input: DiagnoseRequest): DiagnosisResult {
  const symptom = (input.symptom ?? "").toLowerCase();
  const carModel = input.carModel ?? "your vehicle";

  if (symptom.includes("battery") || symptom.includes("start")) {
    return {
      confidence: 82,
      diagnosis: "Battery health low or charging system needs inspection",
      estimated_cost_range: "RM 220-380",
      possible_causes: ["Weak battery", "Loose terminal connection", "Alternator charging issue"],
      recommended_actions: ["Run battery load test", "Check alternator output", "Confirm battery size before replacement"],
      recommended_parts: ["NS60L battery", "Battery terminal cleaner"],
    };
  }

  if (symptom.includes("oil") || symptom.includes("smell") || symptom.includes("engine")) {
    return {
      confidence: 78,
      diagnosis: "Engine oil service or minor leak inspection recommended",
      estimated_cost_range: "RM 160-300",
      possible_causes: ["Oil level low", "Old engine oil", "Minor gasket or drain plug seepage"],
      recommended_actions: ["Check oil level and colour", "Inspect underside for leak marks", "Confirm oil grade for the vehicle"],
      recommended_parts: ["5W-30 fully synthetic engine oil", "Oil filter"],
    };
  }

  return {
    confidence: 87,
    diagnosis: `Front brake pad wear likely on ${carModel}`,
    estimated_cost_range: "RM 280-420",
    possible_causes: ["Front brake pads worn", "Brake dust buildup", "Rotor surface needs inspection"],
    recommended_actions: ["Inspect front brake pad thickness", "Check rotor surface", "Confirm final quote with a certified technician"],
    recommended_parts: ["Bendix front brake pad set", "DOT4 brake fluid"],
  };
}
