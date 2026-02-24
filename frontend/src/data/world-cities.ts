/* Comprehensive world cities database with coordinates for globe + search */

export interface WorldCity {
  city: string;
  country: string;
  countryCode: string;
  emoji: string;
  lat: number;
  lng: number;
  description: string;
  region: "Asia" | "Europe" | "North America" | "South America" | "Africa" | "Oceania" | "Middle East";
  popular?: boolean;
}

export const WORLD_CITIES: WorldCity[] = [
  // Asia
  { city: "Tokyo", country: "Japan", countryCode: "JP", emoji: "🇯🇵", lat: 35.6762, lng: 139.6503, description: "Neon & Tradition", region: "Asia", popular: true },
  { city: "Kyoto", country: "Japan", countryCode: "JP", emoji: "🇯🇵", lat: 35.0116, lng: 135.7681, description: "Ancient Temples", region: "Asia" },
  { city: "Osaka", country: "Japan", countryCode: "JP", emoji: "🇯🇵", lat: 34.6937, lng: 135.5023, description: "Street Food Capital", region: "Asia" },
  { city: "Seoul", country: "South Korea", countryCode: "KR", emoji: "🇰🇷", lat: 37.5665, lng: 126.978, description: "K-Culture Hub", region: "Asia" },
  { city: "Beijing", country: "China", countryCode: "CN", emoji: "🇨🇳", lat: 39.9042, lng: 116.4074, description: "Imperial Grandeur", region: "Asia" },
  { city: "Shanghai", country: "China", countryCode: "CN", emoji: "🇨🇳", lat: 31.2304, lng: 121.4737, description: "The Bund Skyline", region: "Asia" },
  { city: "Hong Kong", country: "China", countryCode: "HK", emoji: "🇭🇰", lat: 22.3193, lng: 114.1694, description: "Harbour City", region: "Asia" },
  { city: "Bangkok", country: "Thailand", countryCode: "TH", emoji: "🇹🇭", lat: 13.7563, lng: 100.5018, description: "Temple Paradise", region: "Asia", popular: true },
  { city: "Chiang Mai", country: "Thailand", countryCode: "TH", emoji: "🇹🇭", lat: 18.7883, lng: 98.9853, description: "Mountain Culture", region: "Asia" },
  { city: "Phuket", country: "Thailand", countryCode: "TH", emoji: "🇹🇭", lat: 7.8804, lng: 98.3923, description: "Tropical Beaches", region: "Asia" },
  { city: "Singapore", country: "Singapore", countryCode: "SG", emoji: "🇸🇬", lat: 1.3521, lng: 103.8198, description: "Garden City", region: "Asia", popular: true },
  { city: "Kuala Lumpur", country: "Malaysia", countryCode: "MY", emoji: "🇲🇾", lat: 3.139, lng: 101.6869, description: "Twin Towers City", region: "Asia" },
  { city: "Bali", country: "Indonesia", countryCode: "ID", emoji: "🇮🇩", lat: -8.3405, lng: 115.092, description: "Island Paradise", region: "Asia", popular: true },
  { city: "Jakarta", country: "Indonesia", countryCode: "ID", emoji: "🇮🇩", lat: -6.2088, lng: 106.8456, description: "Bustling Capital", region: "Asia" },
  { city: "Hanoi", country: "Vietnam", countryCode: "VN", emoji: "🇻🇳", lat: 21.0285, lng: 105.8542, description: "Old Quarter Charm", region: "Asia" },
  { city: "Ho Chi Minh City", country: "Vietnam", countryCode: "VN", emoji: "🇻🇳", lat: 10.8231, lng: 106.6297, description: "Vibrant Energy", region: "Asia" },
  { city: "Manila", country: "Philippines", countryCode: "PH", emoji: "🇵🇭", lat: 14.5995, lng: 120.9842, description: "Tropical Capital", region: "Asia" },
  { city: "Taipei", country: "Taiwan", countryCode: "TW", emoji: "🇹🇼", lat: 25.033, lng: 121.5654, description: "Night Market Haven", region: "Asia" },
  { city: "Kathmandu", country: "Nepal", countryCode: "NP", emoji: "🇳🇵", lat: 27.7172, lng: 85.324, description: "Gateway to Himalayas", region: "Asia" },
  { city: "Colombo", country: "Sri Lanka", countryCode: "LK", emoji: "🇱🇰", lat: 6.9271, lng: 79.8612, description: "Spice Island", region: "Asia" },

  // India
  { city: "Delhi", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 28.6139, lng: 77.209, description: "Historic Capital", region: "Asia" },
  { city: "Mumbai", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 19.076, lng: 72.8777, description: "City of Dreams", region: "Asia" },
  { city: "Bangalore", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 12.9716, lng: 77.5946, description: "Silicon Valley", region: "Asia" },
  { city: "Chennai", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 13.0827, lng: 80.2707, description: "Cultural Capital", region: "Asia" },
  { city: "Kolkata", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 22.5726, lng: 88.3639, description: "City of Joy", region: "Asia" },
  { city: "Jaipur", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 26.9124, lng: 75.7873, description: "Pink City", region: "Asia" },
  { city: "Goa", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 15.2993, lng: 74.124, description: "Beach Paradise", region: "Asia" },
  { city: "Varanasi", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 25.3176, lng: 82.9739, description: "Spiritual Heart", region: "Asia" },
  { city: "Agra", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 27.1767, lng: 78.0081, description: "Taj Mahal City", region: "Asia" },
  { city: "Udaipur", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 24.5854, lng: 73.7125, description: "City of Lakes", region: "Asia" },
  { city: "Hyderabad", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 17.385, lng: 78.4867, description: "Pearl City", region: "Asia" },
  { city: "Kochi", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 9.9312, lng: 76.2673, description: "Queen of Arabian Sea", region: "Asia" },
  { city: "Munnar", country: "India", countryCode: "IN", emoji: "🇮🇳", lat: 10.0889, lng: 77.0595, description: "Tea Hills", region: "Asia" },

  // Europe
  { city: "Paris", country: "France", countryCode: "FR", emoji: "🇫🇷", lat: 48.8566, lng: 2.3522, description: "City of Lights", region: "Europe", popular: true },
  { city: "London", country: "UK", countryCode: "GB", emoji: "🇬🇧", lat: 51.5074, lng: -0.1278, description: "Royal Heritage", region: "Europe", popular: true },
  { city: "Rome", country: "Italy", countryCode: "IT", emoji: "🇮🇹", lat: 41.9028, lng: 12.4964, description: "Eternal City", region: "Europe", popular: true },
  { city: "Venice", country: "Italy", countryCode: "IT", emoji: "🇮🇹", lat: 45.4408, lng: 12.3155, description: "Floating City", region: "Europe" },
  { city: "Florence", country: "Italy", countryCode: "IT", emoji: "🇮🇹", lat: 43.7696, lng: 11.2558, description: "Renaissance Jewel", region: "Europe" },
  { city: "Barcelona", country: "Spain", countryCode: "ES", emoji: "🇪🇸", lat: 41.3874, lng: 2.1686, description: "Gaudí's Masterpiece", region: "Europe", popular: true },
  { city: "Madrid", country: "Spain", countryCode: "ES", emoji: "🇪🇸", lat: 40.4168, lng: -3.7038, description: "Royal Capital", region: "Europe" },
  { city: "Lisbon", country: "Portugal", countryCode: "PT", emoji: "🇵🇹", lat: 38.7223, lng: -9.1393, description: "City of Seven Hills", region: "Europe" },
  { city: "Amsterdam", country: "Netherlands", countryCode: "NL", emoji: "🇳🇱", lat: 52.3676, lng: 4.9041, description: "Canal Capital", region: "Europe" },
  { city: "Berlin", country: "Germany", countryCode: "DE", emoji: "🇩🇪", lat: 52.52, lng: 13.405, description: "Culture Capital", region: "Europe" },
  { city: "Munich", country: "Germany", countryCode: "DE", emoji: "🇩🇪", lat: 48.1351, lng: 11.582, description: "Bavarian Charm", region: "Europe" },
  { city: "Vienna", country: "Austria", countryCode: "AT", emoji: "🇦🇹", lat: 48.2082, lng: 16.3738, description: "Music Capital", region: "Europe" },
  { city: "Prague", country: "Czech Republic", countryCode: "CZ", emoji: "🇨🇿", lat: 50.0755, lng: 14.4378, description: "City of Spires", region: "Europe" },
  { city: "Budapest", country: "Hungary", countryCode: "HU", emoji: "🇭🇺", lat: 47.4979, lng: 19.0402, description: "Pearl of Danube", region: "Europe" },
  { city: "Athens", country: "Greece", countryCode: "GR", emoji: "🇬🇷", lat: 37.9838, lng: 23.7275, description: "Cradle of Civilization", region: "Europe" },
  { city: "Santorini", country: "Greece", countryCode: "GR", emoji: "🇬🇷", lat: 36.3932, lng: 25.4615, description: "Sunset Paradise", region: "Europe" },
  { city: "Istanbul", country: "Turkey", countryCode: "TR", emoji: "🇹🇷", lat: 41.0082, lng: 28.9784, description: "Where East Meets West", region: "Europe", popular: true },
  { city: "Zurich", country: "Switzerland", countryCode: "CH", emoji: "🇨🇭", lat: 47.3769, lng: 8.5417, description: "Alpine Elegance", region: "Europe" },
  { city: "Copenhagen", country: "Denmark", countryCode: "DK", emoji: "🇩🇰", lat: 55.6761, lng: 12.5683, description: "Hygge Capital", region: "Europe" },
  { city: "Stockholm", country: "Sweden", countryCode: "SE", emoji: "🇸🇪", lat: 59.3293, lng: 18.0686, description: "Venice of the North", region: "Europe" },
  { city: "Edinburgh", country: "UK", countryCode: "GB", emoji: "🇬🇧", lat: 55.9533, lng: -3.1883, description: "Castle City", region: "Europe" },
  { city: "Dublin", country: "Ireland", countryCode: "IE", emoji: "🇮🇪", lat: 53.3498, lng: -6.2603, description: "Literary Capital", region: "Europe" },
  { city: "Reykjavik", country: "Iceland", countryCode: "IS", emoji: "🇮🇸", lat: 64.1466, lng: -21.9426, description: "Northern Lights", region: "Europe" },
  { city: "Dubrovnik", country: "Croatia", countryCode: "HR", emoji: "🇭🇷", lat: 42.6507, lng: 18.0944, description: "Pearl of Adriatic", region: "Europe" },
  { city: "Moscow", country: "Russia", countryCode: "RU", emoji: "🇷🇺", lat: 55.7558, lng: 37.6173, description: "Red Square City", region: "Europe" },
  { city: "Warsaw", country: "Poland", countryCode: "PL", emoji: "🇵🇱", lat: 52.2297, lng: 21.0122, description: "Phoenix City", region: "Europe" },

  // North America
  { city: "New York", country: "USA", countryCode: "US", emoji: "🇺🇸", lat: 40.7128, lng: -74.006, description: "The Big Apple", region: "North America", popular: true },
  { city: "Los Angeles", country: "USA", countryCode: "US", emoji: "🇺🇸", lat: 34.0522, lng: -118.2437, description: "City of Angels", region: "North America" },
  { city: "San Francisco", country: "USA", countryCode: "US", emoji: "🇺🇸", lat: 37.7749, lng: -122.4194, description: "Golden Gate City", region: "North America" },
  { city: "Las Vegas", country: "USA", countryCode: "US", emoji: "🇺🇸", lat: 36.1699, lng: -115.1398, description: "Entertainment Capital", region: "North America" },
  { city: "Miami", country: "USA", countryCode: "US", emoji: "🇺🇸", lat: 25.7617, lng: -80.1918, description: "Magic City", region: "North America" },
  { city: "Chicago", country: "USA", countryCode: "US", emoji: "🇺🇸", lat: 41.8781, lng: -87.6298, description: "Windy City", region: "North America" },
  { city: "Hawaii", country: "USA", countryCode: "US", emoji: "🇺🇸", lat: 21.3069, lng: -157.8583, description: "Aloha Paradise", region: "North America" },
  { city: "Washington DC", country: "USA", countryCode: "US", emoji: "🇺🇸", lat: 38.9072, lng: -77.0369, description: "National Capital", region: "North America" },
  { city: "Toronto", country: "Canada", countryCode: "CA", emoji: "🇨🇦", lat: 43.6532, lng: -79.3832, description: "CN Tower City", region: "North America" },
  { city: "Vancouver", country: "Canada", countryCode: "CA", emoji: "🇨🇦", lat: 49.2827, lng: -123.1207, description: "Pacific Gem", region: "North America" },
  { city: "Mexico City", country: "Mexico", countryCode: "MX", emoji: "🇲🇽", lat: 19.4326, lng: -99.1332, description: "Aztec Heritage", region: "North America" },
  { city: "Cancun", country: "Mexico", countryCode: "MX", emoji: "🇲🇽", lat: 21.1619, lng: -86.8515, description: "Caribbean Paradise", region: "North America" },

  // South America
  { city: "Rio de Janeiro", country: "Brazil", countryCode: "BR", emoji: "🇧🇷", lat: -22.9068, lng: -43.1729, description: "Carnival City", region: "South America", popular: true },
  { city: "São Paulo", country: "Brazil", countryCode: "BR", emoji: "🇧🇷", lat: -23.5505, lng: -46.6333, description: "Business Capital", region: "South America" },
  { city: "Buenos Aires", country: "Argentina", countryCode: "AR", emoji: "🇦🇷", lat: -34.6037, lng: -58.3816, description: "Paris of South America", region: "South America" },
  { city: "Lima", country: "Peru", countryCode: "PE", emoji: "🇵🇪", lat: -12.0464, lng: -77.0428, description: "Foodie Capital", region: "South America" },
  { city: "Cusco", country: "Peru", countryCode: "PE", emoji: "🇵🇪", lat: -13.5319, lng: -71.9675, description: "Gateway to Machu Picchu", region: "South America" },
  { city: "Bogotá", country: "Colombia", countryCode: "CO", emoji: "🇨🇴", lat: 4.711, lng: -74.0721, description: "Emerald City", region: "South America" },
  { city: "Santiago", country: "Chile", countryCode: "CL", emoji: "🇨🇱", lat: -33.4489, lng: -70.6693, description: "Andes Capital", region: "South America" },
  { city: "Cartagena", country: "Colombia", countryCode: "CO", emoji: "🇨🇴", lat: 10.391, lng: -75.5144, description: "Colonial Jewel", region: "South America" },

  // Africa
  { city: "Cape Town", country: "South Africa", countryCode: "ZA", emoji: "🇿🇦", lat: -33.9249, lng: 18.4241, description: "Mother City", region: "Africa", popular: true },
  { city: "Marrakech", country: "Morocco", countryCode: "MA", emoji: "🇲🇦", lat: 31.6295, lng: -7.9811, description: "Red City", region: "Africa" },
  { city: "Cairo", country: "Egypt", countryCode: "EG", emoji: "🇪🇬", lat: 30.0444, lng: 31.2357, description: "City of Pyramids", region: "Africa", popular: true },
  { city: "Nairobi", country: "Kenya", countryCode: "KE", emoji: "🇰🇪", lat: -1.2921, lng: 36.8219, description: "Safari Gateway", region: "Africa" },
  { city: "Zanzibar", country: "Tanzania", countryCode: "TZ", emoji: "🇹🇿", lat: -6.1659, lng: 39.2026, description: "Spice Island", region: "Africa" },
  { city: "Accra", country: "Ghana", countryCode: "GH", emoji: "🇬🇭", lat: 5.6037, lng: -0.187, description: "Gold Coast Capital", region: "Africa" },
  { city: "Casablanca", country: "Morocco", countryCode: "MA", emoji: "🇲🇦", lat: 33.5731, lng: -7.5898, description: "White City", region: "Africa" },
  { city: "Lagos", country: "Nigeria", countryCode: "NG", emoji: "🇳🇬", lat: 6.5244, lng: 3.3792, description: "Africa's Megacity", region: "Africa" },

  // Middle East
  { city: "Dubai", country: "UAE", countryCode: "AE", emoji: "🇦🇪", lat: 25.2048, lng: 55.2708, description: "City of Gold", region: "Middle East", popular: true },
  { city: "Abu Dhabi", country: "UAE", countryCode: "AE", emoji: "🇦🇪", lat: 24.4539, lng: 54.3773, description: "Capital of Culture", region: "Middle East" },
  { city: "Doha", country: "Qatar", countryCode: "QA", emoji: "🇶🇦", lat: 25.2854, lng: 51.531, description: "Pearl City", region: "Middle East" },
  { city: "Tel Aviv", country: "Israel", countryCode: "IL", emoji: "🇮🇱", lat: 32.0853, lng: 34.7818, description: "White City", region: "Middle East" },
  { city: "Jerusalem", country: "Israel", countryCode: "IL", emoji: "🇮🇱", lat: 31.7683, lng: 35.2137, description: "Holy City", region: "Middle East" },
  { city: "Muscat", country: "Oman", countryCode: "OM", emoji: "🇴🇲", lat: 23.5880, lng: 58.3829, description: "Arabian Gem", region: "Middle East" },
  { city: "Amman", country: "Jordan", countryCode: "JO", emoji: "🇯🇴", lat: 31.9454, lng: 35.9284, description: "Petra Gateway", region: "Middle East" },

  // Oceania
  { city: "Sydney", country: "Australia", countryCode: "AU", emoji: "🇦🇺", lat: -33.8688, lng: 151.2093, description: "Harbour City", region: "Oceania", popular: true },
  { city: "Melbourne", country: "Australia", countryCode: "AU", emoji: "🇦🇺", lat: -37.8136, lng: 144.9631, description: "Culture Capital", region: "Oceania" },
  { city: "Auckland", country: "New Zealand", countryCode: "NZ", emoji: "🇳🇿", lat: -36.8485, lng: 174.7633, description: "City of Sails", region: "Oceania" },
  { city: "Queenstown", country: "New Zealand", countryCode: "NZ", emoji: "🇳🇿", lat: -45.0312, lng: 168.6626, description: "Adventure Capital", region: "Oceania" },
  { city: "Fiji", country: "Fiji", countryCode: "FJ", emoji: "🇫🇯", lat: -17.7134, lng: 178.065, description: "Tropical Paradise", region: "Oceania" },
  { city: "Perth", country: "Australia", countryCode: "AU", emoji: "🇦🇺", lat: -31.9505, lng: 115.8605, description: "Sunset Coast", region: "Oceania" },
  { city: "Gold Coast", country: "Australia", countryCode: "AU", emoji: "🇦🇺", lat: -28.0167, lng: 153.4, description: "Surfer's Paradise", region: "Oceania" },
];

