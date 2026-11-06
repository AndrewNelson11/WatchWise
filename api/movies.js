// api/movies.js
export default async function handler(request, response) {
  const API_KEY = process.env.RAPIDAPI_KEY;
  const API_HOST = '://rapidapi.com';
  const BASE_URL = `https://${API_HOST}`;

  // Extract path and any parameters forwarded by your frontend
  const { path, ...queryParams } = request.query;

  if (!path) {
    return response.status(400).json({ error: 'Missing path parameter' });
  }

  // Construct target URL for the external API
  const url = new URL(BASE_URL + path);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  try {
    const apiResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST
      }
    });

    if (apiResponse.status === 429) {
      return response.status(429).json({ error: 'Too many requests' });
    }
    if (apiResponse.status === 401 || apiResponse.status === 403) {
      return response.status(403).json({ error: 'Server authentication issue' });
    }
    if (!apiResponse.ok) {
      return response.status(apiResponse.status).json({ error: 'Upstream API error' });
    }

    const data = await apiResponse.json();
    return response.status(200).json(data);

  } catch (error) {
    return response.status(500).json({ error: 'Could not connect to the remote streaming API.' });
  }
}
