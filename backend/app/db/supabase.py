from supabase import create_client, Client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Validate configurations
if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
    logger.warning("Supabase URL or Key is missing. Database commands will fail.")
    # Provide dummy client startup for CI/tests if needed, but erroring out is better for production.

# Initialize the Supabase client
supabase_client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

def get_db() -> Client:
    """Dependency injection helper for FastAPI routes."""
    return supabase_client
