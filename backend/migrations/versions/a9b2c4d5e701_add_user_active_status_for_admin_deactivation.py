"""add user active status for admin deactivation

Revision ID: a9b2c4d5e701
Revises: f3a7d9c2e610
Create Date: 2026-06-22 00:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a9b2c4d5e701"
down_revision = "f3a7d9c2e610"
branch_labels = None
depends_on = None


def _user_columns() -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns("users")}


def upgrade():
    columns = _user_columns()
    with op.batch_alter_table("users", schema=None) as batch_op:
        if "is_active" not in columns:
            batch_op.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    if "is_active" not in columns:
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.alter_column("is_active", server_default=None)


def downgrade():
    columns = _user_columns()
    with op.batch_alter_table("users", schema=None) as batch_op:
        if "is_active" in columns:
            batch_op.drop_column("is_active")
