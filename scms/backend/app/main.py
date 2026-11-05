import os
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, inspect, select, text
from sqlalchemy.orm import Session
from .core import *
from .features import r as features_router
@asynccontextmanager
async def lifespan(_):
    Base.metadata.create_all(engine)
    if 'industry' not in {c['name'] for c in inspect(engine).get_columns('organizations')}:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE organizations ADD COLUMN industry VARCHAR(100) NOT NULL DEFAULT ''"))
    with SessionLocal() as s: seed(s)
    yield
app = FastAPI(title='SCMS API', lifespan=lifespan)
app.include_router(features_router)
cors_origins = [origin.strip().rstrip('/') for origin in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_methods=['*'], allow_headers=['*'])
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120); email: str; password: str
    role: Literal['student', 'organization']; org_name: str = ''; college: str = ''; course: str = ''
    org_website: str = Field('', max_length=255, pattern=r'^$|^https?://\S+\.\S+')
    org_industry: str = Field('', max_length=100); org_address: str = Field('', max_length=255)
    contact_phone: str = Field('', pattern=r'^$|^[+\d][\d\s-]{6,15}$')
class LoginIn(BaseModel): email: str; password: str
class RefreshIn(BaseModel): refresh_token: str
def tokens(db: Session, u: User) -> dict:
    jti = secrets.token_hex(16); u.refresh_jti = jti; db.commit()
    return {'access_token': make_token(u.id, 'access', 15), 'refresh_token': make_token(u.id, 'refresh', 60 * 24 * 7, jti), 'token_type': 'bearer'}
def me(db: Session, u: User) -> dict:
    d = {'id': u.id, 'email': u.email, 'name': u.name, 'role': role_name(db, u)}
    o = db.scalar(select(Organization).where(Organization.user_id == u.id))
    if o: d['organization'] = {'id': o.id, 'name': o.name, 'status': o.status}
    return d
@app.post('/auth/register', status_code=201)
def register(b: RegisterIn, db: Session = Depends(get_db)):
    email = b.email.strip().lower()
    if not re.fullmatch(r'\S+@\S+\.\S+', email): raise HTTPException(422, 'Enter a valid email address.')
    if len(b.password) < 8 or not re.search(r'\d', b.password) or not re.search(r'[A-Za-z]', b.password): raise HTTPException(422, 'Password must be 8+ characters with letters and numbers.')
    if b.role == 'organization' and not b.org_name.strip(): raise HTTPException(422, 'Organization name is required.')
    if db.scalar(select(User).where(User.email == email)): raise HTTPException(409, 'An account with this email already exists.')
    role = db.scalar(select(Role).where(Role.name == b.role))
    u = User(email=email, name=b.name.strip(), password_hash=hash_pw(b.password), role_id=role.id); db.add(u); db.flush()
    db.add(Profile(user_id=u.id, phone=b.contact_phone.strip() if b.role == 'organization' else ''))
    if b.role == 'student': db.add(Student(user_id=u.id, college=b.college, course=b.course))
    else:
        db.add(Organization(user_id=u.id, name=b.org_name.strip(), website=b.org_website.strip(), industry=b.org_industry.strip(), address=b.org_address.strip()))
        for a in db.scalars(select(User).join(Role, Role.id == User.role_id).where(Role.name == 'super_admin')): notify(db, a.id, f'New organization "{b.org_name}" awaiting approval.')
    log(db, u.name, 'REGISTER', f'{b.role}: {email}', u.id); db.commit()
    return {'message': 'Registered. Awaiting Super Admin approval.' if b.role == 'organization' else 'Registered successfully.'}
@app.post('/auth/login')
def login(b: LoginIn, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.email == b.email.strip().lower()))
    if not u or not check_pw(b.password, u.password_hash): raise HTTPException(401, 'Invalid email or password.')
    if not u.active: raise HTTPException(403, 'This account has been deactivated.')
    log(db, u.name, 'LOGIN', u.email, u.id); return {**tokens(db, u), 'user': me(db, u)}
@app.post('/auth/refresh')
def refresh(b: RefreshIn, db: Session = Depends(get_db)):
    d = decode(b.refresh_token, 'refresh'); u = db.get(User, d['sub'])
    if not u or not u.active or u.refresh_jti != d['jti']: raise HTTPException(401, 'Refresh token revoked')
    return tokens(db, u)
@app.post('/auth/logout')
def logout(u: User = Depends(current_user), db: Session = Depends(get_db)):
    u.refresh_jti = None; log(db, u.name, 'LOGOUT', u.email, u.id); db.commit(); return {'ok': True}
