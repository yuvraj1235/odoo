from fastapi.testclient import TestClient
from app.main import app
import sys

client = TestClient(app)
try:
    # First get token
    res = client.post("/api/v1/auth/token", data={"username": "admin@assetflow.io", "password": "admin123"})
    if res.status_code != 200:
        print("Auth failed:", res.json())
        sys.exit(1)
    token = res.json()["access_token"]
    
    # Then get assets
    res = client.get("/api/v1/assets/", headers={"Authorization": f"Bearer {token}"})
    print(res.status_code)
    print(res.text[:500])
except Exception as e:
    import traceback
    traceback.print_exc()
