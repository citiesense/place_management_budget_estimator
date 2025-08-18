export async function fetchPlacesWithinPolygon(polygon_geojson: string) {
  const response = await fetch('/.netlify/functions/get-places', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ polygon_geojson })
  });

  if (!response.ok) {
    throw new Error(`Error fetching places: ${response.statusText}`);
  }

  return response.json();
}
