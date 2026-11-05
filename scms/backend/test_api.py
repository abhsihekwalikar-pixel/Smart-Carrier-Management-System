import os; os.environ['DATABASE_URL'] = 'sqlite:///./test.db'
from fastapi.testclient import TestClient
from app.main import app
from app.core import engine
def H(t): return {'Authorization': 'Bearer ' + t}
with TestClient(app) as c:
    assert c.post('/auth/register', json={'name': 'S', 'email': 's@x.com', 'password': 'pass1234', 'role': 'student'}).status_code == 201
    assert c.post('/auth/register', json={'name': 'S', 'email': 's@x.com', 'password': 'pass1234', 'role': 'student'}).status_code == 409
    assert c.post('/auth/register', json={'name': 'S', 'email': 'b@x.com', 'password': 'short', 'role': 'student'}).status_code == 422
    assert c.post('/auth/register', json={'name': 'O', 'email': 'o@x.com', 'password': 'pass1234', 'role': 'organization', 'org_name': 'Acme'}).status_code == 201
    assert c.post('/auth/login', json={'email': 's@x.com', 'password': 'wrong'}).status_code == 401
    st = c.post('/auth/login', json={'email': 's@x.com', 'password': 'pass1234'}).json()
    ad = c.post('/auth/login', json={'email': 'admin@scms.com', 'password': 'Admin@123'}).json()
    assert c.get('/admin/users', headers=H(st['access_token'])).status_code == 403   # RBAC blocks student
    assert c.get('/admin/users').status_code == 401
    orgs = c.get('/admin/organizations', headers=H(ad['access_token'])).json(); assert orgs[0]['status'] == 'pending'
    assert c.post(f"/admin/organizations/{orgs[0]['id']}/status", json={'status': 'approved'}, headers=H(ad['access_token'])).status_code == 200
    r = c.post('/auth/refresh', json={'refresh_token': st['refresh_token']}).json(); assert 'access_token' in r
    assert c.post('/auth/refresh', json={'refresh_token': st['refresh_token']}).status_code == 401  # rotated, old one revoked
    assert c.put('/profile', json={'headline': 'Dev', 'skills': ['py'], 'phone': 'abc'}, headers=H(r['access_token'])).status_code == 422
    assert c.put('/profile', json={'headline': 'Dev', 'skills': ['py']}, headers=H(r['access_token'])).status_code == 200
    assert c.get('/verify/NOPE').status_code == 404
    assert c.get('/admin/analytics', headers=H(ad['access_token'])).json()['organizations_approved'] == 1
    assert any(l['action'] == 'ORG_APPROVED' for l in c.get('/admin/audit', headers=H(ad['access_token'])).json())
print('ALL BACKEND TESTS PASSED')
engine.dispose()
os.remove('test.db') if os.path.exists('test.db') else None
