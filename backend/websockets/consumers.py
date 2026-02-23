"""WebSocket consumers for real-time updates and collaboration."""
import json
import logging
from datetime import datetime
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)

# Track active users per trip for presence
_trip_presence: dict[str, dict[str, dict]] = {}  # trip_id -> {channel_name: {user_info}}


class TripConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for trip real-time updates and collaboration."""

    async def connect(self):
        self.trip_id = self.scope['url_route']['kwargs']['trip_id']
        self.room_group = f'trip_{self.trip_id}'
        self.user_info = {
            'name': 'Anonymous',
            'color': '#0ea5e9',
            'joined_at': datetime.now().isoformat(),
        }

        # Try to get user info from scope
        user = self.scope.get('user')
        if user and hasattr(user, 'username') and user.username:
            self.user_info['name'] = user.username
            self.user_info['id'] = str(user.id) if hasattr(user, 'id') else ''

        await self.channel_layer.group_add(
            self.room_group,
            self.channel_name,
        )
        await self.accept()

        # Track presence
        if self.trip_id not in _trip_presence:
            _trip_presence[self.trip_id] = {}
        _trip_presence[self.trip_id][self.channel_name] = self.user_info

        # Notify all clients of the new presence
        await self.channel_layer.group_send(
            self.room_group,
            {
                'type': 'presence_update',
                'users': list(_trip_presence.get(self.trip_id, {}).values()),
            }
        )

        await self.send_json({
            'type': 'connection_established',
            'trip_id': self.trip_id,
            'users': list(_trip_presence.get(self.trip_id, {}).values()),
        })

    async def disconnect(self, close_code):
        # Remove from presence
        if self.trip_id in _trip_presence:
            _trip_presence[self.trip_id].pop(self.channel_name, None)
            if not _trip_presence[self.trip_id]:
                del _trip_presence[self.trip_id]

        # Notify remaining clients
        await self.channel_layer.group_send(
            self.room_group,
            {
                'type': 'presence_update',
                'users': list(_trip_presence.get(self.trip_id, {}).values()),
            }
        )

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
        # ──── Collaboration events ────
        elif msg_type == 'note_update':
            await self.channel_layer.group_send(
                self.room_group,
                {
                    'type': 'collab_note_update',
                    'data': content.get('data', {}),
                    'user': self.user_info,
                }
            )
        elif msg_type == 'expense_update':
            await self.channel_layer.group_send(
                self.room_group,
                {
                    'type': 'collab_expense_update',
                    'data': content.get('data', {}),
                    'user': self.user_info,
                }
            )
        elif msg_type == 'checklist_update':
            await self.channel_layer.group_send(
                self.room_group,
                {
                    'type': 'collab_checklist_update',
                    'data': content.get('data', {}),
                    'user': self.user_info,
                }
            )
        elif msg_type == 'cursor_move':
            # Real-time cursor/activity indicator
            await self.channel_layer.group_send(
                self.room_group,
                {
                    'type': 'collab_cursor',
                    'user': self.user_info,
                    'position': content.get('position', {}),
                }
            )
        elif msg_type == 'typing':
            await self.channel_layer.group_send(
                self.room_group,
                {
                    'type': 'collab_typing',
                    'user': self.user_info,
                    'section': content.get('section', ''),
                }
            )

    # ──── Outbound event handlers ────

    async def presence_update(self, event):
        """Send presence update to client."""
        await self.send_json({
            'type': 'presence_update',
            'users': event.get('users', []),
        })

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

    # ──── Collaboration event forwarding ────

    async def collab_note_update(self, event):
        await self.send_json({
            'type': 'collab_note_update',
            'data': event.get('data', {}),
            'user': event.get('user', {}),
        })

    async def collab_expense_update(self, event):
        await self.send_json({
            'type': 'collab_expense_update',
            'data': event.get('data', {}),
            'user': event.get('user', {}),
        })

    async def collab_checklist_update(self, event):
        await self.send_json({
            'type': 'collab_checklist_update',
            'data': event.get('data', {}),
            'user': event.get('user', {}),
        })

    async def collab_cursor(self, event):
        # Don't echo cursor back to sender
        if event.get('user', {}).get('name') != self.user_info.get('name'):
            await self.send_json({
                'type': 'collab_cursor',
                'user': event.get('user', {}),
                'position': event.get('position', {}),
            })

    async def collab_typing(self, event):
        if event.get('user', {}).get('name') != self.user_info.get('name'):
            await self.send_json({
                'type': 'collab_typing',
                'user': event.get('user', {}),
                'section': event.get('section', ''),
            })
