"""add persistent resume templates

Revision ID: b8c9d0e1f234
Revises: a9b2c4d5e701
Create Date: 2026-06-22 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b8c9d0e1f234"
down_revision = "a9b2c4d5e701"
branch_labels = None
depends_on = None

resume_templates = sa.table(
    "resume_templates",
    sa.column("template_id", sa.String),
    sa.column("name", sa.String),
    sa.column("description", sa.String),
    sa.column("source_template_id", sa.String),
    sa.column("active", sa.Boolean),
    sa.column("created_at", sa.DateTime(timezone=True)),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)


def upgrade():
    op.create_table(
        "resume_templates",
        sa.Column("template_id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=250), nullable=False),
        sa.Column("source_template_id", sa.String(length=50), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("template_id"),
    )
    op.bulk_insert(resume_templates, [
        {
            "template_id": "modern",
            "name": "Modern",
            "description": "Clean two-column layout with accent colors",
            "source_template_id": "modern",
            "active": True,
        },
        {
            "template_id": "classic",
            "name": "Classic",
            "description": "Traditional single-column format",
            "source_template_id": "classic",
            "active": True,
        },
        {
            "template_id": "minimal",
            "name": "Minimal",
            "description": "Simple, whitespace-focused design",
            "source_template_id": "minimal",
            "active": True,
        },
    ])
    with op.batch_alter_table("resume_templates", schema=None) as batch_op:
        batch_op.alter_column("active", server_default=None)
        batch_op.alter_column("created_at", server_default=None)
        batch_op.alter_column("updated_at", server_default=None)


def downgrade():
    op.drop_table("resume_templates")
