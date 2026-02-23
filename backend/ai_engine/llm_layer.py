"""
LLM Layer - Natural language intelligence via Anthropic Claude.

Uses LLM ONLY for:
- Natural language interpretation
- Extract structured modification intent
- Explain itinerary decisions
- Generate trip summaries

NEVER uses LLM for route optimization.
"""
import json
import logging
from typing import Dict, Any, Optional
from django.conf import settings

logger = logging.getLogger('ai_engine')


class LLMLayer:
    """Anthropic Claude integration for natural language tasks only."""

    def __init__(self):
        self.api_key = getattr(settings, 'ANTHROPIC_API_KEY', '') or getattr(settings, 'OPENAI_API_KEY', '')
        self.client = None

        if self.api_key and self.api_key.startswith('sk-ant-'):
            # Anthropic Claude
            try:
                import anthropic
                self.client = anthropic.Anthropic(api_key=self.api_key)
                self._provider = 'anthropic'
            except ImportError:
                logger.warning("anthropic package not installed — run: pip install anthropic")
        elif self.api_key:
            # Fallback to OpenAI if the key doesn't look like Anthropic
            try:
                import openai
                self.client = openai.OpenAI(api_key=self.api_key)
                self._provider = 'openai'
            except ImportError:
                logger.warning("openai package not installed")

    def _call_llm(self, system_prompt: str, user_prompt: str, max_tokens: int = 500) -> str:
        """Make a call to the LLM API (Anthropic Claude or OpenAI)."""
        if not self.client:
            return self._fallback_response(user_prompt)

        try:
            if self._provider == 'anthropic':
                response = self.client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=max_tokens,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.3,
                )
                return response.content[0].text
            else:
                # OpenAI path
                response = self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=max_tokens,
                    temperature=0.3,
                )
                return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM API error: {e}")
            return self._fallback_response(user_prompt)

    def interpret_modification(self, user_input: str) -> Dict[str, Any]:
        """Parse natural language into structured modification intent."""
        system_prompt = """You are a travel itinerary assistant. Parse the user's request into a structured JSON modification.
Return ONLY valid JSON with these fields:
- action: "swap" | "remove" | "add" | "reschedule" | "extend" | "shorten"
- target_day: number or null
- target_place: string or null
- replacement_category: string or null (culture/nature/food/adventure/relaxation)
- time_preference: "morning" | "afternoon" | "evening" | null
- reason: brief summary"""

        response = self._call_llm(system_prompt, user_input, max_tokens=200)

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {
                'action': 'unknown',
                'raw_input': user_input,
                'error': 'Could not parse intent',
            }

    def explain_decision(self, item_data: Dict, score_breakdown: Dict) -> str:
        """Generate a human-readable explanation for an itinerary decision."""
        system_prompt = """You are a friendly travel advisor. Explain why this place was chosen for the itinerary.
Be concise (2-3 sentences). Focus on the key factors. Be warm but informative."""

        user_prompt = f"""Place: {item_data.get('name', 'Unknown')}
Category: {item_data.get('category', 'Unknown')}
Score: {score_breakdown.get('total_score', 0):.2f}
Interest match: {score_breakdown.get('interest', 0):.2f}
Distance efficiency: {score_breakdown.get('distance_efficiency', 0):.2f}
Risk level: {score_breakdown.get('risk', 0):.2f}"""

        return self._call_llm(system_prompt, user_prompt, max_tokens=150)

    def generate_trip_summary(self, trip_data: Dict, itinerary_items: list) -> str:
        """Generate a narrative trip summary."""
        system_prompt = """You are a travel writer. Create a brief, engaging summary of this trip itinerary.
Keep it under 150 words. Be inspiring but informative. Mention highlights."""

        places_text = ", ".join([
            f"{item.get('place_name', 'Unknown')} (Day {item.get('day_number', '?')})"
            for item in itinerary_items[:10]
        ])

        user_prompt = f"""Trip: {trip_data.get('title', 'Trip')}
Destination: {trip_data.get('destination_city', 'Unknown')}, {trip_data.get('destination_country', '')}
Duration: {trip_data.get('duration_days', '?')} days
Places: {places_text}"""

        return self._call_llm(system_prompt, user_prompt, max_tokens=250)

    def chat_response(self, message: str, trip_context: Optional[Dict] = None) -> str:
        """Handle general chat about the trip."""
        system_prompt = """You are a helpful AI travel assistant for 'The Endless Dreams' travel platform.
Help users with their trip questions. Be concise, helpful, and friendly.
If asked about modifying the itinerary, explain what changes could be made.
Never generate routes or optimize plans - only provide information and suggestions."""

        context = ""
        if trip_context:
            context = f"\n\nCurrent trip context: {json.dumps(trip_context, default=str)}"

        return self._call_llm(system_prompt, message + context, max_tokens=300)

    @staticmethod
    def _fallback_response(prompt: str) -> str:
        """Fallback when LLM is unavailable."""
        return "AI assistant is currently unavailable. Please try again later."
