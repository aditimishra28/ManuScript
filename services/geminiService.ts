import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Machine, SensorReading, LogEntry } from "../types";

// Helper to get a fresh AI client instance on every call
// This ensures that if the user selects an API key via window.aistudio.openSelectKey(),
// the new key (injected into process.env.API_KEY) is picked up immediately.
const getAiClient = () => {
    // Graceful handling of missing keys
    const API_KEY = process.env.API_KEY || '';
    if (!API_KEY || API_KEY.includes('YOUR_KEY')) {
        console.warn("⚠️ SYSTEM WARNING: No valid Google GenAI API Key found. Running in simulation mode.");
    }
    return new GoogleGenAI({ apiKey: API_KEY });
};

const IS_MOCK_MODE = !process.env.API_KEY || process.env.API_KEY.includes('YOUR_KEY');

// -- SAFETY & COMPLIANCE LAYER --
const FORBIDDEN_KEYWORDS = ['weapon', 'violence', 'blood', 'human face', 'child', 'political', 'hate', 'flesh', 'animal'];
const INDUSTRIAL_CONTEXT_ENFORCER = "CONTEXT: Industrial manufacturing environment only. No organic matter. No text overlays. No artistic abstractions.";

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to clean JSON string from Markdown wrapping and extra text
const cleanJson = (text: string): string => {
    if (!text) return "{}";
    let cleaned = text.replace(/```json|```/g, '');
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    } else {
        return "{}";
    }
    return cleaned.trim();
};

async function retry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error?.status === 429 || error?.toString().includes('429'))) {
      console.warn(`Gemini 429 Rate Limit. Retrying in ${delayMs}ms...`);
      await delay(delayMs);
      return retry(fn, retries - 1, delayMs * 2); 
    }
    throw error;
  }
}

/**
 * ROBUSTNESS LAYER:
 * Tries to use the primary (High-Fidelity) model first.
 * If it fails with 403 (Permission) or 404 (Not Found), falls back to the Flash (Standard) model.
 */
async function generateContentWithFallback(
    params: any, 
    primaryModel: string, 
    fallbackModel: string
): Promise<GenerateContentResponse> {
    const ai = getAiClient();
    try {
        return await retry(() => ai.models.generateContent({
            ...params,
            model: primaryModel
        }));
    } catch (e: any) {
        const errStr = JSON.stringify(e);
        const isPermissionError = e.status === 403 || errStr.includes('403') || errStr.includes('PERMISSION_DENIED');
        const isNotFoundError = e.status === 404 || errStr.includes('404') || errStr.includes('NOT_FOUND');
        
        if (isPermissionError || isNotFoundError) {
            console.warn(`[Gemini Service] Model '${primaryModel}' inaccessible (${e.status}). Falling back to '${fallbackModel}'.`);
            return await retry(() => ai.models.generateContent({
                ...params,
                model: fallbackModel
            }));
        }
        throw e;
    }
}

// -- EDGE COMPUTING SIMULATION --
export const localHeuristicCheck = (readings: SensorReading[], thresholds: any): string | null => {
    if (!readings || readings.length < 10) return null;
    const latest = readings[readings.length - 1];
    
    // Dead Sensor Check
    if (latest.vibration === 0 && latest.temperature === 0 && latest.powerUsage === 0) {
        return "CRITICAL: Sensor Failure detected. Telemetry stream is flatlined. Check connection.";
    }

    // Safety Cutoffs
    if (latest.vibration > (thresholds?.vibration || 8.5)) return "CRITICAL: Vibration exceeds safety limits (ISO 10816 Zone D). Possible Misalignment or Bearing Failure.";
    if (latest.temperature > (thresholds?.temperature || 95)) return "CRITICAL: Core overheating detected. Fire hazard. Possible Lubrication Failure.";

    // Statistical Anomaly (True Z-Score Analysis)
    const recentVibs = readings.slice(-20).map(r => r.vibration);
    const mean = recentVibs.reduce((a, b) => a + b, 0) / recentVibs.length;
    
    // Calculate Standard Deviation (Sigma)
    const variance = recentVibs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentVibs.length;
    const stdDev = Math.sqrt(variance);

    // Calculate Z-Score: (Value - Mean) / StdDev
    const zScore = stdDev === 0 ? 0 : (latest.vibration - mean) / stdDev;

    // Threshold: 3 Sigma (99.7% confidence interval deviation)
    if (Math.abs(zScore) > 3.0) {
         return `WARNING: Statistical anomaly detected. Z-Score ${zScore.toFixed(2)} (> 3σ). Check for transient shocks.`;
    }

    return null;
};

