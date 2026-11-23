import unittest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class PlaceRoutes(unittest.TestCase):
    @patch("main.rpc", new_callable=AsyncMock, return_value=[])
    def test_search(self, rpc):
        response = client.get("/places?q=Mall&facility=2&facility=1&facility=1")
        self.assertEqual(response.json(), [])
        rpc.assert_awaited_once_with("search_places", {"term": "Mall", "required_ids": [1, 2]})

    def test_invalid_filter(self):
        self.assertEqual(client.get("/places?facility=10").status_code, 422)

    @patch("main.rpc", new_callable=AsyncMock, return_value=None)
    def test_missing_place(self, _rpc):
        self.assertEqual(client.get("/places/99").status_code, 404)
