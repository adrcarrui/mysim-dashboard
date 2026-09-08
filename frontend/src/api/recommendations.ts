import type {
  RecommendationsResponse,
} from "../types/recommendation";


const API_BASE_URL =
  `${window.location.protocol}//` +
  `${window.location.hostname}:8000/api`;


export async function getRecommendations(
  fromDate: string,
  toDate: string,
  limit = 5,
): Promise<RecommendationsResponse> {
  const params =
    new URLSearchParams({
      from_date: fromDate,
      to_date: toDate,
      limit: String(limit),
    });


  const response =
    await fetch(
      `${API_BASE_URL}/recommendations?${params.toString()}`,
    );


  if (!response.ok) {
    throw new Error(
      `Error loading recommendations: ${response.status}`,
    );
  }


  return response.json();
}