// Analyze raw textual sensor data AND human logs
export const analyzeMachineHealth = async (
  machine: Machine,
  recentReadings: SensorReading[],
  recentLogs: LogEntry[] = [],
  customThresholds?: { vibration: number; temperature: number; noise: number }
): Promise<string> => {
  
  const localInsight = localHeuristicCheck(recentReadings, customThresholds);
  
  // STRATEGY: Hybrid Compute Circuit Breaker
  if (localInsight && localInsight.includes("CRITICAL")) {
      return `[Automated Protection System]: ${localInsight}`;
  }

  // FALLBACK FOR DEMO IF NO KEY
  if (IS_MOCK_MODE) {
      await delay(1500);
      return "AI SIMULATION: Detected irregular oscillation in the X-Axis stepper motor. Recommendation: Inspect coupler alignment and lubricate guide rails.";
  }

  // STRATEGY: Token Topology Compression (CSV Density Packing)
  const header = "Time|Vib|Temp|Noise|RPM|Out";
  const readingsCsv = recentReadings.slice(-50).map(r => 
    `${new Date(r.timestamp).toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}|${r.vibration.toFixed(1)}|${r.temperature.toFixed(0)}|${r.noise.toFixed(0)}|${r.rpm.toFixed(0)}|${r.productionRate.toFixed(0)}`
  ).join('\n');

  const logsSummary = recentLogs.length > 0 
    ? recentLogs.slice(0, 3).map(l => `[${l.type}]: ${l.content}`).join('\n')
    : "No logs.";

  const prompt = `
    Role: Senior Industrial Reliability Engineer.
    Task: Analyze telemetry for machine: "${machine.name}" (${machine.type}).
    
    Data Format: ${header}
    ${readingsCsv}
    
    Logs:
    ${logsSummary}
    
    ${localInsight ? `Local Flag: ${localInsight}` : ''}

    Rules:
    1. Identify failure modes (Bearing, Motor, Alignment, Thermal, Electronics).
    2. If all data is within normal bounds (Vib<5, Temp<80), output exactly: "System Nominal".
    3. Be concise (max 40 words). Focus on Root Cause.
  `;

  try {
    // FALLBACK: If 3-Pro (Preview) is 403 Forbidden, use 2.5-Flash (Standard)
    const response = await generateContentWithFallback(
        { contents: prompt },
        'gemini-3-pro-preview',
        'gemini-2.5-flash'
    );
    return response.text || "Analysis unavailable.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Error connecting to Cloud AI service.";
  }
};

export const analyzeAttachedImage = async (
    machineName: string, 
    base64Image: string, 
    mimeType: string,
    currentDiagnosis: string
) => {
    if (IS_MOCK_MODE) {
        await delay(2000);
        return {
            analysis: "SIMULATION: Visual inspection confirms oxidation on the bearing housing consistent with the vibration alerts.",
            issueDetected: true,
            boundingBox: [300, 400, 600, 700]
        };
    }

    const prompt = `
        Context: Machine '${machineName}'. Diagnosis: "${currentDiagnosis}".
        Task: Verify diagnosis visually. 
        Output JSON: { "analysis": "string", "issueDetected": boolean, "boundingBox": [ymin, xmin, ymax, xmax] (0-1000) }
    `;

    try {
        // FALLBACK: If 3-Pro is 403, use 2.5-Flash
        const response = await generateContentWithFallback(
            {
                contents: {
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType, data: base64Image } }
                    ]
                },
                config: { responseMimeType: "application/json" }
            },
            'gemini-3-pro-preview',
            'gemini-2.5-flash'
        );
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        return { analysis: "Visual analysis failed.", issueDetected: false, boundingBox: null };
    }
};

