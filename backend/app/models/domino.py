"""Domino models — second brain via WhatsApp."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.sql import func

from app.db.session import Base


class DominoUser(Base):
    __tablename__ = "domino_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String, unique=True, index=True, nullable=False)
    timezone = Column(String, default="America/Los_Angeles", nullable=False)
    digest_time = Column(String, default="08:00", nullable=False)
    password_hash = Column(String, nullable=True)
    email = Column(String, nullable=True)
    email_pending = Column(Boolean, default=False, nullable=False, server_default="false")
    digest_opted_out = Column(Boolean, default=False, nullable=False, server_default="false")
    invite_code = Column(String, unique=True, index=True, nullable=True)
    referred_by = Column(String, nullable=True)  # invite_code of referring user
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DominoItem(Base):
    __tablename__ = "domino_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_phone = Column(String, ForeignKey("domino_users.phone", ondelete="CASCADE"), nullable=False, index=True)
    raw_input = Column(Text, nullable=False)
    input_type = Column(String, nullable=False)  # link | pdf | image | note
    extracted_text = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    topic = Column(String, nullable=True)
    key_ideas = Column(ARRAY(String), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    digest_sent = Column(Boolean, default=False, nullable=False, server_default="false")
    is_pinned = Column(Boolean, default=False, nullable=False, server_default="false")
    is_favorited = Column(Boolean, default=False, nullable=False, server_default="false")


class DominoOTP(Base):
    __tablename__ = "domino_otps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String, index=True, nullable=False)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DominoSession(Base):
    __tablename__ = "domino_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_phone = Column(String, ForeignKey("domino_users.phone", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)


class DominoMessage(Base):
    __tablename__ = "domino_messages"
    __table_args__ = (
        Index("idx_domino_messages_user_recent", "user_phone", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_phone = Column(String, ForeignKey("domino_users.phone", ondelete="CASCADE"), nullable=False)
    direction = Column(String, nullable=False)  # 'inbound' | 'outbound'
    body = Column(Text, nullable=False)
    intent = Column(String, nullable=True)
    related_item_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DominoReminder(Base):
    __tablename__ = "domino_reminders"
    __table_args__ = (
        Index("idx_domino_reminders_due", "next_fire_at", "is_active"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_phone = Column(String, ForeignKey("domino_users.phone", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(UUID(as_uuid=True), ForeignKey("domino_items.id", ondelete="SET NULL"), nullable=True)
    message = Column(Text, nullable=False)
    next_fire_at = Column(DateTime(timezone=True), nullable=False)
    cron_pattern = Column(String, nullable=True)
    is_recurring = Column(Boolean, default=False, nullable=False, server_default="false")
    is_active = Column(Boolean, default=True, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DominoWaitlist(Base):
    __tablename__ = "domino_waitlist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    referred_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
