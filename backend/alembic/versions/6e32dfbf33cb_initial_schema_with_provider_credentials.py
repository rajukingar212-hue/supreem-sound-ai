"""initial_schema_with_provider_credentials

Revision ID: 6e32dfbf33cb
Revises: 
Create Date: 2026-11-09 04:32:45.870236

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.core.database import Base
import app.models  # ensure models are registered on Base

# revision identifiers, used by Alembic.
revision: str = '6e32dfbf33cb'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade schema on fresh or existing database."""
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
