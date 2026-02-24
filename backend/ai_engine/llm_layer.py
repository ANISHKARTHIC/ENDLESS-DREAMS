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
    """LLM integration priority:
    1. Groq (llama-3.3-70b-versatile) — fast, free tier, excellent quality
    2. Gemini (gemini-1.5-flash)       — Google, very capable
    3. Anthropic Claude                — premium quality
    4. Ollama (local)                  — free, requires local Docker
    5. OpenAI GPT-4o-mini              — fallback
    6. Keyword heuristics              — offline fallback
    """

    def __init__(self):
        self.api_key = getattr(settings, 'ANTHROPIC_API_KEY', '') or ''
        self.openai_key = getattr(settings, 'OPENAI_API_KEY', '') or ''
        self.groq_key = getattr(settings, 'GROQ_API_KEY', '') or ''
        self.gemini_key = getattr(settings, 'GEMINI_API_KEY', '') or ''
        self.client = None
        self._provider = 'fallback'

        # Priority 1: Groq — fastest free LLM inference
        if self.groq_key:
            try:
                import openai
                self.client = openai.OpenAI(
                    base_url='https://api.groq.com/openai/v1',
                    api_key=self.groq_key,
                )
                self._provider = 'groq'
                logger.info('LLM: Using Groq (llama-3.3-70b-versatile)')
            except ImportError:
                logger.warning("openai package not installed for Groq")

        # Priority 2: Gemini
        if self._provider == 'fallback' and self.gemini_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.gemini_key)
                self.client = genai.GenerativeModel('gemini-1.5-flash')
                self._provider = 'gemini'
                logger.info('LLM: Using Gemini 1.5 Flash')
            except ImportError:
                logger.warning("google-generativeai not installed — run: pip install google-generativeai")
            except Exception as e:
                logger.warning(f'Gemini init failed: {e}')

        # Priority 3: Anthropic Claude
        if self._provider == 'fallback' and self.api_key and self.api_key.startswith('sk-ant-'):
            try:
                import anthropic
                self.client = anthropic.Anthropic(api_key=self.api_key)
                self._provider = 'anthropic'
                logger.info('LLM: Using Anthropic Claude')
            except ImportError:
                logger.warning("anthropic package not installed — run: pip install anthropic")

        # Priority 4: Ollama (local, free)
        if self._provider == 'fallback':
            ollama_base = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')
            ollama_model = getattr(settings, 'OLLAMA_MODEL', 'llama3.2')
            try:
                import requests as _req
                _req.get(f'{ollama_base}/api/tags', timeout=2)
                import openai
                self.client = openai.OpenAI(base_url=f'{ollama_base}/v1', api_key='ollama')
                self._provider = 'ollama'
                self._ollama_model = ollama_model
                logger.info(f'LLM: Using Ollama ({ollama_model}) at {ollama_base}')
            except Exception:
                logger.info('Ollama not reachable')

        # Priority 5: OpenAI
        if self._provider == 'fallback' and self.openai_key:
            try:
                import openai
                self.client = openai.OpenAI(api_key=self.openai_key)
                self._provider = 'openai'
                logger.info('LLM: Using OpenAI GPT-4o-mini')
            except ImportError:
                logger.warning("openai package not installed")

        if self._provider == 'fallback':
            logger.warning('LLM: No AI provider available — using keyword fallback')

    def _call_llm(self, system_prompt: str, user_prompt: str, max_tokens: int = 500) -> str:
        """Make a call to the configured LLM provider."""
        if not self.client:
            return self._fallback_response(user_prompt)

        try:
            if self._provider == 'gemini':
                combined = f"{system_prompt}\n\n{user_prompt}"
                response = self.client.generate_content(
                    combined,
                    generation_config={'max_output_tokens': max_tokens, 'temperature': 0.3},
                )
                return response.text
            elif self._provider == 'anthropic':
                response = self.client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=max_tokens,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                    temperature=0.3,
                )
                return response.content[0].text
            elif self._provider == 'groq':
                response = self.client.chat.completions.create(
                    model='llama-3.3-70b-versatile',
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=max_tokens,
                    temperature=0.3,
                )
                return response.choices[0].message.content
            elif self._provider in ('ollama', 'openai'):
                model = getattr(self, '_ollama_model', 'llama3.2') if self._provider == 'ollama' else 'gpt-4o-mini'
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=max_tokens,
                    temperature=0.3,
                )
                return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM API error ({self._provider}): {e}")
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

        # If fallback response was returned, use keyword-based parsing
        if response.startswith("I've made some adjustments") or response.startswith("Great") or response.startswith("Smart") or response.startswith("Wonderful") or response.startswith("Time to") or response.startswith("Let's") or response.startswith("Adventure"):
            return self._fallback_interpret(user_input)

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return self._fallback_interpret(user_input)

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
        system_prompt = """You are a world-class travel writer for a premium platform called 'The Endless Dreams'.
Create a captivating, personalized trip summary that reads like a story.
Structure: Opening hook → Day-by-day highlights → Closing inspiration.
Keep it under 200 words. Use vivid sensory language. Mention specific place names.
Tone: warm, inspiring, knowledgeable — like a friend who has been everywhere."""

        places_text = "\n".join([
            f"- Day {item.get('day_number', '?')}: {item.get('place_name', 'Unknown')} ({item.get('category', 'activity')})"
            for item in itinerary_items[:15]
        ])

        user_prompt = f"""Trip: {trip_data.get('title', 'Trip')}
Destination: {trip_data.get('destination_city', 'Unknown')}, {trip_data.get('destination_country', '')}
Duration: {trip_data.get('duration_days', '?')} days
Budget: ${trip_data.get('budget_usd', '?')} USD
Pace: {trip_data.get('pace', 'moderate')}
Group size: {trip_data.get('group_size', 1)}

Itinerary:
{places_text}

Write a compelling narrative summary of this trip."""

        return self._call_llm(system_prompt, user_prompt, max_tokens=400)

    def chat_response(self, message: str, trip_context: Optional[Dict] = None) -> str:
        """Handle general chat about the trip."""
        system_prompt = """You are the AI travel concierge for 'The Endless Dreams' — a premium AI travel platform.

Personality: Warm, knowledgeable, proactive. You're like a well-traveled friend who always knows the best spots.
Expertise: Local cuisine, hidden gems, cultural etiquette, budget optimization, safety tips, transportation.

Guidelines:
- Give specific, actionable advice (restaurant names, exact costs, timing tips)
- Proactively suggest things the user might not have thought of
- If they ask about modifying the itinerary, explain what's possible
- Use a conversational but professional tone
- Keep responses concise but helpful (3-5 sentences max)
- Never invent fake place names — use real ones or say "I'd recommend looking for..."
- If unsure, be honest and suggest alternatives"""

        context = ""
        if trip_context:
            context = f"\n\nCurrent trip context: {json.dumps(trip_context, default=str)}"

        return self._call_llm(system_prompt, message + context, max_tokens=400)

    def generate_packing_suggestions(self, trip_data: Dict) -> str:
        """Generate smart packing suggestions based on trip details."""
        system_prompt = """You are a travel packing expert. Generate a practical packing list.
Return ONLY a JSON array of strings, each being a packing item.
Consider: destination weather, activities planned, trip duration, cultural norms.
Keep it to 15-20 essential items. Be specific (e.g., "lightweight rain jacket" not just "jacket")."""

        user_prompt = f"""Destination: {trip_data.get('destination_city', 'Unknown')}, {trip_data.get('destination_country', '')}
Duration: {trip_data.get('duration_days', '?')} days
Activities: {trip_data.get('interests', 'general sightseeing')}
Season: {trip_data.get('season', 'unknown')}

Generate packing list as JSON array."""

        return self._call_llm(system_prompt, user_prompt, max_tokens=300)

    def suggest_local_tips(self, city: str, country: str) -> str:
        """Generate local insider tips for a destination."""
        system_prompt = """You are a local travel expert. Provide 5 insider tips for visiting this city.
Return ONLY a JSON array of objects with 'tip' and 'category' fields.
Categories: food, transport, culture, safety, money-saving.
Tips should be specific, actionable, and not commonly known."""

        user_prompt = f"Give 5 insider travel tips for {city}, {country}."
        return self._call_llm(system_prompt, user_prompt, max_tokens=400)

    @staticmethod
    def _fallback_response(prompt: str) -> str:
        """Fallback when LLM is unavailable."""
        prompt_lower = prompt.lower()
        if any(w in prompt_lower for w in ['food', 'eat', 'restaurant', 'dining', 'cuisine']):
            return "Great choice! I've updated your itinerary to include more local food and dining experiences. Food is one of the best ways to experience a culture!"
        if any(w in prompt_lower for w in ['adventure', 'outdoor', 'hiking', 'trek']):
            return "Adventure time! I've swapped some activities for more exciting outdoor experiences. Get ready for an adrenaline rush!"
        if any(w in prompt_lower for w in ['budget', 'cheap', 'free', 'affordable', 'save']):
            return "Smart traveler! I've found some budget-friendly alternatives that are just as amazing. Your wallet will thank you!"
        if any(w in prompt_lower for w in ['culture', 'museum', 'temple', 'history', 'heritage']):
            return "Wonderful! I've enriched your trip with more cultural experiences. There's so much history and heritage to explore!"
        if any(w in prompt_lower for w in ['relax', 'spa', 'beach', 'leisure', 'calm']):
            return "Time to unwind! I've adjusted your itinerary for a more relaxing pace. You deserve some downtime!"
        if any(w in prompt_lower for w in ['night', 'bar', 'club', 'party', 'evening']):
            return "Let's light up the night! I've added some exciting nightlife and evening entertainment options to your trip."
        if any(w in prompt_lower for w in ['hidden', 'local', 'offbeat', 'secret', 'gem']):
            return "Great taste! I've replaced some popular tourist spots with hidden gems that locals love. You'll get a more authentic experience!"
        if any(w in prompt_lower for w in ['optimize', 'route', 'efficient', 'order']):
            return "I've optimized your route so nearby attractions are grouped together. This should save you travel time between spots!"
        return "I've made some adjustments to your itinerary based on your preferences. Feel free to ask for more specific changes!"

    def _fallback_interpret(self, user_input: str) -> Dict[str, Any]:
        """Keyword-based intent parsing when LLM is unavailable."""
        text = user_input.lower()
        result: Dict[str, Any] = {'action': 'swap', 'target_place': None, 'target_day': None,
                                   'replacement_category': None, 'time_preference': None, 'reason': user_input}

        # Detect action
        if any(w in text for w in ['remove', 'delete', 'drop', 'cancel']):
            result['action'] = 'remove'
        elif any(w in text for w in ['add', 'include', 'insert']):
            result['action'] = 'add'
        elif any(w in text for w in ['extend', 'longer', 'more time']):
            result['action'] = 'extend'
        elif any(w in text for w in ['shorten', 'shorter', 'less time', 'quick']):
            result['action'] = 'shorten'

        # Detect category
        category_map = {
            'food': ['food', 'eat', 'restaurant', 'dining', 'cuisine', 'cafe'],
            'adventure': ['adventure', 'outdoor', 'hiking', 'trek', 'sport'],
            'culture': ['culture', 'museum', 'temple', 'history', 'heritage', 'art'],
            'nature': ['nature', 'park', 'garden', 'beach', 'mountain', 'lake'],
            'relaxation': ['relax', 'spa', 'leisure', 'calm', 'wellness'],
            'nightlife': ['night', 'bar', 'club', 'party', 'evening'],
            'shopping': ['shop', 'market', 'mall', 'buy', 'souvenir'],
        }
        for cat, keywords in category_map.items():
            if any(w in text for w in keywords):
                result['replacement_category'] = cat
                break

        # Detect day number
        import re
        day_match = re.search(r'day\s*(\d+)', text)
        if day_match:
            result['target_day'] = int(day_match.group(1))

        return result
