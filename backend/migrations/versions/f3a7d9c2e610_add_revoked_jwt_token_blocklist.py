"""add revoked jwt token blocklist

Revision ID: f3a7d9c2e610
Revises: e8f0b6c3a412
Create Date: 2026-06-22 00:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f3a7d9c2e610"
down_revision = "e8f0b6c3a412"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "revoked_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("jti", sa.String(length=36), nullable=False),
        sa.Column("token_type", sa.String(length=20), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti"),
    )
    with op.batch_alter_table("revoked_tokens", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_revoked_tokens_jti"), ["jti"], unique=True)
        batch_op.create_index(batch_op.f("ix_revoked_tokens_user_id"), ["user_id"], unique=False)


def downgrade():
    with op.batch_alter_table("revoked_tokens", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_revoked_tokens_user_id"))
        batch_op.drop_index(batch_op.f("ix_revoked_tokens_jti"))
    op.drop_table("revoked_tokens")
