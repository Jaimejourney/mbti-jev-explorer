const UPSTREAM = "https://api.typesafe.ai/v1/systemone";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    response.status(500).json({
      detail: {
        error_type: "configuration_error",
        message: "Missing TYPESAFE_API_KEY environment variable."
      }
    });
    return;
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request.body)
    });
    const data = await upstream.text();
    response.status(upstream.status).send(data);
  } catch (error) {
    response.status(502).json({
      detail: {
        error_type: "proxy_error",
        message: error.message
      }
    });
  }
}
