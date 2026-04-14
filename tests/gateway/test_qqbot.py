"""Tests for the QQBot platform adapter."""
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from gateway.config import Platform, PlatformConfig


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_config(**overrides):
    defaults = {
        "enabled": True,
        "extra": {"appid": "test_appid"},
        "token": "test_secret",
    }
    defaults.update(overrides)
    return PlatformConfig(**defaults)


def _make_adapter(monkeypatch):
    """Create a QQBotAdapter with mocked botpy."""
    monkeypatch.setenv("QQBOT_APPID", "test_appid")
    monkeypatch.setenv("QQBOT_SECRET", "test_secret")
    mock_botpy = MagicMock()
    mock_botpy.Intents.return_value = MagicMock()
    mock_botpy.Client = MagicMock
    monkeypatch.setitem(__import__("sys").modules, "botpy", mock_botpy)
    monkeypatch.setitem(__import__("sys").modules, "botpy.message", MagicMock())

    import gateway.platforms.qqbot as qqmod
    monkeypatch.setattr(qqmod, "QQBOTPY_AVAILABLE", True)
    monkeypatch.setattr(qqmod, "botpy", mock_botpy)

    return qqmod.QQBotAdapter(_make_config())


def _make_connected_adapter(monkeypatch):
    """Adapter with a mock bot_client ready for send()."""
    adapter = _make_adapter(monkeypatch)
    mock_api = MagicMock()
    mock_api.post_message = AsyncMock(return_value={"id": "msg_1"})
    mock_api.post_dms = AsyncMock(return_value={"id": "dm_1"})
    adapter._bot_client = MagicMock()
    adapter._bot_client.api = mock_api
    return adapter, mock_api


# ---------------------------------------------------------------------------
# Platform enum & config
# ---------------------------------------------------------------------------

class TestQQBotPlatformEnum:
    def test_qqbot_enum_exists(self):
        assert Platform.QQBOT.value == "qqbot"


class TestQQBotConfigLoading:
    def test_apply_env_overrides(self, monkeypatch):
        monkeypatch.setenv("QQBOT_APPID", "12345")
        monkeypatch.setenv("QQBOT_SECRET", "my_secret")
        from gateway.config import GatewayConfig, _apply_env_overrides

        config = GatewayConfig()
        _apply_env_overrides(config)
        assert Platform.QQBOT in config.platforms
        qc = config.platforms[Platform.QQBOT]
        assert qc.enabled is True
        assert qc.extra["appid"] == "12345"
        assert qc.token == "my_secret"

    def test_env_overrides_with_legacy_token(self, monkeypatch):
        monkeypatch.setenv("QQBOT_APPID", "12345")
        monkeypatch.delenv("QQBOT_SECRET", raising=False)
        monkeypatch.setenv("QQBOT_TOKEN", "legacy_token")
        from gateway.config import GatewayConfig, _apply_env_overrides

        config = GatewayConfig()
        _apply_env_overrides(config)
        assert config.platforms[Platform.QQBOT].token == "legacy_token"

    def test_connected_platforms_includes_qqbot(self, monkeypatch):
        monkeypatch.setenv("QQBOT_APPID", "12345")
        monkeypatch.setenv("QQBOT_SECRET", "my_secret")
        from gateway.config import GatewayConfig, _apply_env_overrides

        config = GatewayConfig()
        _apply_env_overrides(config)
        assert Platform.QQBOT in config.get_connected_platforms()

    def test_not_connected_without_secret(self, monkeypatch):
        monkeypatch.setenv("QQBOT_APPID", "12345")
        monkeypatch.delenv("QQBOT_SECRET", raising=False)
        monkeypatch.delenv("QQBOT_TOKEN", raising=False)
        from gateway.config import GatewayConfig, _apply_env_overrides

        config = GatewayConfig()
        _apply_env_overrides(config)
        assert Platform.QQBOT not in config.get_connected_platforms()

    def test_not_connected_without_appid(self, monkeypatch):
        monkeypatch.delenv("QQBOT_APPID", raising=False)
        monkeypatch.setenv("QQBOT_SECRET", "my_secret")
        from gateway.config import GatewayConfig, _apply_env_overrides

        config = GatewayConfig()
        _apply_env_overrides(config)
        assert Platform.QQBOT not in config.get_connected_platforms()

    def test_home_channel_set_from_env(self, monkeypatch):
        monkeypatch.setenv("QQBOT_APPID", "12345")
        monkeypatch.setenv("QQBOT_SECRET", "my_secret")
        monkeypatch.setenv("QQBOT_HOME_CHANNEL", "chan_123")
        from gateway.config import GatewayConfig, _apply_env_overrides

        config = GatewayConfig()
        _apply_env_overrides(config)
        hc = config.platforms[Platform.QQBOT].home_channel
        assert hc is not None
        assert hc.chat_id == "chan_123"


