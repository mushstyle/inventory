export async function createSession() {
  const response = await fetch(`https://www.browserbase.com/v1/sessions`, {
    method: "POST",
    headers: {
      "x-bb-api-key": `${process.env.BROWSERBASE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserSettings: {
        // Fingerprint options
        fingerprint: {
          devices: ["desktop"],
          locales: ["en-US"],
          operatingSystems: ["macos"],
        },
      },
    }),
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json;
}