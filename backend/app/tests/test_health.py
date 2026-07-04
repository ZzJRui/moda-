"""健康检查测试。FRD-API-001。"""


def test_health_ok(client):
    """GET /health 返回 200 + {"status": "ok"}。"""
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
