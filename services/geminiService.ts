import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Machine, SensorReading, LogEntry } from "../types";

// CTO AUDIT FIX: Graceful handling of missing keys
const API_KEY = process.env.API_KEY || '';
const IS_MOCK_MODE = !API_KEY || API_KEY.includes('YOUR_KEY');

if (IS_MOCK_MODE) {
    console.warn("⚠️ SYSTEM WARNING: No valid Google GenAI API Key found. Running in simulation mode.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

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
  if (localInsight && localInsight.includes("CRITICAL")) {
      return `[Automated Protection System]: ${localInsight}`;
  }

  // FALLBACK FOR DEMO IF NO KEY
  if (IS_MOCK_MODE) {
      await delay(1500);
      return "AI SIMULATION: Detected irregular oscillation in the X-Axis stepper motor. Recommendation: Inspect coupler alignment and lubricate guide rails.";
  }

  const readingsSummary = recentReadings.slice(-50).map(r => 
    `Time: ${new Date(r.timestamp).toLocaleTimeString()}, Vib: ${r.vibration.toFixed(2)}, Temp: ${r.temperature.toFixed(1)}, Noise: ${r.noise.toFixed(1)}, RPM: ${r.rpm.toFixed(0)}, Output: ${r.productionRate}`
  ).join('\n');

  const logsSummary = recentLogs.length > 0 
    ? recentLogs.slice(0, 5).map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.author} (${l.type}): ${l.content}`).join('\n')
    : "No recent operator notes.";

  const prompt = `
    You are an expert industrial reliability engineer AI (Gemini 3 Pro).
    Analyze the machine health by cross-referencing Sensor Telemetry with Operator Observations.
    
    STRICT GROUNDING RULES:
    1. Only analyze the data provided below. Do not hallucinate external events or failure modes not supported by evidence.
    2. If the data indicates normal operation, state "System Nominal".
    3. Keep the diagnosis technical, concise, and professional.

    Machine: "${machine.name}" (${machine.type}).
    
    Data (Last 50 Points):
    ${readingsSummary}
    
    Logs:
    ${logsSummary}
    
    ${localInsight ? `Local Algorithm Flag: ${localInsight}` : ''}

    Task:
    Analyze patterns, noise, vibration, product output, alignment, bearing wear, motor failure, lubrication issues, electronic component failure, overheating, unexpected breakdowns, calibration drift, and sensor failure.
    If a failure is detected, identify the SPECIFIC component and the failure mode.
    
    Output:
    Concise technical assessment (under 50 words). Focus on root cause.
  `;

  try {
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview', // UPGRADED to Gemini 3 Pro for superior reasoning
      contents: prompt,
    }));
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
        You are a Senior Industrial Mechanic.
        Context: The machine '${machineName}' has diagnosis: "${currentDiagnosis}".
        Analyze the attached photo to verify this diagnosis.
        
        GROUNDING:
        - Only identify defects visible in the image.
        - If the image is unclear or shows no defects, state that.
        
        Output JSON:
        {
            "analysis": "Short observation.",
            "issueDetected": boolean,
            "boundingBox": [ymin, xmin, ymax, xmax] (0-1000 scale)
        }
    `;

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview', // UPGRADED to Gemini 3 Pro for multimodal vision analysis
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType, data: base64Image } }
                ]
            },
            config: { responseMimeType: "application/json" }
        }));
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        return { analysis: "Visual analysis failed.", issueDetected: false, boundingBox: null };
    }
};

