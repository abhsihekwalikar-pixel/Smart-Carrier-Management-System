import os, re, secrets
from datetime import datetime, timedelta, timezone
import bcrypt, jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from .models import *
DB_URL = os.getenv('DATABASE_URL', 'sqlite:///./scms.db'); SECRET = os.getenv('SECRET_KEY', 'dev-secret-change-me-dev-secret-change-me')
engine = create_engine(DB_URL, connect_args={'check_same_thread': False} if DB_URL.startswith('sqlite') else {}, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)
def get_db():
    with SessionLocal() as s: yield s
PERMS = {'super_admin': ['org.approve', 'users.manage', 'rbac.manage', 'templates.manage', 'analytics.view', 'audit.view', 'ai.configure'],
         'organization': ['org.profile', 'templates.own', 'documents.generate', 'documents.verify', 'students.view'],
         'student': ['profile.edit', 'resume.manage', 'portfolio.manage', 'documents.download']}
def hash_pw(p: str) -> str: return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def check_pw(p: str, h: str) -> bool: return bcrypt.checkpw(p.encode(), h.encode())
def make_token(uid: str, kind: str, minutes: int, jti: str | None = None) -> str:
    return jwt.encode({'sub': uid, 'typ': kind, 'jti': jti or secrets.token_hex(8), 'exp': datetime.now(timezone.utc) + timedelta(minutes=minutes)}, SECRET, 'HS256')
def decode(t: str, kind: str) -> dict:
    try: d = jwt.decode(t, SECRET, ['HS256'])
    except jwt.PyJWTError: raise HTTPException(401, 'Invalid or expired token')
    if d.get('typ') != kind: raise HTTPException(401, 'Wrong token type')
    return d
def log(db: Session, actor: str, action: str, detail: str = '', user_id: str | None = None):
    db.add(ActivityLog(actor=actor, action=action, detail=detail[:500], user_id=user_id))
def notify(db: Session, user_id: str, msg: str): db.add(Notification(user_id=user_id, message=msg))
def seed(db: Session):
    if not db.scalar(select(Role)):
        pm = {}
        for r, ps in PERMS.items():
            role = Role(name=r, description=r.replace('_', ' ')); db.add(role); db.flush()
            for p in ps:
                if p not in pm: pm[p] = Permission(key=p, description=p); db.add(pm[p]); db.flush()
                db.add(RolePermission(role_id=role.id, permission_id=pm[p].id))
        db.flush(); admin = db.scalar(select(Role).where(Role.name == 'super_admin'))
        db.add(User(email=os.getenv('ADMIN_EMAIL', 'admin@scms.com'), name='Super Admin', password_hash=hash_pw(os.getenv('ADMIN_PASSWORD', 'Admin@123')), role_id=admin.id))

    org_role = db.scalar(select(Role).where(Role.name == 'organization'))
    if not org_role:
        raise RuntimeError('Cannot seed sample organizations: the organization role is missing.')

    samples = [
        (
            'Vidyashilp',
            'demo+vidyashilp@scms.invalid',
            [
                (CertificateTemplate, 'Sample Internship Completion Certificate', 'This is to certify that {{student_name}} has successfully completed an internship with {{organization}} as part of the {{course}} program. Issued on {{date}}.'),
            ],
        ),
        (
            'Krishna Murthy Edu.Tech Pvt. Ltd.',
            'demo+krishnamurthy@scms.invalid',
            [
                (CertificateTemplate, 'Sample Learning Achievement Certificate', 'This certificate is awarded to {{student_name}} for successfully completing the learning program in {{course}}. Organization: {{organization}}. Issued on {{date}}.'),
            ],
        ),
        (
            'Margrows',
            'demo+margrows@scms.invalid',
            [
                (OfferLetterTemplate, 'Sample Graduate Trainee Offer Letter', 'Dear {{student_name}}, {{organization}} is pleased to offer you an opportunity aligned with your {{course}} studies. We look forward to welcoming you. Issued on {{date}}.'),
            ],
        ),
    ]
    for organization_name, email, templates in samples:
        if db.scalar(select(Organization).where(Organization.name == organization_name)):
            continue
        if db.scalar(select(User).where(User.email == email)):
            continue
        user = User(
            email=email,
            name=f'{organization_name} (Sample)',
            password_hash=hash_pw(secrets.token_urlsafe(32)),
            role_id=org_role.id,
            active=False,
        )
        db.add(user); db.flush()
        organization = Organization(user_id=user.id, name=organization_name, status='pending')
        db.add(organization); db.flush()
        db.add(Profile(user_id=user.id))
        for template_model, template_name, body in templates:
            db.add(template_model(org_id=organization.id, name=template_name, body=body))
    db.commit()
bearer = HTTPBearer(auto_error=False)
def current_user(c: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not c: raise HTTPException(401, 'Not authenticated')
    u = db.get(User, decode(c.credentials, 'access')['sub'])
    if not u or not u.active: raise HTTPException(401, 'Account unavailable')
    return u
def require(perm: str):
    def dep(u: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
        ok = db.scalar(select(RolePermission).join(Permission, Permission.id == RolePermission.permission_id).where(RolePermission.role_id == u.role_id, Permission.key == perm))
        if not ok: raise HTTPException(403, f'Missing permission: {perm}')
        return u
    return dep
def role_name(db: Session, u: User) -> str: return db.get(Role, u.role_id).name
