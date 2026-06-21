"""remove email verification columns

Revision ID: c4f8b3d2a901
Revises: 59a547ee0d05
Create Date: 2026-06-21 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c4f8b3d2a901"
down_revision = "59a547ee0d05"
branch_labels = None
depends_on = None


def _user_columns() -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns("users")}


def upgrade():
    columns = _user_columns()
    with op.batch_alter_table("users", schema=None) as batch_op:
        if "verification_token_created_at" in columns:
            batch_op.drop_column("verification_token_created_at")
        if "verification_token" in columns:
            batch_op.drop_column("verification_token")
        if "email_verified" in columns:
            batch_op.drop_column("email_verified")


def downgrade():
    columns = _user_columns()
    with op.batch_alter_table("users", schema=None) as batch_op:
        if "email_verified" not in columns:
            batch_op.add_column(sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
        if "verification_token" not in columns:
            batch_op.add_column(sa.Column("verification_token", sa.String(length=255), nullable=True))
        if "verification_token_created_at" not in columns:
            batch_op.add_column(sa.Column("verification_token_created_at", sa.DateTime(timezone=True), nullable=True))
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("email_verified", server_default=None)