export const generateMaintenancePlan = async (alertMessage: string, machineContext: string) => {
    if (IS_MOCK_MODE) {
        await delay(1000);
        return {
            diagnosis: "Stepper Motor Misalignment",
            urgency: "High",
            repairSteps: [
                "Lockout/Tagout the main power supply.",
                "Remove the X-Axis motor housing cover using a 4mm hex key.",
                "Loosen the motor mount bolts and realign using a dial indicator.",
                "Retighten bolts to 45Nm torque.",
                "Run calibration sequence."
            ],
            requiredTools: "Hex Key Set, Dial Indicator, Torque Wrench",
            visualDefectCues: "The motor coupler will show visible gaps or angular offset.",
            visualGoldenCues: "Perfectly aligned motor shaft and lead screw with flush coupling."
        };
    }

    const prompt = `
        Context: Machine ${machineContext}, Issue: "${alertMessage}".
        Generate structured maintenance plan.
        
        CRITICAL: Provide vivid visual descriptions for image generation.
        'visualDefectCues': Describe exactly what the damaged part looks like (e.g. "cracked casing", "burnt wiring").
        'visualGoldenCues': Describe exactly what the factory-new part looks like (e.g. "shiny metallic surface", "connected wire").
    `;

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview', // UPGRADED to Gemini 3 Pro for complex structured planning
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
                        visualDefectCues: { type: Type.STRING, description: "Visual description of the damage for image generation prompt." },
                        visualGoldenCues: { type: Type.STRING, description: "Visual description of the perfect part for image generation prompt." }
                    }
                }
            }
        }));
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        return { diagnosis: "Unknown Issue", repairSteps: ["Inspect manually"], urgency: "Medium" };
    }
};

export const generateVisualSimulation = async (
    machineInfo: string, 
    context: string, 
    mode: 'golden_sample' | 'defect_current' | 'repair_step',
    stepDetail?: string
): Promise<string | null> => {
    
    if (IS_MOCK_MODE) return null; // Cannot mock generated images

    let prompt = "";
    const NEGATIVE_PROMPT = "Exclude: people faces, human bodies, animals, biological matter, text, watermarks, cartoon, blueprint, schematics, white background.";
    const STYLE_GUIDE = "Style: 8k resolution, Photorealistic Industrial Macro Photography, Cinematic Lighting, Metallic Texture, Depth of Field.";

    switch(mode) {
        case 'golden_sample':
            // Context here should be the visualGoldenCues if available
            prompt = `Close-up macro photo of a factory-new spare part for ${machineInfo}. 
            Object Description: ${context}. 
            Condition: Pristine, clean metal, perfect engineering, no scratches, factory perfect.`;
            break;
        case 'defect_current':
            // Context here should be the visualDefectCues if available
            prompt = `Close-up macro photo of a damaged industrial component on ${machineInfo}. 
            Defect Description: ${context}. 
            Condition: Broken, worn, oxidized, burnt, or cracked. High contrast inspection light.`;
            break;
        case 'repair_step':
            prompt = `First-person view action shot of industrial maintenance on ${machineInfo}. 
            Action: "${stepDetail}". 
            Show: Professional tools, gloved hands (safety gear), mechanical parts.`;
            break;
    }

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Generating standard images
            contents: { parts: [{ text: `${prompt} ${INDUSTRIAL_CONTEXT_ENFORCER} ${STYLE_GUIDE} ${NEGATIVE_PROMPT}` }] },
            config: { imageConfig: { aspectRatio: "16:9" } }
        }));

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return null;
    } catch (e) {
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
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview', // UPGRADED to Gemini 3 Pro (supports Audio in standard generateContent)
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
        }));
        return JSON.parse(cleanJson(response.text || "{}"));
    } catch (e) {
        return { classification: "Analysis Error", confidence: "0%", description: "Audio processing failed." };
    }
};

export const transcribeAudioLog = async (base64Audio: string, mimeType: string = "audio/webm"): Promise<string> => {
    if (IS_MOCK_MODE) return "Simulation: Operator log transcription unavailable without API key.";
    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview', // UPGRADED to Gemini 3 Pro
            contents: {
                parts: [{ text: "Transcribe audio." }, { inlineData: { mimeType, data: base64Audio } }]
            }
        }));
        return response.text || "";
    } catch (e) { return ""; }
};