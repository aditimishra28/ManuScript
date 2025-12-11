import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Machine, SensorReading, LogEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// -- SAFETY & COMPLIANCE LAYER --
// Pre-flight check to prevent injection attacks or non-industrial usage
const FORBIDDEN_KEYWORDS = ['weapon', 'violence', 'blood', 'human face', 'child', 'political', 'hate'];
const INDUSTRIAL_CONTEXT_ENFORCER = "Focus strictly on industrial machinery, mechanical failure modes, and engineering diagrams. Do not depict people.";

const validatePromptSafety = (prompt: string): boolean => {
    const lower = prompt.toLowerCase();
    return !FORBIDDEN_KEYWORDS.some(kw => lower.includes(kw));
};

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to retry failed requests (e.g. 429 Rate Limit)
async function retry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error?.status === 429 || error?.toString().includes('429'))) {
      console.warn(`Gemini 429 Rate Limit. Retrying in ${delayMs}ms...`);
      await delay(delayMs);
      return retry(fn, retries - 1, delayMs * 2); // Exponential backoff
    }
    throw error;
  }
}

// -- EDGE COMPUTING SIMULATION (TIER 1 ANALYSIS) --
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
    
    // 1. Hard Threshold Checks
    if (latest.vibration > (thresholds?.vibration || 8.5)) return "CRITICAL: Vibration exceeds safety limits (ISO 10816 Zone D). Immediate shutdown recommended.";
    if (latest.temperature > (thresholds?.temperature || 95)) return "CRITICAL: Core overheating detected. Fire hazard.";

    // 2. Statistical Anomaly Detection
    const recentVibs = readings.slice(-20).map(r => r.vibration);
    const zScoreVib = calculateZScore(latest.vibration, recentVibs);
    
    if (Math.abs(zScoreVib) > 3.5) {
        return `WARNING: Statistical anomaly detected (Z-Score: ${zScoreVib.toFixed(1)}). Vibration is deviating significantly from the running average.`;
    }

    // 3. Trend Analysis
    const recentTemps = readings.slice(-10).map(r => r.temperature);
    const first = recentTemps[0];
    const last = recentTemps[recentTemps.length - 1];
    if (last - first > 5) {
        return "WARNING: Rapid thermal runaway detected (+5°C delta). Check coolant flow.";
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
  
  // If Edge layer detects critical failure, return immediately (Speed > AI)
  if (localInsight && localInsight.includes("CRITICAL")) {
      return `[Automated Protection System]: ${localInsight}`;
  }

  const readingsSummary = recentReadings.slice(-10).map(r => 
    `Time: ${new Date(r.timestamp).toLocaleTimeString()}, Vib: ${r.vibration.toFixed(2)}, Temp: ${r.temperature.toFixed(1)}, Noise: ${r.noise.toFixed(1)}`
  ).join('\n');

  // Format logs for context
  const logsSummary = recentLogs.length > 0 
    ? recentLogs.slice(0, 5).map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.author} (${l.type}): ${l.content}`).join('\n')
    : "No recent operator notes.";

  const context = customThresholds 
    ? `
    - Dynamic Vibration Limit: < ${customThresholds.vibration.toFixed(2)} mm/s
    - Dynamic Temperature Limit: < ${customThresholds.temperature.toFixed(1)} °C
    - Dynamic Noise Limit: < ${customThresholds.noise.toFixed(1)} dB
    `
    : `
    - Normal Vibration: < 5.0 mm/s
    - Normal Temperature: < 80°C
    - Normal Noise: < 85 dB
    `;

  const prompt = `
    You are an expert industrial reliability engineer AI (Gemini).
    Analyze the machine health by cross-referencing Sensor Telemetry with Operator Observations.

    Machine: "${machine.name}" (${machine.type}).
    
    Context Limits:
    ${context}

    recent_sensor_telemetry (Last 10 points):
    ${readingsSummary}
    
    recent_operator_logs (Human Context):
    ${logsSummary}
    
    ${localInsight ? `Local Algorithm Flag: ${localInsight}` : ''}

    Task:
    1. Compare readings against limits.
    2. IMPORTANT: Check if operator logs (e.g., "grinding sound", "smell of smoke") correlate with sensor trends. 
    3. If a human reported an issue and sensors confirm it, escalate the urgency.
    
    SAFETY PROTOCOL:
    - Do NOT recommend overriding safety interlocks.
    - If specific failure mode is unknown, recommend manual inspection.
    - Append standard disclaimer: "AI generated insight. Verify before maintenance."

    Output:
    Provide a concise technical assessment (under 100 words). Mention if you used the operator's log in your deduction.
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