# ---------------------------------------------------------------------------
# Adapter init & helpers
# ---------------------------------------------------------------------------

class TestQQBotAdapter:
    def test_init_from_config(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        assert adapter._appid == "test_appid"
        assert adapter._secret == "test_secret"
        assert adapter.MAX_MESSAGE_LENGTH == 2000

    def test_init_from_env_fallback(self, monkeypatch):
        monkeypatch.setenv("QQBOT_APPID", "env_appid")
        monkeypatch.setenv("QQBOT_SECRET", "env_secret")
        import gateway.platforms.qqbot as qqmod
        monkeypatch.setattr(qqmod, "QQBOTPY_AVAILABLE", True)
        monkeypatch.setattr(qqmod, "botpy", MagicMock())

        adapter = qqmod.QQBotAdapter(PlatformConfig(enabled=True, extra={}, token=""))
        assert adapter._appid == "env_appid"
        assert adapter._secret == "env_secret"

    def test_clean_text_strips_mentions(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        assert adapter._clean_text("<@!12345> hello world") == "hello world"
        assert adapter._clean_text("<@bot123> test") == "test"
        assert adapter._clean_text("no mentions") == "no mentions"
        assert adapter._clean_text("") == ""
        assert adapter._clean_text(None) == ""

    def test_dedup_rejects_repeat(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        assert adapter._is_duplicate("msg1") is False
        assert adapter._is_duplicate("msg1") is True
        assert adapter._is_duplicate("msg2") is False

    def test_msg_seq_increments(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        adapter._msg_seq = 0
        assert adapter._next_msg_seq() == 1
        assert adapter._next_msg_seq() == 2

    def test_msg_seq_wraps_at_max(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        adapter._msg_seq = 1_000_000
        assert adapter._next_msg_seq() == 1

    def test_get_sender_id_from_author(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        msg = MagicMock()
        msg.author = MagicMock()
        msg.author.id = "user_123"
        assert adapter._get_sender_id(msg) == "user_123"

    def test_get_sender_id_string_fallback(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        msg = MagicMock(spec=[])
        msg.author = None
        msg.src_guild_id = None
        msg.group_openid = "group_abc"
        msg.openid = None
        assert adapter._get_sender_id(msg) == "group_abc"

    def test_get_sender_id_unknown(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        msg = MagicMock(spec=[])
        msg.author = None
        msg.src_guild_id = None
        msg.group_openid = None
        msg.openid = None
        assert adapter._get_sender_id(msg) == "unknown"

    def test_extract_attachments(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        att = MagicMock()
        att.content_type = "image/png"
        att.filename = "photo.png"
        att.url = "https://example.com/photo.png"
        att.width, att.height, att.size = 800, 600, 12345
        msg = MagicMock()
        msg.attachments = [att]
        result = adapter._extract_attachments(msg)
        assert len(result) == 1
        assert result[0]["content_type"] == "image/png"

    def test_extract_attachments_empty(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        msg = MagicMock()
        msg.attachments = None
        assert adapter._extract_attachments(msg) == []


# ---------------------------------------------------------------------------
# Format message
# ---------------------------------------------------------------------------

class TestQQBotFormatMessage:
    def test_strips_bold(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        assert adapter.format_message("**hello**") == "hello"

    def test_strips_italic(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        assert adapter.format_message("*italic*") == "italic"

    def test_strips_headers(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        result = adapter.format_message("## Heading\ntext")
        assert "##" not in result
        assert "text" in result

    def test_strips_inline_code(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        assert adapter.format_message("`code`") == "code"

    def test_strips_links(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        assert adapter.format_message("[click](http://example.com)") == "click"

    def test_passthrough_plain_text(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        assert adapter.format_message("just plain text") == "just plain text"


# ---------------------------------------------------------------------------
# Responder cache
# ---------------------------------------------------------------------------

class TestQQBotResponderCache:
    def test_cache_and_retrieve(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        adapter._responder_cache["chat1"] = ("group_at", AsyncMock(), time.time())
        result = adapter._get_cached_responder("chat1")
        assert result is not None
        assert result[0] == "group_at"

    def test_cache_expires(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        adapter._responder_cache["chat1"] = ("c2c", AsyncMock(), time.time() - 1200)
        assert adapter._get_cached_responder("chat1") is None
        assert "chat1" not in adapter._responder_cache

    def test_cache_miss(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        assert adapter._get_cached_responder("nonexistent") is None

    def test_evict_stale(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        now = time.time()
        adapter._responder_cache["stale"] = ("c2c", AsyncMock(), now - 1200)
        adapter._responder_cache["fresh"] = ("group_at", AsyncMock(), now)
        adapter._evict_stale_responders()
        assert "stale" not in adapter._responder_cache
        assert "fresh" in adapter._responder_cache

    def test_evict_over_max(self, monkeypatch):
        import gateway.platforms.qqbot as qqmod
        adapter = _make_adapter(monkeypatch)
        now = time.time()
        for i in range(510):
            adapter._responder_cache[f"c_{i}"] = ("c2c", AsyncMock(), now - i)
        adapter._evict_stale_responders()
        assert len(adapter._responder_cache) <= qqmod._RESPONDER_CACHE_MAX


# ---------------------------------------------------------------------------
# Connection lifecycle
# ---------------------------------------------------------------------------

class TestQQBotConnect:
    @pytest.mark.asyncio
    async def test_connect_missing_sdk(self, monkeypatch):
        monkeypatch.setenv("QQBOT_APPID", "test")
        monkeypatch.setenv("QQBOT_SECRET", "test")
        import gateway.platforms.qqbot as qqmod
        monkeypatch.setattr(qqmod, "QQBOTPY_AVAILABLE", False)
        adapter = qqmod.QQBotAdapter(_make_config())
        assert await adapter.connect() is False

    @pytest.mark.asyncio
    async def test_connect_missing_credentials(self, monkeypatch):
        monkeypatch.delenv("QQBOT_APPID", raising=False)
        monkeypatch.delenv("QQBOT_SECRET", raising=False)
        import gateway.platforms.qqbot as qqmod
        monkeypatch.setattr(qqmod, "QQBOTPY_AVAILABLE", True)
        monkeypatch.setattr(qqmod, "botpy", MagicMock())
        adapter = qqmod.QQBotAdapter(PlatformConfig(enabled=True, extra={}, token=""))
        assert await adapter.connect() is False


# ---------------------------------------------------------------------------
# Send methods
# ---------------------------------------------------------------------------

class TestQQBotSend:
    @pytest.mark.asyncio
    async def test_send_not_connected(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        adapter._bot_client = None
        result = await adapter.send("chan", "hello")
        assert result.success is False
        assert "not connected" in result.error.lower()

    @pytest.mark.asyncio
    async def test_send_formats_message(self, monkeypatch):
        adapter, mock_api = _make_connected_adapter(monkeypatch)
        await adapter.send("chan", "**bold** text")
        call_args = mock_api.post_message.call_args
        # Should be stripped of markdown
        assert "**" not in call_args[1]["content"]
        assert "bold" in call_args[1]["content"]

    @pytest.mark.asyncio
    async def test_send_to_channel(self, monkeypatch):
        adapter, mock_api = _make_connected_adapter(monkeypatch)
        result = await adapter.send("chan_456", "hello")
        assert result.success is True
        mock_api.post_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_to_dm(self, monkeypatch):
        adapter, mock_api = _make_connected_adapter(monkeypatch)
        adapter._dm_guild_ids.add("dm_guild")
        result = await adapter.send("dm_guild", "hello dm")
        assert result.success is True
        mock_api.post_dms.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_via_cached_responder(self, monkeypatch):
        adapter, _ = _make_connected_adapter(monkeypatch)
        mock_responder = AsyncMock()
        adapter._responder_cache["grp"] = ("group_at", mock_responder, time.time())
        result = await adapter.send("grp", "hi group")
        assert result.success is True
        mock_responder.assert_called_once()
        assert "msg_seq" in mock_responder.call_args[1]

    @pytest.mark.asyncio
    async def test_send_truncates_long_messages(self, monkeypatch):
        adapter, mock_api = _make_connected_adapter(monkeypatch)
        result = await adapter.send("chan", "x" * 3000)
        assert result.success is True
        # Should have been split into chunks
        assert mock_api.post_message.call_count >= 1
        for call in mock_api.post_message.call_args_list:
            assert len(call[1]["content"]) <= 2000

    @pytest.mark.asyncio
    async def test_send_retries_on_transient_error(self, monkeypatch):
        adapter, mock_api = _make_connected_adapter(monkeypatch)
        import gateway.platforms.qqbot as qqmod
        monkeypatch.setattr(qqmod, "_SEND_RETRY_BASE_DELAY", 0.01)  # Fast tests
        mock_api.post_message = AsyncMock(
            side_effect=[ConnectionError("timeout"), {"id": "ok"}]
        )
        result = await adapter.send("chan", "hello")
        assert result.success is True
        assert mock_api.post_message.call_count == 2

    @pytest.mark.asyncio
    async def test_send_no_retry_on_permanent_error(self, monkeypatch):
        adapter, mock_api = _make_connected_adapter(monkeypatch)
        mock_api.post_message = AsyncMock(
            side_effect=Exception("forbidden: no permission")
        )
        result = await adapter.send("chan", "hello")
        assert result.success is False
        assert mock_api.post_message.call_count == 1  # No retry


class TestQQBotSendMedia:
    @pytest.mark.asyncio
    async def test_send_image_not_connected(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        adapter._bot_client = None
        result = await adapter.send_image("chan", "http://img.png")
        assert result.success is False

    @pytest.mark.asyncio
    async def test_send_image_to_channel(self, monkeypatch):
        adapter, mock_api = _make_connected_adapter(monkeypatch)
        result = await adapter.send_image("chan", "http://img.png", caption="pic")
        assert result.success is True
        mock_api.post_message.assert_any_call(
            channel_id="chan", image="http://img.png", msg_id=None)

    @pytest.mark.asyncio
    async def test_send_typing_is_noop(self, monkeypatch):
        adapter = _make_adapter(monkeypatch)
        # Should not raise
        await adapter.send_typing("chan")


# ---------------------------------------------------------------------------
# Integration checks
# ---------------------------------------------------------------------------

class TestQQBotIntegration:
    def test_toolset_exists(self):
        from toolsets import TOOLSETS
        assert "hermes-qqbot" in TOOLSETS

    def test_toolset_in_gateway(self):
        from toolsets import TOOLSETS
        assert "hermes-qqbot" in TOOLSETS["hermes-gateway"]["includes"]

    def test_platform_hint_exists(self):
        from agent.prompt_builder import PLATFORM_HINTS
        assert "qqbot" in PLATFORM_HINTS
        assert "QQ" in PLATFORM_HINTS["qqbot"]

    def test_cron_known_delivery_platforms(self):
        from cron.scheduler import _KNOWN_DELIVERY_PLATFORMS
        assert "qqbot" in _KNOWN_DELIVERY_PLATFORMS

    def test_platform_info_registered(self):
        from hermes_cli.platforms import PLATFORMS
        assert "qqbot" in PLATFORMS
        assert PLATFORMS["qqbot"].default_toolset == "hermes-qqbot"

    def test_status_check(self):
        import hermes_cli.status as s
        src = open(s.__file__).read()
        assert "QQBot" in src and "QQBOT_APPID" in src

    def test_dump_detection(self):
        import hermes_cli.dump as d
        src = open(d.__file__).read()
        assert '"qqbot"' in src and "QQBOT_APPID" in src

    def test_send_message_tool_has_qqbot(self):
        import tools.send_message_tool as smt
        assert hasattr(smt, "_send_qqbot")


class TestQQBotCheckRequirements:
    def test_ok(self, monkeypatch):
        monkeypatch.setenv("QQBOT_APPID", "12345")
        monkeypatch.setenv("QQBOT_SECRET", "secret")
        import gateway.platforms.qqbot as qqmod
        monkeypatch.setattr(qqmod, "QQBOTPY_AVAILABLE", True)
        assert qqmod.check_qqbot_requirements() is True

    def test_no_sdk(self, monkeypatch):
        monkeypatch.setenv("QQBOT_APPID", "12345")
        monkeypatch.setenv("QQBOT_SECRET", "secret")
        import gateway.platforms.qqbot as qqmod
        monkeypatch.setattr(qqmod, "QQBOTPY_AVAILABLE", False)
        assert qqmod.check_qqbot_requirements() is False

    def test_no_env(self, monkeypatch):
        monkeypatch.delenv("QQBOT_APPID", raising=False)
        monkeypatch.delenv("QQBOT_SECRET", raising=False)
        import gateway.platforms.qqbot as qqmod
        monkeypatch.setattr(qqmod, "QQBOTPY_AVAILABLE", True)
        assert qqmod.check_qqbot_requirements() is False
