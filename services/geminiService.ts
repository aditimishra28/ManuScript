import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Machine, SensorReading, LogEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// -- SAFETY & COMPLIANCE LAYER --
const FORBIDDEN_KEYWORDS = ['weapon', 'violence', 'blood', 'human face', 'child', 'political', 'hate', 'flesh', 'animal'];
const INDUSTRIAL_CONTEXT_ENFORCER = "CONTEXT: Industrial manufacturing environment only. No organic matter. No text overlays. No artistic abstractions.";

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to clean JSON string from Markdown wrapping
const cleanJson = (text: string): string => {
    if (!text) return "{}";
    return text.replace(/```json|```/g, '').trim();
};

// Helper to retry failed requests
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
const calculateZScore = (value: number, history: number[]): number => {
    if (history.length < 5) return 0;
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const stdDev = Math.sqrt(history.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / history.length);
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
};

const localHeuristicCheck = (readings: SensorReading[], thresholds: any): string | null => {
    if (readings.length < 10) return null;
    const latest = readings[readings.length - 1];
    
    if (latest.vibration > (thresholds?.vibration || 8.5)) return "CRITICAL: Vibration exceeds safety limits (ISO 10816 Zone D). Immediate shutdown recommended.";
    if (latest.temperature > (thresholds?.temperature || 95)) return "CRITICAL: Core overheating detected. Fire hazard.";

    const recentVibs = readings.slice(-20).map(r => r.vibration);
    const zScoreVib = calculateZScore(latest.vibration, recentVibs);
    
    if (Math.abs(zScoreVib) > 3.5) {
        return `WARNING: Statistical anomaly detected (Z-Score: ${zScoreVib.toFixed(1)}). Vibration is deviating significantly from the running average.`;
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

  const readingsSummary = recentReadings.slice(-10).map(r => 
    `Time: ${new Date(r.timestamp).toLocaleTimeString()}, Vib: ${r.vibration.toFixed(2)}, Temp: ${r.temperature.toFixed(1)}, Noise: ${r.noise.toFixed(1)}`
  ).join('\n');

  const logsSummary = recentLogs.length > 0 
    ? recentLogs.slice(0, 5).map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.author} (${l.type}): ${l.content}`).join('\n')
    : "No recent operator notes.";

  const prompt = `
    You are an expert industrial reliability engineer AI (Gemini).
    Analyze the machine health by cross-referencing Sensor Telemetry with Operator Observations.
    Machine: "${machine.name}" (${machine.type}).
    
    Data:
    ${readingsSummary}
    
    Logs:
    ${logsSummary}
    
    ${localInsight ? `Local Algorithm Flag: ${localInsight}` : ''}

    Task:
    Analyze patterns. If a failure is detected, identify the SPECIFIC component responsible (e.g. "Inner Race Bearing", "Coolant Pump Impeller", "Axis Lead Screw").
    
    Output:
    Concise technical assessment (under 50 words). Focus on root cause component.
  `;

  try {
    const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    }));
    return response.text || "Analysis unavailable.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Error connecting to Cloud AI service.";
  }
};

/**
 * NEW FEATURE: MULTIMODAL VISION INSPECTION
 * Allows the operator to upload a photo, and Gemini analyzes it alongside sensor data.
 * Returns structured JSON with bounding boxes.
 */
export const analyzeAttachedImage = async (
    machineName: string, 
    base64Image: string, 
    mimeType: string,
    currentDiagnosis: string
) => {
    const prompt = `
        You are a Senior Industrial Mechanic. 
        Context: The machine '${machineName}' is flagging sensor alerts with the diagnosis: "${currentDiagnosis}".
        
        Task:
        Analyze the attached photo of the actual machine component.
        1. Identify the specific part in the image that corresponds to the diagnosis.
        2. Verify if visual evidence (rust, leaks, cracks, discoloration, or misalignment) matches the sensor data.
        
        Output:
        Return a JSON object with this schema:
        {
            "analysis": "Short direct observation for the operator.",
            "issueDetected": boolean,
            "boundingBox": [ymin, xmin, ymax, xmax] // Array of 4 integers (0-1000 scale) outlining the specific defective component. If no specific defect is visible, return null.
        }
    `;

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType, data: base64Image } }
                ]
            },
            config: {
                responseMimeType: "application/json"
            }
        }));
        
        const rawText = response.text || "{}";
        return JSON.parse(cleanJson(rawText));
    } catch (e) {
        console.error("Vision analysis failed", e);
        return { analysis: "Visual analysis failed.", issueDetected: false, boundingBox: null };
    }
};

// Structured analysis for alerts + REPAIR STEPS
export const generateMaintenancePlan = async (alertMessage: string, machineContext: string) => {
    const prompt = `
        Context: Machine ${machineContext} has a diagnosed issue: "${alertMessage}".
        Generate a structured maintenance plan.
        
        Requirements:
        1. Diagnosis: What is wrong? Be precise (e.g. "Misalignment of Coupler").
        2. Repair Steps: 3-5 distinct, physical actions. Use imperative verbs (e.g. "Loosen", "Align", "Lubricate"). Mention specific tools in the step description.
        3. Tooling: List required tools.
    `;

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        diagnosis: { type: Type.STRING },
                        urgency: { type: Type.STRING, enum: ["Low", "Medium", "High", "Immediate"] },
                        repairSteps: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: "Step-by-step repair instructions including tool usage"
                        },
                        requiredTools: { type: Type.STRING }
                    }
                }
            }
        }));
        
        const rawText = response.text || "{}";
        return JSON.parse(cleanJson(rawText));
    } catch (e) {
        console.error("Plan generation failed", e);
        return { diagnosis: "Unknown Issue", repairSteps: ["Inspect manually"], urgency: "Medium" };
    }
};

/**
 * VISUAL SIMULATION ENGINE (ANTI-HALLUCINATION ENHANCED)
 */
export const generateVisualSimulation = async (
    machineInfo: string, 
    context: string, 
    mode: 'golden_sample' | 'defect_current' | 'repair_step',
    stepDetail?: string
): Promise<string | null> => {
    
    let prompt = "";
    const NEGATIVE_PROMPT = "Exclude: people faces, human bodies, animals, biological matter, artistic abstraction, blur, low resolution, text overlays, watermarks, cartoon style.";
    const STYLE_GUIDE = "Style: Photorealistic Industrial Macro Photography. Lighting: Neutral studio lighting, high contrast, sharp focus on mechanical details. Texture: Metallic, grease, rust, rubber, steel.";

    switch(mode) {
        case 'golden_sample':
            prompt = `Reference Image: A brand new, factory-perfect replacement part for a ${machineInfo}. 
            Component Context: ${context}. 
            Visuals: Clean metal, perfect alignment, no wear, no dust, no rust. 
            View: Isometric or top-down engineering view.`;
            break;
            
        case 'defect_current':
            prompt = `Failure Analysis Image: A close-up of a damaged component on a ${machineInfo}. 
            Diagnosis: ${context}.
            Visuals: Depict specific signs of failure such as heat discoloration (blueing), metal shavings, heavy rust, cracking, or severe misalignment. 
            The image should serve as visual evidence of the breakdown.`;
            break;
            
        case 'repair_step':
            prompt = `Technical Maintenance Guide: A step-by-step visual instruction for ${machineInfo}.
            Action: "${stepDetail}".
            Visuals: Show the specific machine part and the required tool (e.g., wrench, screwdriver, multimeter) in position. 
            View: Close-up action shot. Clear separation between part and tool.`;
            break;
    }

    const finalPrompt = `${prompt} ${INDUSTRIAL_CONTEXT_ENFORCER} ${STYLE_GUIDE} ${NEGATIVE_PROMPT}`;

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: finalPrompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "16:9", 
                    numberOfImages: 1
                }
            }
        }));

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (e) {
        console.error("Image generation failed", e);
        return null;
    }
};

// ... existing audio functions ...
export const analyzeAudioSignature = async (machineType: string, base64Audio: string, mimeType: string = "audio/webm") => {
    const prompt = `
      You are an Acoustic Engineer. Listen to this recording of a ${machineType}.
      Analyze the sound signature. Identify patterns like grinding, hissing, cavitation, or imbalance.
      Return a JSON with 'classification' (Normal, Bearing Fault, Gear Mesh, Loose Mount), 'confidence' (percentage), and a 'description' of the sound.
    `;

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            contents: {
                parts: [
                    { text: prompt },
                    { 
                        inlineData: {
                            mimeType: mimeType, 
                            data: base64Audio
                        }
                    }
                ]
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
        const rawText = response.text || "{}";
        return JSON.parse(cleanJson(rawText));
    } catch (e) {
        console.error("Audio analysis failed", e);
        return { 
            classification: "Analysis Error", 
            confidence: "0%", 
            description: "Could not process audio stream." 
        };
    }
};

export const transcribeAudioLog = async (base64Audio: string, mimeType: string = "audio/webm"): Promise<string> => {
    const prompt = `Transcribe this operator voice log. Remove filler words. Return text only.`;
    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            contents: {
                parts: [
                    { text: prompt },
                    { 
                        inlineData: {
                            mimeType: mimeType, 
                            data: base64Audio
                        }
                    }
                ]
            }
        }));
        return response.text || "";
    } catch (e) { return ""; }
};