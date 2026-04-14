"""
QQBot platform adapter using the official QQ Bot Open Platform Python SDK (qq-botpy).

Supports four message scenes:
  - guild_at      : @bot in a guild channel  (post_message)
  - direct_message: private DM              (post_dms)
  - c2c           : C2C (single-user app)   (message.reply)
  - group_at      : @bot in a group         (message.reply)

Configuration in config.yaml:
    platforms:
      qqbot:
        enabled: true
        extra:
          appid: "your_appid"
        token: "your_secret"    # BotSecret, NOT BotToken

Environment variables:
    QQBOT_APPID   - BotAppID
    QQBOT_SECRET  - BotSecret (botpy >= 2.x)
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

try:
    import botpy
    from botpy.message import C2CMessage, DirectMessage, GroupMessage, Message
    QQBOTPY_AVAILABLE = True
except ImportError:
    QQBOTPY_AVAILABLE = False
    botpy = None  # type: ignore[assignment]
    Message = None  # type: ignore[assignment]
    DirectMessage = None  # type: ignore[assignment]
    C2CMessage = None  # type: ignore[assignment]
    GroupMessage = None  # type: ignore[assignment]

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import (
    BasePlatformAdapter,
    MessageEvent,
    MessageType,
    SendResult,
)
from gateway.platforms.helpers import strip_markdown

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 2000
DEDUP_WINDOW_SECONDS = 300

# C2C / group messages require a monotonically increasing msg_seq per session.
_C2C_MSG_SEQ_MAX = 1_000_000

# Responder cache: entries older than TTL are evicted.
_RESPONDER_CACHE_TTL = 600
_RESPONDER_CACHE_MAX = 500

# Send retry: 3 attempts with exponential backoff (matches Telegram adapter).
_SEND_MAX_RETRIES = 3
_SEND_RETRY_BASE_DELAY = 1.0

# Responder callable — wraps botpy's reply API for group_at / c2c scenes.
Responder = Callable[..., Awaitable[None]]


def check_qqbot_requirements() -> bool:
    """Check if QQBot dependencies are available and configured."""
    if not QQBOTPY_AVAILABLE:
        logger.warning("[QQBot] qq-botpy not installed. Run: pip install qq-botpy")
        return False
    if not os.getenv("QQBOT_APPID") or not os.getenv("QQBOT_SECRET"):
        logger.warning("[QQBot] QQBOT_APPID / QQBOT_SECRET env vars not set.")
        return False
    return True


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class QQBotAdapter(BasePlatformAdapter):
    """
    QQBot adapter using the official qq-botpy SDK.

    Supports guild @-messages, direct messages, C2C, and group @-messages.
    QQ renders markdown literally, so all outbound text is stripped to plain text.
    """

    MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH

    def __init__(self, config: PlatformConfig) -> None:
        super().__init__(config, Platform.QQBOT)

        extra = config.extra or {}
        self._appid: str = str(
            extra.get("appid") or os.getenv("QQBOT_APPID", "")
        ).strip()
        self._secret: str = str(
            config.token
            or extra.get("secret")
            or os.getenv("QQBOT_SECRET", "")
            or os.getenv("QQBOT_TOKEN", "")  # legacy fallback
        ).strip()

        self._bot_client: Optional[Any] = None
        self._connect_task: Optional[asyncio.Task] = None

        # Dedup: msg_id → timestamp
        self._seen_messages: Dict[str, float] = {}
        # DM guild_ids (private session IDs) for routing post_dms
        self._dm_guild_ids: set = set()
        # Monotonic msg_seq counter for C2C / group scenes
        self._msg_seq: int = 1
        # chat_id → (scene, responder, timestamp)
        self._responder_cache: Dict[str, Tuple[str, Responder, float]] = {}

        self._intents = (
            botpy.Intents(
                public_guild_messages=True,
                direct_message=True,
                public_messages=True,
                guild_messages=True,
            )
            if QQBOTPY_AVAILABLE
            else None
        )

    # ── Formatting ──────────────────────────────────────────────────────

    def format_message(self, content: str) -> str:
        """Strip markdown — QQ renders it as literal characters."""
        return strip_markdown(content)

    # ── Connection lifecycle ────────────────────────────────────────────

    async def connect(self) -> bool:
        if not QQBOTPY_AVAILABLE:
            self._set_fatal_error("missing_dependency",
                                  "qq-botpy not installed", retryable=True)
            return False
        if not self._appid or not self._secret:
            self._set_fatal_error("missing_credentials",
                                  "QQBOT_APPID / QQBOT_SECRET not set",
                                  retryable=False)
            return False

        if not self._acquire_platform_lock(
            "qqbot-appid", self._appid, "QQBot appid"
        ):
            return False

        try:
            self._bot_client = _QQBotClient(
                intents=self._intents, adapter=self,
            )
            self._connect_task = asyncio.create_task(self._run_client())
            logger.info("[%s] WebSocket task started (appid=%s)",
                        self.name, self._appid)
            return True
        except Exception as exc:
            self._set_fatal_error("connect_error", str(exc), retryable=True)
            self._release_platform_lock()
            return False

    async def _run_client(self) -> None:
        try:
            if self._bot_client:
                async with self._bot_client:
                    await self._bot_client.start(
                        appid=self._appid, secret=self._secret,
                    )
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("[%s] Client error: %s", self.name, exc)
            self._set_fatal_error("connection_failed", str(exc), retryable=True)
            await self._notify_fatal_error()

    async def disconnect(self) -> None:
        self._running = False
        if self._connect_task:
            self._connect_task.cancel()
            try:
                await self._connect_task
            except asyncio.CancelledError:
                pass
        self._bot_client = None
        self._release_platform_lock()
        self._mark_disconnected()
        logger.info("[%s] Disconnected", self.name)

    # ── Typing indicator ────────────────────────────────────────────────

    async def send_typing(self, chat_id: str, metadata=None) -> None:
        """QQ Bot API does not expose a typing indicator — no-op."""
        pass

    # ── Outbound: send ──────────────────────────────────────────────────

    async def send(
        self,
        chat_id: str,
        content: str,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        """Send a plain-text message with retry and format_message."""
        if not self._bot_client or not hasattr(self._bot_client, "api"):
            return SendResult(success=False, error="Bot not connected")

        formatted = self.format_message(content)
        chunks = self.truncate_message(formatted, MAX_MESSAGE_LENGTH)

        last_result = SendResult(success=False, error="No chunks")
        for chunk in chunks:
            last_result = await self._send_chunk(chat_id, chunk, reply_to)
            if not last_result.success:
                return last_result
        return last_result

    async def _send_chunk(
        self, chat_id: str, text: str, reply_to: Optional[str] = None,
    ) -> SendResult:
        """Send a single chunk with retry + exponential backoff."""
        last_exc: Optional[Exception] = None

        for attempt in range(_SEND_MAX_RETRIES):
            try:
                # Group / C2C: must use cached responder
                cached = self._get_cached_responder(chat_id)
                if cached:
                    scene, responder = cached
                    kwargs: Dict[str, Any] = {"content": text}
                    if scene in ("group_at", "c2c"):
                        kwargs["msg_seq"] = self._next_msg_seq()
                    await responder(**kwargs)
                    return SendResult(success=True)

                # DM vs guild channel
                if chat_id in self._dm_guild_ids:
                    result = await self._bot_client.api.post_dms(
                        guild_id=chat_id, content=text,
                        msg_id=reply_to or None,
                    )
                else:
                    result = await self._bot_client.api.post_message(
                        channel_id=chat_id, content=text,
                        msg_id=reply_to or None,
                    )
                msg_id = (result.get("id")
                          if isinstance(result, dict) else str(result))
                return SendResult(success=True, message_id=msg_id,
                                  raw_response=result)

            except Exception as exc:
                last_exc = exc
                err = str(exc).lower()
                # Permanent errors — don't retry
                if any(k in err for k in ("invalid", "forbidden", "not found",
                                           "bad request")):
                    break
                # Transient — back off and retry
                if attempt < _SEND_MAX_RETRIES - 1:
                    delay = _SEND_RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning("[%s] send retry %d/%d after %.1fs: %s",
                                   self.name, attempt + 1, _SEND_MAX_RETRIES,
                                   delay, exc)
                    await asyncio.sleep(delay)

        error_msg = str(last_exc) if last_exc else "Unknown error"
        retryable = not any(k in error_msg.lower()
                            for k in ("invalid", "forbidden", "not found"))
        return SendResult(success=False, error=error_msg, retryable=retryable)

    # ── Outbound: images ────────────────────────────────────────────────

    async def send_image(
        self,
        chat_id: str,
        image_url: str,
        caption: Optional[str] = None,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        """Send an image by URL."""
        if not self._bot_client or not hasattr(self._bot_client, "api"):
            return SendResult(success=False, error="Bot not connected")
        try:
            cached = self._get_cached_responder(chat_id)
            if cached:
                scene, responder = cached
                kwargs: Dict[str, Any] = {"image": image_url}
                if scene in ("group_at", "c2c"):
                    kwargs["msg_seq"] = self._next_msg_seq()
                await responder(**kwargs)
            elif chat_id in self._dm_guild_ids:
                await self._bot_client.api.post_dms(
                    guild_id=chat_id, image=image_url,
                    msg_id=reply_to or None,
                )
            else:
                await self._bot_client.api.post_message(
                    channel_id=chat_id, image=image_url,
                    msg_id=reply_to or None,
                )
            if caption:
                await self.send(chat_id, caption, reply_to=reply_to)
            return SendResult(success=True)
        except Exception as exc:
            logger.error("[%s] send_image failed: %s", self.name, exc)
            return SendResult(success=False, error=str(exc), retryable=True)

    async def send_image_file(
        self,
        chat_id: str,
        image_path: str,
        caption: Optional[str] = None,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        """Send a local image file. Falls back to base adapter on failure."""
        try:
            if not self._bot_client or not hasattr(self._bot_client, "api"):
                return await super().send_image_file(
                    chat_id, image_path, caption, reply_to, metadata)
            # botpy's file_image parameter accepts a local path
            if chat_id in self._dm_guild_ids:
                await self._bot_client.api.post_dms(
                    guild_id=chat_id, file_image=image_path,
                    msg_id=reply_to or None,
                )
            else:
                await self._bot_client.api.post_message(
                    channel_id=chat_id, file_image=image_path,
                    msg_id=reply_to or None,
                )
            if caption:
                await self.send(chat_id, caption, reply_to=reply_to)
            return SendResult(success=True)
        except Exception as exc:
            logger.warning("[%s] send_image_file failed, falling back: %s",
                           self.name, exc)
            return await super().send_image_file(
                chat_id, image_path, caption, reply_to, metadata)

    # ── Outbound: documents / files ─────────────────────────────────────

    async def send_document(
        self,
        chat_id: str,
        file_path: str,
        caption: Optional[str] = None,
        file_name: Optional[str] = None,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        """Send a file as a document attachment. Falls back to text link."""
        try:
            if not self._bot_client or not hasattr(self._bot_client, "api"):
                return await super().send_document(
                    chat_id, file_path, caption, file_name, reply_to, metadata)
            # Guild channels support file_image for general file uploads
            if chat_id in self._dm_guild_ids:
                await self._bot_client.api.post_dms(
                    guild_id=chat_id, file_image=file_path,
                    msg_id=reply_to or None,
                )
            else:
                await self._bot_client.api.post_message(
                    channel_id=chat_id, file_image=file_path,
                    msg_id=reply_to or None,
                )
            if caption:
                await self.send(chat_id, caption, reply_to=reply_to)
            return SendResult(success=True)
        except Exception as exc:
            logger.warning("[%s] send_document failed, falling back: %s",
                           self.name, exc)
            return await super().send_document(
                chat_id, file_path, caption, file_name, reply_to, metadata)

    async def send_voice(
        self,
        chat_id: str,
        audio_path: str,
        caption: Optional[str] = None,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        """Send an audio file. Falls back to base adapter (text) on failure."""
        try:
            if not self._bot_client or not hasattr(self._bot_client, "api"):
                return await super().send_voice(
                    chat_id, audio_path, caption, reply_to, metadata)
            if chat_id in self._dm_guild_ids:
                await self._bot_client.api.post_dms(
                    guild_id=chat_id, file_image=audio_path,
                    msg_id=reply_to or None,
                )
            else:
                await self._bot_client.api.post_message(
                    channel_id=chat_id, file_image=audio_path,
                    msg_id=reply_to or None,
                )
            if caption:
                await self.send(chat_id, caption, reply_to=reply_to)
            return SendResult(success=True)
        except Exception as exc:
            logger.warning("[%s] send_voice failed, falling back: %s",
                           self.name, exc)
            return await super().send_voice(
                chat_id, audio_path, caption, reply_to, metadata)

    async def send_video(
        self,
        chat_id: str,
        video_path: str,
        caption: Optional[str] = None,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        """Send a video file. Falls back to base adapter (text) on failure."""
        try:
            if not self._bot_client or not hasattr(self._bot_client, "api"):
                return await super().send_video(
                    chat_id, video_path, caption, reply_to, metadata)
            if chat_id in self._dm_guild_ids:
                await self._bot_client.api.post_dms(
                    guild_id=chat_id, file_image=video_path,
                    msg_id=reply_to or None,
                )
            else:
                await self._bot_client.api.post_message(
                    channel_id=chat_id, file_image=video_path,
                    msg_id=reply_to or None,
                )
            if caption:
                await self.send(chat_id, caption, reply_to=reply_to)
            return SendResult(success=True)
        except Exception as exc:
            logger.warning("[%s] send_video failed, falling back: %s",
                           self.name, exc)
            return await super().send_video(
                chat_id, video_path, caption, reply_to, metadata)

    # ── Chat info ───────────────────────────────────────────────────────

    async def get_chat_info(self, chat_id: str) -> Dict[str, Any]:
        try:
            if self._bot_client and hasattr(self._bot_client, "api"):
                info = await self._bot_client.api.get_channel(
                    channel_id=chat_id)
                if info:
                    return {
                        "name": info.get("name", chat_id),
                        "type": "group" if info.get("guild_id") else "direct",
                        "chat_id": chat_id,
                    }
        except Exception as exc:
            logger.debug("[%s] get_chat_info failed: %s", self.name, exc)
        return {"name": chat_id, "type": "unknown", "chat_id": chat_id}

    # ── Internal helpers ────────────────────────────────────────────────

    def _next_msg_seq(self) -> int:
        self._msg_seq += 1
        if self._msg_seq > _C2C_MSG_SEQ_MAX:
            self._msg_seq = 1
        return self._msg_seq

    def _is_duplicate(self, msg_id: str) -> bool:
        now = time.time()
        cutoff = now - DEDUP_WINDOW_SECONDS
        # Evict expired entries
        self._seen_messages = {
            k: v for k, v in self._seen_messages.items() if v > cutoff
        }
        if msg_id in self._seen_messages:
            return True
        self._seen_messages[msg_id] = now
        return False

    def _get_cached_responder(
        self, chat_id: str,
    ) -> Optional[Tuple[str, Responder]]:
        """Return a cached (scene, responder) if fresh, else None."""
        entry = self._responder_cache.get(chat_id)
        if not entry:
            return None
        scene, responder, ts = entry
        if time.time() - ts > _RESPONDER_CACHE_TTL:
            del self._responder_cache[chat_id]
            return None
        return (scene, responder)

    def _evict_stale_responders(self) -> None:
        now = time.time()
        stale = [k for k, (_, _, ts) in self._responder_cache.items()
                 if now - ts > _RESPONDER_CACHE_TTL]
        for k in stale:
            del self._responder_cache[k]
        # Hard cap
        if len(self._responder_cache) > _RESPONDER_CACHE_MAX:
            by_age = sorted(self._responder_cache,
                            key=lambda k: self._responder_cache[k][2])
            for k in by_age[:len(self._responder_cache) - _RESPONDER_CACHE_MAX]:
                del self._responder_cache[k]

    @staticmethod
    def _clean_text(text: str) -> str:
        """Strip @bot mention tags from message content."""
        return re.sub(r"<@!?\S+?>", "", text or "").strip()

    @staticmethod
    def _extract_attachments(message: Any) -> List[Dict]:
        raw = getattr(message, "attachments", None) or []
        return [
            {
                "content_type": getattr(a, "content_type", "") or "",
                "filename": getattr(a, "filename", "") or "",
                "url": getattr(a, "url", "") or "",
                "width": getattr(a, "width", None),
                "height": getattr(a, "height", None),
                "size": getattr(a, "size", None),
            }
            for a in raw
        ]

    def _get_sender_id(self, message: Any) -> str:
        for attr in ("author", "src_guild_id", "group_openid", "openid"):
            value = getattr(message, attr, None)
            if not value:
                continue
            for sub in ("id", "member_openid", "user_openid"):
                v = getattr(value, sub, None)
                if v:
                    return str(v)
            if isinstance(value, str):
                return value
        return "unknown"

    def _make_responder(self, message: Any, scene: str) -> Responder:
        """Build a responder that wraps botpy's reply API."""
        adapter = self

        async def _respond(**kwargs: Any) -> None:
            if scene in ("c2c", "group_at"):
                kwargs.setdefault("msg_seq", adapter._next_msg_seq())
            await message.reply(**kwargs)

        return _respond

    # ── Inbound dispatch ────────────────────────────────────────────────

    async def _handle_inbound(
        self,
        message: Any,
        scene: str,
        chat_id: str,
        chat_type: str,
        user_id: str,
        user_name: str,
    ) -> None:
        """Common inbound processing for all four scenes."""
        raw_id = getattr(message, "id", None) or str(uuid.uuid4())
        if self._is_duplicate(raw_id):
            return

        content = self._clean_text(getattr(message, "content", "") or "")
        attachments = self._extract_attachments(message)
        if not content and not attachments:
            return

        msg_type = MessageType.TEXT
        if attachments and any(
            a.get("content_type", "").startswith("image/") for a in attachments
        ):
            msg_type = MessageType.PHOTO

        source = self.build_source(
            chat_id=chat_id, chat_type=chat_type,
            user_id=user_id or None, user_name=user_name or None,
        )
        event = MessageEvent(
            text=content,
            message_type=msg_type,
            source=source,
            raw_message=message,
            message_id=raw_id,
            media_urls=[a["url"] for a in attachments if a.get("url")],
            media_types=[a["content_type"] for a in attachments
                         if a.get("url")],
            timestamp=datetime.now(tz=timezone.utc),
        )

        # Cache responder for group_at / c2c so send() can route replies
        if scene in ("group_at", "c2c"):
            self._responder_cache[chat_id] = (
                scene, self._make_responder(message, scene), time.time(),
            )
            self._evict_stale_responders()

        await self.handle_message(event)

    # ── QQ event handlers (called by _QQBotClient) ──────────────────────

    async def on_at_message_create(self, message: Any) -> None:
        """Guild channel @bot message."""
        channel_id = getattr(message, "channel_id", "") or ""
        author = getattr(message, "author", None)
        await self._handle_inbound(
            message=message, scene="guild_at", chat_id=channel_id,
            chat_type="group", user_id=self._get_sender_id(message),
            user_name=(getattr(author, "username", None)
                       or getattr(author, "name", None) or ""),
        )

    async def on_direct_message_create(self, message: Any) -> None:
        """Private DM."""
        dm_guild_id = getattr(message, "guild_id", "") or ""
        author = getattr(message, "author", None)
        if dm_guild_id:
            self._dm_guild_ids.add(dm_guild_id)
        await self._handle_inbound(
            message=message, scene="direct_message",
            chat_id=dm_guild_id or self._get_sender_id(message),
            chat_type="dm", user_id=self._get_sender_id(message),
            user_name=(getattr(author, "username", None)
                       or getattr(author, "name", None) or ""),
        )

    async def on_c2c_message_create(self, message: Any) -> None:
        """C2C (single-user app) message."""
        user_id = self._get_sender_id(message)
        await self._handle_inbound(
            message=message, scene="c2c", chat_id=user_id,
            chat_type="dm", user_id=user_id, user_name="",
        )

    async def on_group_at_message_create(self, message: Any) -> None:
        """Group @bot message."""
        group_id = (getattr(message, "group_openid", None)
                    or getattr(message, "group_id", "") or "")
        user_id = self._get_sender_id(message)
        await self._handle_inbound(
            message=message, scene="group_at",
            chat_id=group_id or user_id, chat_type="group",
            user_id=user_id, user_name="",
        )


# ---------------------------------------------------------------------------
# botpy Client subclass
# ---------------------------------------------------------------------------

class _QQBotClient(botpy.Client):
    """Thin botpy.Client subclass that forwards events to QQBotAdapter."""

    def __init__(self, intents: Any, adapter: QQBotAdapter, **kw: Any) -> None:
        self._adapter = adapter
        super().__init__(intents=intents, **kw)
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            pass

    async def on_ready(self) -> None:
        self._adapter._running = True
        self._adapter._mark_connected()
        logger.info("[QQBot] Bot ready")

    async def on_at_message_create(self, message: Message) -> None:
        await self._adapter.on_at_message_create(message)

    async def on_direct_message_create(self, message: DirectMessage) -> None:
        await self._adapter.on_direct_message_create(message)

    async def on_c2c_message_create(self, message: C2CMessage) -> None:
        await self._adapter.on_c2c_message_create(message)

    async def on_group_at_message_create(self, message: GroupMessage) -> None:
        await self._adapter.on_group_at_message_create(message)