/* Departure cities (expandable) */
export const DEPARTURE_CITIES: WorldCity[] = WORLD_CITIES.filter(c =>
  ["Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Kochi",
   "Jaipur", "Goa", "Singapore", "Bangkok", "Dubai", "London", "New York"].includes(c.city)
);

/* Get city coordinates by name */
export function getCityCoords(cityName: string): { lat: number; lng: number } | null {
  const city = WORLD_CITIES.find(c => c.city.toLowerCase() === cityName.toLowerCase());
  return city ? { lat: city.lat, lng: city.lng } : null;
}

/* Get city data by name */
export function getCityData(cityName: string): WorldCity | undefined {
  return WORLD_CITIES.find(c => c.city.toLowerCase() === cityName.toLowerCase());
}

/* Search cities with fuzzy matching */
export function searchCities(query: string, limit = 10): WorldCity[] {
  if (!query.trim()) return WORLD_CITIES.filter(c => c.popular).slice(0, limit);
  const q = query.toLowerCase().trim();
  const results = WORLD_CITIES.filter(
    c => c.city.toLowerCase().includes(q) ||
         c.country.toLowerCase().includes(q) ||
         c.description.toLowerCase().includes(q) ||
         c.region.toLowerCase().includes(q)
  );
  // Sort: exact start match first, then popular, then alphabetical
  results.sort((a, b) => {
    const aStart = a.city.toLowerCase().startsWith(q) ? 0 : 1;
    const bStart = b.city.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStart !== bStart) return aStart - bStart;
    if (a.popular && !b.popular) return -1;
    if (!a.popular && b.popular) return 1;
    return a.city.localeCompare(b.city);
  });
  return results.slice(0, limit);
}

/* Get all unique regions */
export const REGIONS = [...new Set(WORLD_CITIES.map(c => c.region))];
