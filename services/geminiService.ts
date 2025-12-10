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

// -- EDGE COMPUTING SIMULATION --
const localHeuristicCheck = (readings: SensorReading[], thresholds: any): string | null => {
    if (readings.length < 5) return null;
    const latest = readings[readings.length - 1];
    
    if (latest.vibration > (thresholds?.vibration || 8.5)) return "CRITICAL FAILURE: Vibration exceeds safety limits. Immediate shutdown recommended.";
    if (latest.temperature > (thresholds?.temperature || 95)) return "CRITICAL FAILURE: Core overheating detected. Fire hazard.";

    const recentTemps = readings.slice(-5).map(r => r.temperature);
    const isRising = recentTemps.every((val, i, arr) => i === 0 || val >= arr[i - 1]);
    const totalRise = recentTemps[4] - recentTemps[0];
    
    if (isRising && totalRise > 5) return "WARNING: Rapid temperature increase detected (+5°C in last 10s). Check coolant flow.";

    return null;
};

// Analyze raw textual sensor data to find hidden patterns
export const analyzeMachineHealth = async (
  machine: Machine,
  recentReadings: SensorReading[],
  customThresholds?: { vibration: number; temperature: number; noise: number }
): Promise<string> => {
  
  const localInsight = localHeuristicCheck(recentReadings, customThresholds);
  if (localInsight) {
      return `[Automated Local Analysis]: ${localInsight}`;
  }

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
 * Generates technical imagery to help operators visualize the problem.
 * 
 * Modes:
 * 1. 'failure': Photorealistic rendering of the internal damage (e.g., rusted bearings).
 * 2. 'thermal': Simulated thermal camera view highlighting hot spots.
 * 3. 'diagram': Exploded view technical drawing of the specific component.
 */
export const generateVisualSimulation = async (
    machineName: string, 
    issueDescription: string, 
    mode: 'failure' | 'thermal' | 'diagram'
): Promise<string | null> => {
    
    let prompt = "";
    
    switch(mode) {
        case 'failure':
            prompt = `Photorealistic macro photography of internal components of a ${machineName}, showing severe damage: ${issueDescription}. Industrial lighting, grime, realistic texture, high detail, 4k.`;
            break;
        case 'thermal':
            prompt = `Thermal camera heatmap visualization of a ${machineName}, indicating extreme heat (red/white) caused by ${issueDescription}. Dark blue background for cold areas, accurate industrial thermal imaging style.`;
            break;
        case 'diagram':
            prompt = `Technical blueprint illustration, exploded view of ${machineName}, highlighting the component related to: ${issueDescription}. White lines on blue background, schematic style, engineering diagram.`;
            break;
    }

    try {
        // We use gemini-2.5-flash-image for fast generation, or gemini-3-pro-image-preview for high fidelity
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

        // Extract base64 image
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