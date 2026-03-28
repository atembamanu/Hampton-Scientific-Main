from db.base import Base
from db.session import engine
from sqlalchemy import text


def init_db() -> None:
    """
    Create all SQLAlchemy tables in the configured Postgres database
    based on the models registered with Base.
    """
    Base.metadata.create_all(bind=engine)

    # Some deployments create the tables but miss new columns. Since we use
    # `create_all` (not alembic) we ensure critical columns exist.
    #
    # Postgres supports `ADD COLUMN IF NOT EXISTS`.
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 30"
            )
        )

