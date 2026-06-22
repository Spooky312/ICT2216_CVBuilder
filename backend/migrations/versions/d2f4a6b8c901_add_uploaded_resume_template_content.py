"""add uploaded resume template content

Revision ID: d2f4a6b8c901
Revises: b8c9d0e1f234, f3a7d9c2e610
Create Date: 2026-06-22 23:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d2f4a6b8c901"
down_revision = ("b8c9d0e1f234", "f3a7d9c2e610")
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade():
    existing = _columns("resume_templates")
    with op.batch_alter_table("resume_templates", schema=None) as batch_op:
        if "html_content" not in existing:
            batch_op.add_column(sa.Column("html_content", sa.Text(), nullable=True))
        if "original_filename" not in existing:
            batch_op.add_column(sa.Column("original_filename", sa.String(length=255), nullable=True))


def downgrade():
    existing = _columns("resume_templates")
    with op.batch_alter_table("resume_templates", schema=None) as batch_op:
        if "original_filename" in existing:
            batch_op.drop_column("original_filename")
        if "html_content" in existing:
            batch_op.drop_column("html_content")