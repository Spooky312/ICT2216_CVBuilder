"""add totp two factor fields

Revision ID: e8f0b6c3a412
Revises: c4f8b3d2a901
Create Date: 2026-06-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e8f0b6c3a412"
down_revision = "c4f8b3d2a901"
branch_labels = None
depends_on = None


def _user_columns() -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns("users")}


def upgrade():
    columns = _user_columns()
    with op.batch_alter_table("users", schema=None) as batch_op:
        if "totp_secret" not in columns:
            batch_op.add_column(sa.Column("totp_secret", sa.String(length=512), nullable=True))
        if "totp_enabled" not in columns:
            batch_op.add_column(sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("totp_enabled", server_default=None)


def downgrade():
    columns = _user_columns()
    with op.batch_alter_table("users", schema=None) as batch_op:
        if "totp_enabled" in columns:
            batch_op.drop_column("totp_enabled")
        if "totp_secret" in columns:
            batch_op.drop_column("totp_secret")
