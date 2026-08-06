"""Domino models — second brain via WhatsApp."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
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
    discover_opt_in = Column(Boolean, default=False, nullable=False, server_default="false")
    display_name = Column(String(32), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DominoItem(Base):
    __tablename__ = "domino_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_phone = Column(String, ForeignKey("domino_users.phone", ondelete="CASCADE"), nullable=False, index=True)
    raw_input = Column(Text, nullable=False)
    input_type = Column(String, nullable=False)  # link | pdf | image | note
    extracted_text = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    topic = Column(String, nullable=True)  # primary label (topics[0])
    topics = Column(ARRAY(String), nullable=True)  # up to 3 ranked labels, primary first
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


class DominoFriendship(Base):
    __tablename__ = "domino_friendships"
    __table_args__ = (
        UniqueConstraint("pair_key", name="uq_domino_friendships_pair"),
        Index("ix_domino_friendships_requester", "requester_phone"),
        Index("ix_domino_friendships_addressee", "addressee_phone"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_phone = Column(String, ForeignKey("domino_users.phone", ondelete="CASCADE"), nullable=False)
    addressee_phone = Column(String, ForeignKey("domino_users.phone", ondelete="CASCADE"), nullable=False)
    pair_key = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending | accepted | blocked
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)


class DominoUserTasteProfile(Base):
    __tablename__ = "domino_user_taste_profiles"

    user_phone = Column(String, ForeignKey("domino_users.phone", ondelete="CASCADE"), primary_key=True)
    topic_weights = Column(JSON, nullable=False, default=dict)
    item_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DominoSharedSave(Base):
    __tablename__ = "domino_shared_saves"
    __table_args__ = (
        UniqueConstraint("user_phone", "url_normalized", name="uq_domino_shared_saves_user_url"),
        Index("ix_domino_shared_saves_url_saved", "url_normalized", "saved_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_phone = Column(String, ForeignKey("domino_users.phone", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(UUID(as_uuid=True), ForeignKey("domino_items.id", ondelete="CASCADE"), nullable=False)
    url_normalized = Column(String, nullable=False)
    title = Column(String, nullable=False)
    topic_primary = Column(String, nullable=True)
    saved_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
