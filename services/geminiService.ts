import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Machine, SensorReading } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
// We use Statistical Process Control (SPC) concepts here (Z-Score).
// This runs locally in the browser to save API costs and latency.
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
    
    // 1. Hard Threshold Checks (Safety Limits)
    if (latest.vibration > (thresholds?.vibration || 8.5)) return "CRITICAL: Vibration exceeds safety limits (ISO 10816 Zone D). Immediate shutdown recommended.";
    if (latest.temperature > (thresholds?.temperature || 95)) return "CRITICAL: Core overheating detected. Fire hazard.";

    // 2. Statistical Anomaly Detection (Z-Score > 3 is a 99.7% outlier)
    const recentVibs = readings.slice(-20).map(r => r.vibration);
    const zScoreVib = calculateZScore(latest.vibration, recentVibs);
    
    if (Math.abs(zScoreVib) > 3.5) {
        return `WARNING: Statistical anomaly detected (Z-Score: ${zScoreVib.toFixed(1)}). Vibration is deviating significantly from the running average.`;
    }

    // 3. Trend Analysis (Simple Linear Regression Slope)
    const recentTemps = readings.slice(-10).map(r => r.temperature);
    const first = recentTemps[0];
    const last = recentTemps[recentTemps.length - 1];
    // If temp rose by more than 5 degrees in the last 10 ticks
    if (last - first > 5) {
        return "WARNING: Rapid thermal runaway detected (+5°C delta). Check coolant flow.";
    }

    return null;
};

// Analyze raw textual sensor data to find hidden patterns
export const analyzeMachineHealth = async (
  machine: Machine,
  recentReadings: SensorReading[],
  customThresholds?: { vibration: number; temperature: number; noise: number }
): Promise<string> => {
  
  // TIER 1: Run local math first. Fast, free, zero-latency.
  const localInsight = localHeuristicCheck(recentReadings, customThresholds);
  
  // Logic: If local insight finds a Critical issue, return immediately.
  // If it finds a Warning or Nothing, we MIGHT ask Gemini for a "Second Opinion" if it's a Warning,
  // but for "Normal" states, we skip the API call to save money.
  if (localInsight && localInsight.includes("CRITICAL")) {
      return `[Automated Protection System]: ${localInsight}`;
  }

  // If everything looks normal locally, we can return early or do a "random audit"
  // to save tokens. Here we only call Gemini if there is a warning OR randomly (10% chance) for routine checks.
  if (!localInsight && Math.random() > 0.1) {
      return "System operating within normal statistical parameters.";
  }

  // TIER 2: Gemini Cloud Analysis
  // Triggered for Warnings or Routine Audits
  const readingsSummary = recentReadings.slice(-10).map(r => 
    `Time: ${new Date(r.timestamp).toLocaleTimeString()}, Vib: ${r.vibration.toFixed(2)}, Temp: ${r.temperature.toFixed(1)}, Noise: ${r.noise.toFixed(1)}`
  ).join('\n');

  const context = customThresholds 
    ? `
    - Dynamic Vibration Limit: < ${customThresholds.vibration.toFixed(2)} mm/s (Based on historical pattern)
    - Dynamic Temperature Limit: < ${customThresholds.temperature.toFixed(1)} °C (Based on historical pattern)
    - Dynamic Noise Limit: < ${customThresholds.noise.toFixed(1)} dB (Based on historical pattern)
    `
    : `
    - Normal Vibration: < 5.0 mm/s
    - Normal Temperature: < 80°C
    - Normal Noise: < 85 dB
    `;

  const prompt = `
    You are an expert industrial reliability engineer AI.
    Analyze the following recent sensor telemetry for machine "${machine.name}" (${machine.type}).
    
    Context:
    ${context}

    Recent Readings (Last 10 points):
    ${readingsSummary}
    
    ${localInsight ? `Local Analysis Flag: ${localInsight}` : ''}

    Task:
    1. Compare readings against the provided limits.
    2. Identify any subtle non-linear trends.
    3. Predict potential failures.
    
    Keep the response under 100 words. Focus on technical accuracy.
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
        
        try {
            return JSON.parse(cleanJson);
        } catch (parseError) {
            console.warn("JSON Parse Failed for AI plan", parseError);
            return { 
                diagnosis: "Automated parsing failed.", 
                recommendation: "Review raw logs manually.", 
                urgency: "High" 
            };
        }
    } catch (e) {
        console.error("Plan generation failed", e);
        return { diagnosis: "Unknown Issue", recommendation: "Manual inspection required", urgency: "Medium" };
    }
};

/**
 * VISUAL SIMULATION ENGINE
 */
export const generateVisualSimulation = async (
    machineName: string, 
    issueDescription: string, 
    mode: 'failure' | 'thermal' | 'diagram' | 'part_detail' | 'repair_step'
): Promise<string | null> => {
    
    let prompt = "";
    
    switch(mode) {
        // STRATEGY 1: DIAGNOSTIC DIGITAL TWINS
        case 'failure':
            prompt = `Photorealistic macro photography of internal components of a ${machineName}, showing severe damage: ${issueDescription}. Industrial lighting, grime, realistic texture, high detail, 4k. Focus on the failure point.`;
            break;
        case 'thermal':
            prompt = `Thermal camera heatmap visualization of a ${machineName}, indicating extreme heat (red/white) caused by ${issueDescription}. Dark blue background for cold areas, accurate industrial thermal imaging style.`;
            break;
        case 'diagram':
            prompt = `Technical blueprint illustration, exploded view of ${machineName}, highlighting the component related to: ${issueDescription}. White lines on blue background, schematic style, engineering diagram.`;
            break;
            
        // STRATEGY 2: INTERVENTION & REPAIR VISUALS
        case 'part_detail':
            prompt = `Studio product photography of a heavy industrial spare part for a ${machineName}, specifically the component related to: ${issueDescription}. Clean white background, high resolution, industrial catalog style. Isolate the part.`;
            break;
        case 'repair_step':
            prompt = `Instructional technical illustration of a maintenance technician's hands using tools to fix ${issueDescription} on a ${machineName}. Blue and white vector line art style, IKEA manual aesthetic, clear action, safety gloves visible.`;
            break;
    }

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