export const generateMaintenancePlan = async (alertMessage: string, machineContext: string) => {
    // STRATEGY: Logical Circuit Breaker
    if (alertMessage.includes("System Nominal") || alertMessage.includes("No issues") || alertMessage.includes("Normal")) {
        return {
            diagnosis: "System Nominal",
            urgency: "Low",
            repairSteps: ["Routine monitoring only.", "No maintenance actions required."],
            requiredTools: "None",
            visualDefectCues: "", // Empty cues prevents image generation in the UI
            visualGoldenCues: "",
            confidenceScore: 100
        };
    }

    if (IS_MOCK_MODE) {
        await delay(1000);
        return {
            diagnosis: "Stepper Motor Misalignment",
            urgency: "High",
            repairSteps: [
                "Lockout/Tagout the main power supply.",
                "Remove the X-Axis motor housing cover.",
                "Realign using a dial indicator.",
                "Retighten bolts to 45Nm torque.",
                "Run calibration."
            ],
            requiredTools: "Hex Key Set, Dial Indicator",
            visualDefectCues: "The motor coupler will show visible gaps or angular offset.",
            visualGoldenCues: "Perfectly aligned motor shaft and lead screw with flush coupling.",
            confidenceScore: 92
        };
    }

    const prompt = `
        Context: Machine ${machineContext}, Issue: "${alertMessage}".
        Task: Generate JSON maintenance plan.
        
        Fields:
        - visualDefectCues: Vivid visual description of damage (e.g. "burnt wiring, cracked steel").
        - visualGoldenCues: Vivid visual description of perfect part.
        - confidenceScore: 0-100 based on data clarity.
    `;

    try {
        // FALLBACK: Use 3-Pro, fallback to 2.5-Flash (supports responseSchema)
        const response = await generateContentWithFallback(
            {
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            diagnosis: { type: Type.STRING },
                            urgency: { type: Type.STRING, enum: ["Low", "Medium", "High", "Immediate"] },
                            repairSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                            requiredTools: { type: Type.STRING },
                            visualDefectCues: { type: Type.STRING, description: "Visual description of the damage for image generation." },
                            visualGoldenCues: { type: Type.STRING, description: "Visual description of the perfect part." },
                            confidenceScore: { type: Type.NUMBER, description: "Confidence score 0-100." }
                        }
                    }
                }
            },
            'gemini-3-pro-preview',
            'gemini-2.5-flash'
        );
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        return { diagnosis: "Unknown Issue", repairSteps: ["Inspect manually"], urgency: "Medium", confidenceScore: 0 };
    }
};

export const generateVisualSimulation = async (
    machineInfo: string, 
    context: string, 
    mode: 'golden_sample' | 'defect_current' | 'repair_step',
    stepDetail?: string
): Promise<string | null> => {
    
    // STRATEGY: Gatekeeper
    if (!context || context.length < 5 || context === "System Nominal") return null;

    if (IS_MOCK_MODE) return null; 

    let prompt = "";
    const NEGATIVE_PROMPT = "Exclude: people, text, watermark, blueprint."; 
    const STYLE_GUIDE = "Style: 8k Macro Photography, Industrial.";

    switch(mode) {
        case 'golden_sample':
            prompt = `Factory-new spare part for ${machineInfo}. ${context}. Pristine, metal, perfect.`;
            break;
        case 'defect_current':
            prompt = `Damaged component on ${machineInfo}. ${context}. Broken, worn, oxidized.`;
            break;
        case 'repair_step':
            prompt = `Action shot maintenance on ${machineInfo}. ${stepDetail}. Tools, gloved hands.`;
            break;
    }

    try {
        // FALLBACK: Try gemini-2.5-flash-image (Preview). If 403/404, fallback to 2.5-Flash-Image (Standard)
        const response = await generateContentWithFallback(
            {
                contents: { parts: [{ text: `${prompt} ${STYLE_GUIDE} ${NEGATIVE_PROMPT}` }] },
                config: { imageConfig: { aspectRatio: "16:9" } }
            },
            'gemini-2.5-flash-image', // REPLACED gemini-3-pro-image-preview
            'gemini-2.5-flash-image'
        );

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return null;
    } catch (e) {
        console.error("Image generation error:", e);
        return null;
    }
};

export const analyzeAudioSignature = async (machineType: string, base64Audio: string, mimeType: string = "audio/webm") => {
    if (IS_MOCK_MODE) {
        await delay(2000);
        return { classification: "Bearing Inner Race Fault", confidence: "92%", description: "High frequency impacting detected at 3.2kHz indicating metal-on-metal contact." };
    }
    const prompt = `Analyze this ${machineType} audio. Return JSON with 'classification', 'confidence', 'description'.`;
    try {
        // FALLBACK: Use 3-Pro, fallback to 2.5-Flash
        const response = await generateContentWithFallback(
            {
                contents: {
                    parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Audio } }]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            classification: { type: Type.STRING },
                            confidence: { type: Type.STRING },
                            description: { type: Type.STRING }
                        }
                    }
                }
            },
            'gemini-3-pro-preview',
            'gemini-2.5-flash'
        );
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        return { classification: "Analysis Error", confidence: "0%", description: "Audio processing failed." };
    }
};

export const transcribeAudioLog = async (base64Audio: string, mimeType: string = "audio/webm"): Promise<string> => {
    if (IS_MOCK_MODE) return "Simulation: Operator log transcription unavailable without API key.";
    try {
        const ai = getAiClient();
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash', // Use Flash by default for simple transcription
            contents: {
                parts: [{ text: "Transcribe audio." }, { inlineData: { mimeType, data: base64Audio } }]
            }
        }));
        return response.text || "";
    } catch (e) { return ""; }
};