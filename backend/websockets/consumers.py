"""WebSocket consumers for real-time updates."""
import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)


class TripConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for trip real-time updates."""

    async def connect(self):
        self.trip_id = self.scope['url_route']['kwargs']['trip_id']
        self.room_group = f'trip_{self.trip_id}'

        await self.channel_layer.group_add(
            self.room_group,
            self.channel_name,
        )
        await self.accept()

        await self.send_json({
            'type': 'connection_established',
            'trip_id': self.trip_id,
        })

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group,
            self.channel_name,
        )

    async def receive_json(self, content):
        """Handle incoming messages from client."""
        msg_type = content.get('type', '')

        if msg_type == 'chat_message':
            # Forward to AI assistant
            await self.channel_layer.group_send(
                self.room_group,
                {
                    'type': 'ai_response',
                    'message': content.get('message', ''),
                }
            )
        elif msg_type == 'request_health':
            await self.channel_layer.group_send(
                self.room_group,
                {
                    'type': 'health_update',
                    'trip_id': self.trip_id,
                }
            )

    async def replan_notification(self, event):
        """Send replanning notification to client."""
        await self.send_json({
            'type': 'replan_notification',
            'data': event['data'],
        })

    async def weather_update(self, event):
        """Send weather update to client."""
        await self.send_json({
            'type': 'weather_update',
            'data': event['data'],
        })

    async def health_update(self, event):
        """Send trip health update to client."""
        await self.send_json({
            'type': 'health_update',
            'data': event.get('data', {}),
        })

    async def ai_response(self, event):
        """Send AI assistant response."""
        from ai_engine.llm_layer import LLMLayer
        llm = LLMLayer()
        response = llm.chat_response(event.get('message', ''))

        await self.send_json({
            'type': 'ai_response',
            'message': response,
        })

    async def itinerary_update(self, event):
        """Send itinerary update notification."""
        await self.send_json({
            'type': 'itinerary_update',
            'data': event['data'],
        })
