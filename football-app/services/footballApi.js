const DIRECT_BASE_URL = "https://api.football-data.org/v4";
const PROXY_BASE_URL = String(
  process.env.EXPO_PUBLIC_FOOTBALL_API_PROXY_URL || ""
).replace(/\/+$/, "");
const DEVELOPMENT_TOKEN =
  process.env.EXPO_PUBLIC_FOOTBALL_DATA_TOKEN || "";
const pendingGets = new Map();
const REQUEST_TIMEOUT = 12000;

function wait(milliseconds) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}

function providerPath(value) {
  const text = String(value || "");

  if (text.startsWith(DIRECT_BASE_URL)) {
    return text.slice(DIRECT_BASE_URL.length) || "/";
  }

  return text.startsWith("/") ? text : `/${text}`;
}

export function footballApiUrl(pathOrUrl) {
  const path = providerPath(pathOrUrl);
  return `${PROXY_BASE_URL || DIRECT_BASE_URL}${path}`;
}

export function isFootballApiConfigured() {
  return Boolean(PROXY_BASE_URL || DEVELOPMENT_TOKEN);
}

export async function footballFetch(pathOrUrl, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (!PROXY_BASE_URL) {
    if (!DEVELOPMENT_TOKEN) {
      throw new Error(
        "Football data is not configured. Set the production proxy URL."
      );
    }

    headers["X-Auth-Token"] = DEVELOPMENT_TOKEN;
  }

  const url = footballApiUrl(pathOrUrl);
  const requestKey =
    method === "GET" ? `${url}|${headers.Accept}` : null;

  if (requestKey && pendingGets.has(requestKey)) {
    return (await pendingGets.get(requestKey)).clone();
  }

  const request = (async () => {
    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = options.signal
        ? null
        : new AbortController();
      const timeout = controller
        ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
        : null;

      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: options.signal || controller?.signal,
        });

        if (
          method !== "GET" ||
          attempt === 1 ||
          response.status === 429 ||
          ![500, 502, 503, 504].includes(response.status)
        ) {
          return response;
        }

        await wait(250);
      } catch (error) {
        lastError = error;

        if (
          method !== "GET" ||
          attempt === 1 ||
          options.signal?.aborted
        ) {
          throw error;
        }

        await wait(250);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }

    throw lastError || new Error("Football request failed");
  })();

  if (requestKey) pendingGets.set(requestKey, request);

  try {
    const response = await request;
    return requestKey ? response.clone() : response;
  } finally {
    if (requestKey) pendingGets.delete(requestKey);
  }
}
