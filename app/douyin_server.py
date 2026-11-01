"""Repair upstream's stdio entry point without modifying upstream source."""
import asyncio
import sys
from . import store

sys.path.insert(0, str(store.ROOT / 'vendor' / 'integrations' / 'douyin-mcp'))
from douyin_mcp import main as upstream
from mcp.server.stdio import stdio_server

async def serve():
    upstream.ALAPI_TOKEN = store.integration_secret('alapi')
    upstream.SILICONFLOW_API_KEY = store.integration_secret('siliconflow')
    # Network operations inherit a bounded timeout, including the upstream MCP tools.
    import requests
    original = requests.sessions.Session.request
    def bounded(self, method, url, **kwargs):
        kwargs.setdefault('timeout', 40)
        return original(self, method, url, **kwargs)
    requests.sessions.Session.request = bounded
    async with stdio_server() as (read, write):
        await upstream.server.run(read, write, upstream.server.create_initialization_options())

if __name__ == '__main__':
    asyncio.run(serve())
