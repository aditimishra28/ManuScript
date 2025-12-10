import { GoogleGenAI, Type } from "@google/genai";
import { Machine, SensorReading } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Analyze raw textual sensor data to find hidden patterns
export const analyzeMachineHealth = async (
  machine: Machine,
  recentReadings: SensorReading[]
): Promise<string> => {
  
  const readingsSummary = recentReadings.slice(-10).map(r => 
    `Time: ${new Date(r.timestamp).toLocaleTimeString()}, Vib: ${r.vibration.toFixed(2)}, Temp: ${r.temperature.toFixed(1)}, Noise: ${r.noise.toFixed(1)}`
  ).join('\n');

  const prompt = `
    You are an expert industrial reliability engineer AI.
    Analyze the following recent sensor telemetry for machine "${machine.name}" (${machine.type}).
    
    Context:
    - Normal Vibration: < 5.0 mm/s
    - Normal Temperature: < 80°C
    - Normal Noise: < 85 dB

    Recent Readings (Last 10 points):
    ${readingsSummary}

    Task:
    1. Identify any trends (e.g., rising temperature, oscillating vibration).
    2. Predict potential failures (e.g., bearing wear, loose mounting, lubrication breakdown).
    3. Provide a concise status report.
    
    Keep the response under 100 words. Focus on technical accuracy.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Analysis unavailable.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Error connecting to AI analysis service.";
  }
};

// Structured analysis for alerts
export const generateMaintenancePlan = async (alertMessage: string, machineContext: string) => {
    const prompt = `
        Context: Machine ${machineContext} has triggered an alert: "${alertMessage}".
        Generate a structured JSON response with a diagnosis, recommended action, and urgency level.
    `;

    try {
        const response = await ai.models.generateContent({
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
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("Plan generation failed", e);
        return { diagnosis: "Unknown", recommendation: "Check manually", urgency: "Medium" };
    }
}