// Structured analysis for alerts
export const generateMaintenancePlan = async (alertMessage: string, machineContext: string) => {
    const prompt = `
        Context: Machine ${machineContext} has triggered an alert: "${alertMessage}".
        Generate a structured JSON response with a diagnosis, recommended action, and urgency level.
        
        SAFETY RULES:
        - Recommendation must follow standard LOTO (Lockout/Tagout) procedures.
        - Urgency must be High if temperature > 100C or Vibration > 10mm/s.
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
                        recommendation: { type: Type.STRING },
                        urgency: { type: Type.STRING, enum: ["Low", "Medium", "High", "Immediate"] }
                    }
                }
            }
        }));
        
        const text = response.text || "{}";
        const cleanJson = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error("Plan generation failed", e);
        return { diagnosis: "Unknown Issue", recommendation: "Manual inspection required", urgency: "Medium" };
    }
};

/**
 * FEATURE 1: Acoustic Anomaly Detection (Shazam for Machines)
 */
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
        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("Audio analysis failed", e);
        return { 
            classification: "Analysis Error", 
            confidence: "0%", 
            description: "Could not process audio stream." 
        };
    }
};

/**
 * FEATURE 2: Contextual Voice Logbook (Voice-to-Text)
 */
export const transcribeAudioLog = async (base64Audio: string, mimeType: string = "audio/webm"): Promise<string> => {
    const prompt = `
        You are a manufacturing log assistant. 
        Transcribe the following voice note from an operator accurately. 
        Remove filler words (um, uh). 
        Format technical terms correctly (e.g., '500 PSI', 'bearing 2B').
        Return ONLY the transcribed text.
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
            }
        }));
        return response.text || "";
    } catch (e) {
        console.error("Transcription failed", e);
        return "";
    }
};

/**
 * VISUAL SIMULATION ENGINE - UPDATED FOR 5 PAIN POINTS
 */
export const generateVisualSimulation = async (
    machineName: string, 
    issueDescription: string, 
    mode: 'golden_sample' | 'consequence' | 'loto_overlay' | 'ghost_view' | 'synthetic_training',
    customPromptOverride?: string
): Promise<string | null> => {
    
    // 1. Safety Guardrail
    if (customPromptOverride && !validatePromptSafety(customPromptOverride)) {
        console.warn("Safety Block: Custom prompt contained restricted keywords.");
        return null; // Fail gracefully
    }

    let prompt = "";

    // If a specific visual prompt is provided (e.g. from the JSON steps), use it.
    if (customPromptOverride) {
        prompt = `Industrial technical illustration: ${customPromptOverride}. High definition, professional context.`;
    } else {
        switch(mode) {
            case 'golden_sample':
                prompt = `Golden Sample Reference: Photorealistic, high-resolution product photography of a brand new, pristine ${machineName} component related to ${issueDescription}. 
                Perfect condition, clean metallic surfaces, factory lighting, no wear, no rust, no oil. Use a neutral studio background.`;
                break;
                
            case 'consequence':
                prompt = `Simulation of Catastrophic Failure: Photorealistic industrial image of a ${machineName} component that has been severely damaged due to neglected ${issueDescription}. 
                Show extreme wear, seized bearings turned black, heavy rust, structural cracks, metal shavings, and smoke residue. Dramatic warning visualization.`;
                break;
                
            case 'loto_overlay':
                prompt = `Industrial Safety Visualization: A photo of a ${machineName} panel or piping system. 
                OVERLAY: Highlight specific isolation valves and electrical breakers in GLOWING RED and GREEN outlines. 
                Add floating 'LOCKED' tag icons. The image should clearly indicate where to place physical locks for Lockout/Tagout (LOTO). High contrast.`;
                break;
                
            case 'ghost_view':
                prompt = `Technical 'Ghost View' Illustration: A semi-transparent X-Ray view of a ${machineName} housing related to ${issueDescription}. 
                Show the external casing as transparent glass/wireframe, revealing the internal mounting bolts, clips, and gears inside. 
                Engineering blueprint style, blue and white, high technical detail for assembly guidance.`;
                break;
                
            case 'synthetic_training':
                prompt = `Industrial Training Scenario: A photorealistic simulation of a rare failure mode on a ${machineName}. 
                Depict: ${issueDescription}. 
                The image should be realistic enough to train a new operator on what to look for. Detailed textures of leakage, smoke, or misalignment.`;
                break;
        }
    }

    // MANDATORY SAFETY OVERRIDE FOR IMAGEN
    prompt += ` ${INDUSTRIAL_CONTEXT_ENFORCER} The image must not depict real people injured. Focus purely on mechanical equipment damage.`;

    try {
        const response = await retry<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }]
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