@app.get('/auth/me')
def whoami(u: User = Depends(current_user), db: Session = Depends(get_db)): return me(db, u)
# ---- Super Admin ----
@app.get('/admin/analytics')
def analytics(_: User = Depends(require('analytics.view')), db: Session = Depends(get_db)):
    c = lambda m, *w: db.scalar(select(func.count()).select_from(m).where(*w))
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=13)
    activity_rows = db.execute(
        select(func.date(ActivityLog.created_at), func.count(ActivityLog.id))
        .where(ActivityLog.created_at >= datetime.combine(start, datetime.min.time()))
        .group_by(func.date(ActivityLog.created_at))
    )
    account_rows = db.execute(
        select(func.date(User.created_at), func.count(User.id))
        .where(User.created_at >= datetime.combine(start, datetime.min.time()))
        .group_by(func.date(User.created_at))
    )
    activity_counts = {str(day): count for day, count in activity_rows}
    account_counts = {str(day): count for day, count in account_rows}
    return {'users': c(User), 'students': c(Student), 'organizations_approved': c(Organization, Organization.status == 'approved'), 'organizations_pending': c(Organization, Organization.status == 'pending'),
            'documents_issued': c(DocumentVerification), 'portfolios_published': c(Portfolio, Portfolio.published == True),
            'activity_trend': [
                {
                    'date': (start + timedelta(days=offset)).isoformat(),
                    'events': activity_counts.get((start + timedelta(days=offset)).isoformat(), 0),
                    'accounts': account_counts.get((start + timedelta(days=offset)).isoformat(), 0),
                }
                for offset in range(14)
            ]}  # noqa: E712
@app.get('/admin/organizations')
def orgs(_: User = Depends(require('org.approve')), db: Session = Depends(get_db)):
    return [{'id': o.id, 'name': o.name, 'status': o.status, 'email': u.email, 'website': o.website, 'industry': o.industry, 'address': o.address} for o, u in db.execute(select(Organization, User).join(User, User.id == Organization.user_id).order_by(Organization.created_at.desc()))]
class StatusIn(BaseModel): status: Literal['approved', 'rejected']
@app.post('/admin/organizations/{oid}/status')
def set_status(oid: str, b: StatusIn, a: User = Depends(require('org.approve')), db: Session = Depends(get_db)):
    o = db.get(Organization, oid)
    if not o: raise HTTPException(404, 'Organization not found')
    o.status = b.status; notify(db, o.user_id, f'Your organization "{o.name}" was {b.status}.'); log(db, a.name, 'ORG_' + b.status.upper(), o.name, a.id); db.commit(); return {'ok': True}
@app.get('/admin/users')
def users(_: User = Depends(require('users.manage')), db: Session = Depends(get_db)):
    return [{'id': u.id, 'name': u.name, 'email': u.email, 'role': role_name(db, u), 'active': u.active} for u in db.scalars(select(User).order_by(User.created_at))]
class UserPatch(BaseModel): active: bool | None = None; role: Literal['super_admin', 'organization', 'student'] | None = None
@app.patch('/admin/users/{uid}')
def patch_user(uid: str, b: UserPatch, a: User = Depends(require('users.manage')), db: Session = Depends(get_db)):
    u = db.get(User, uid)
    if not u: raise HTTPException(404, 'User not found')
    if u.id == a.id: raise HTTPException(400, 'You cannot change your own account here.')
    if b.active is not None: u.active = b.active; u.refresh_jti = None if not b.active else u.refresh_jti; log(db, a.name, 'USER_ACTIVATE' if b.active else 'USER_DEACTIVATE', u.email, a.id)
    if b.role: u.role_id = db.scalar(select(Role).where(Role.name == b.role)).id; log(db, a.name, 'ROLE_CHANGE', f'{u.email} -> {b.role}', a.id)
    db.commit(); return {'ok': True}
@app.get('/admin/rbac')
def rbac(_: User = Depends(require('rbac.manage')), db: Session = Depends(get_db)):
    rp = {(r.role_id, r.permission_id) for r in db.scalars(select(RolePermission))}
    return {'roles': [{'id': r.id, 'name': r.name} for r in db.scalars(select(Role))], 'permissions': [{'id': p.id, 'key': p.key, 'roles': [r.id for r in db.scalars(select(Role)) if (r.id, p.id) in rp]} for p in db.scalars(select(Permission))]}
