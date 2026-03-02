export async function fetchHtml(url: URL): Promise<string> {
  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "recipe-viz/1.0",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
