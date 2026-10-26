import { apiBaseUrl } from "./apiBaseUrl";

export type ConnectionExplanation = {
  explanation: string;
  generated: boolean;
  evidence: { kind: string; label: string; value: string }[];
};

export async function explainConnection(token: string, sourceId: string, targetId: string) {
  const response = await fetch(`${apiBaseUrl}/ai/connection-explanation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Explanation request failed (${response.status}).`);
  }
  return response.json() as Promise<ConnectionExplanation>;
}
