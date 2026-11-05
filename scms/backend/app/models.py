import uuid
from datetime import datetime
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
class Base(DeclarativeBase): pass
def _id() -> str: return str(uuid.uuid4())
def S(n=255, **k): return mapped_column(String(n), **k)
def FK(t): return mapped_column(String(36), ForeignKey(t + '.id'), index=True)
class M:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_id)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
class Role(M, Base): __tablename__ = 'roles'; name: Mapped[str] = S(40, unique=True); description: Mapped[str] = S(255, default='')
class Permission(M, Base): __tablename__ = 'permissions'; key: Mapped[str] = S(80, unique=True); description: Mapped[str] = S(255, default='')
class RolePermission(Base):  # join table linking roles and permissions
    __tablename__ = 'role_permissions'
    role_id: Mapped[str] = mapped_column(ForeignKey('roles.id'), primary_key=True)
    permission_id: Mapped[str] = mapped_column(ForeignKey('permissions.id'), primary_key=True)
class User(M, Base):
    __tablename__ = 'users'
    email: Mapped[str] = S(255, unique=True, index=True); name: Mapped[str] = S(120); password_hash: Mapped[str] = S(255)
    role_id: Mapped[str] = FK('roles'); active: Mapped[bool] = mapped_column(Boolean, default=True)
    refresh_jti: Mapped[str | None] = S(64, nullable=True)  # rotating refresh token id
class Organization(M, Base):
    __tablename__ = 'organizations'
    user_id: Mapped[str] = FK('users'); name: Mapped[str] = S(160); website: Mapped[str] = S(255, default=''); industry: Mapped[str] = S(100, default=''); address: Mapped[str] = S(255, default='')
    logo_path: Mapped[str | None] = S(255, nullable=True); status: Mapped[str] = S(20, default='pending')
class Student(M, Base): __tablename__ = 'students'; user_id: Mapped[str] = FK('users'); college: Mapped[str] = S(160, default=''); course: Mapped[str] = S(160, default='')
class Profile(M, Base):
    __tablename__ = 'profiles'
    user_id: Mapped[str] = FK('users'); headline: Mapped[str] = S(200, default=''); bio: Mapped[str] = mapped_column(Text, default='')
    phone: Mapped[str] = S(30, default=''); location: Mapped[str] = S(120, default=''); skills: Mapped[list] = mapped_column(JSON, default=list); links: Mapped[list] = mapped_column(JSON, default=list)
class Resume(M, Base): __tablename__ = 'resumes'; user_id: Mapped[str] = FK('users'); title: Mapped[str] = S(160); source: Mapped[str] = S(20); content: Mapped[dict] = mapped_column(JSON, default=dict); file_path: Mapped[str | None] = S(255, nullable=True)
class ResumeVersion(M, Base): __tablename__ = 'resume_versions'; resume_id: Mapped[str] = FK('resumes'); version: Mapped[int] = mapped_column(Integer); content: Mapped[dict] = mapped_column(JSON, default=dict)
class Portfolio(M, Base): __tablename__ = 'portfolios'; user_id: Mapped[str] = FK('users'); slug: Mapped[str] = S(80, unique=True); title: Mapped[str] = S(160); published: Mapped[bool] = mapped_column(Boolean, default=False)
class PortfolioSection(M, Base): __tablename__ = 'portfolio_sections'; portfolio_id: Mapped[str] = FK('portfolios'); type: Mapped[str] = S(40); content: Mapped[dict] = mapped_column(JSON, default=dict); position: Mapped[int] = mapped_column(Integer, default=0)
class CertificateTemplate(M, Base): __tablename__ = 'certificate_templates'; org_id: Mapped[str] = FK('organizations'); name: Mapped[str] = S(160); body: Mapped[str] = mapped_column(Text); signature_path: Mapped[str | None] = mapped_column(Text, nullable=True)
class Certificate(M, Base): __tablename__ = 'certificates'; org_id: Mapped[str] = FK('organizations'); template_id: Mapped[str] = FK('certificate_templates'); student_id: Mapped[str] = FK('students'); verification_id: Mapped[str] = S(32, unique=True); data: Mapped[dict] = mapped_column(JSON, default=dict)
class OfferLetterTemplate(M, Base): __tablename__ = 'offer_letter_templates'; org_id: Mapped[str] = FK('organizations'); name: Mapped[str] = S(160); body: Mapped[str] = mapped_column(Text); signature_path: Mapped[str | None] = mapped_column(Text, nullable=True)
class OfferLetter(M, Base): __tablename__ = 'offer_letters'; org_id: Mapped[str] = FK('organizations'); template_id: Mapped[str] = FK('offer_letter_templates'); student_id: Mapped[str] = FK('students'); verification_id: Mapped[str] = S(32, unique=True); data: Mapped[dict] = mapped_column(JSON, default=dict)
class DocumentVerification(M, Base): __tablename__ = 'document_verification'; verification_id: Mapped[str] = S(32, unique=True, index=True); doc_type: Mapped[str] = S(20); doc_id: Mapped[str] = S(36); issued_to: Mapped[str] = S(160); issued_by: Mapped[str] = S(160); revoked: Mapped[bool] = mapped_column(Boolean, default=False)
class AiPrompt(M, Base): __tablename__ = 'ai_prompts'; user_id: Mapped[str] = FK('users'); kind: Mapped[str] = S(30); prompt: Mapped[str] = mapped_column(Text); output: Mapped[str] = mapped_column(Text, default='')
class Notification(M, Base): __tablename__ = 'notifications'; user_id: Mapped[str] = FK('users'); message: Mapped[str] = S(500); read: Mapped[bool] = mapped_column(Boolean, default=False)
class ActivityLog(M, Base): __tablename__ = 'activity_logs'; user_id: Mapped[str | None] = S(36, nullable=True, index=True); actor: Mapped[str] = S(120); action: Mapped[str] = S(60); detail: Mapped[str] = S(500, default='')
