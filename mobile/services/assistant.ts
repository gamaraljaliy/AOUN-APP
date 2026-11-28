import type { Place } from "./places";

export type ChatResponse = {
  intent: "search" | "clarify" | "out_of_scope";
  message: string;
  required_facilities: string[];
  total?: number;
  places: Place[];
};

const base = process.env.EXPO_PUBLIC_API_URL
  ?.replace(/\/$/, "");

export async function sendMessage(
  message: string
): Promise<ChatResponse> {
  if (!base) {
    throw new Error("Missing API URL");
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(), 30000
  );

  try {
    const response = await fetch(`${base}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

 if (!response.ok) {
  const details = await response.text();

  console.error("Assistant API:", response.status, details);

  throw new Error(`Assistant API error: ${response.status}`);
}
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}