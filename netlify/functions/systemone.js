const UPSTREAM = "https://api.typesafe.ai/v1/systemone";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        detail: {
          error_type: "configuration_error",
          message: "Missing TYPESAFE_API_KEY environment variable."
        }
      })
    };
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: event.body
    });
    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: text
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        detail: {
          error_type: "proxy_error",
          message: error.message
        }
      })
    };
  }
};