class RbacIn(BaseModel): role_id: str; permission_id: str; granted: bool
@app.put('/admin/rbac')
def set_rbac(b: RbacIn, a: User = Depends(require('rbac.manage')), db: Session = Depends(get_db)):
    role = db.get(Role, b.role_id)
    if not role or not db.get(Permission, b.permission_id): raise HTTPException(404, 'Role or permission not found')
    if role.name == 'super_admin': raise HTTPException(400, 'Super Admin permissions are locked.')
    row = db.get(RolePermission, (b.role_id, b.permission_id))
    if b.granted and not row: db.add(RolePermission(role_id=b.role_id, permission_id=b.permission_id))
    if not b.granted and row: db.delete(row)
    log(db, a.name, 'RBAC_UPDATE', f'{role.name}:{b.permission_id}', a.id); db.commit(); return {'ok': True}
@app.get('/admin/audit')
def audit(q: str = '', limit: int = 300, _: User = Depends(require('audit.view')), db: Session = Depends(get_db)):
    st = select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(min(limit, 1000))
    if q: st = st.where(ActivityLog.action.contains(q) | ActivityLog.actor.contains(q) | ActivityLog.detail.contains(q))
    return [{'id': l.id, 'time': l.created_at, 'actor': l.actor, 'action': l.action, 'detail': l.detail} for l in db.scalars(st)]
# ---- Shared ----
@app.get('/profile')
def get_profile(u: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.scalar(select(Profile).where(Profile.user_id == u.id)); return {c.name: getattr(p, c.name) for c in Profile.__table__.columns if c.name not in ('id', 'user_id', 'created_at')}
class ProfileIn(BaseModel):
    headline: str = Field('', max_length=200); bio: str = ''; phone: str = Field('', pattern=r'^$|^[+\d][\d\s-]{6,15}$'); location: str = ''; skills: list[str] = []; links: list[dict] = []
@app.put('/profile')
def put_profile(b: ProfileIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.scalar(select(Profile).where(Profile.user_id == u.id))
    for k, v in b.model_dump().items(): setattr(p, k, v)
    log(db, u.name, 'PROFILE_UPDATE', u.email, u.id); db.commit(); return {'ok': True}
@app.get('/notifications')
def notes(u: User = Depends(current_user), db: Session = Depends(get_db)):
    return [{'id': n.id, 'message': n.message, 'read': n.read, 'time': n.created_at} for n in db.scalars(select(Notification).where(Notification.user_id == u.id).order_by(Notification.created_at.desc()))]
@app.post('/notifications/read-all')
def read_all(u: User = Depends(current_user), db: Session = Depends(get_db)):
    for n in db.scalars(select(Notification).where(Notification.user_id == u.id, Notification.read == False)): n.read = True  # noqa: E712
    db.commit(); return {'ok': True}
@app.get('/verify/{vid}')  # public, no auth
def verify(vid: str, db: Session = Depends(get_db)):
    r = db.scalar(select(DocumentVerification).where(DocumentVerification.verification_id == vid.strip().upper()))
    if not r: raise HTTPException(404, 'No document found with this ID.')
    return {'valid': not r.revoked, 'revoked': r.revoked, 'doc_type': r.doc_type, 'issued_to': r.issued_to, 'issued_by': r.issued_by, 'issued_on': r.created_at}
# ---- Org / Student details (the role-specific part of the profile) ----
@app.get('/details')
def details(u: User = Depends(current_user), db: Session = Depends(get_db)):
    o = db.scalar(select(Organization).where(Organization.user_id == u.id))
    if o: return {'name': o.name, 'website': o.website, 'industry': o.industry, 'address': o.address, 'status': o.status}
    s = db.scalar(select(Student).where(Student.user_id == u.id))
    if s: return {'college': s.college, 'course': s.course}
    raise HTTPException(404, 'No details for this role')
class OrgDetails(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    website: str = Field('', max_length=255, pattern=r'^$|^https?://\S+\.\S+')
    industry: str = Field('', max_length=100)
    address: str = Field('', max_length=255)
class StuDetails(BaseModel): college: str = Field('', max_length=160); course: str = Field('', max_length=160)
@app.put('/details')
def put_details(b: dict, u: User = Depends(current_user), db: Session = Depends(get_db)):
    from pydantic import ValidationError
    o = db.scalar(select(Organization).where(Organization.user_id == u.id))
    try:
        d = OrgDetails(**b) if o else StuDetails(**b)
    except ValidationError as e:
        raise HTTPException(422, '; '.join(x['msg'] for x in e.errors()))
    if o:
        o.name, o.website, o.industry, o.address = d.name.strip(), d.website, d.industry.strip(), d.address.strip()
    else:
        s = db.scalar(select(Student).where(Student.user_id == u.id))
        if not s: raise HTTPException(404, 'No details for this role')
        s.college, s.course = d.college, d.course
    log(db, u.name, 'DETAILS_UPDATE', u.email, u.id); db.commit(); return {'ok': True}
