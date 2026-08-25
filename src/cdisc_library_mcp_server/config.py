import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

DEFAULT_BASE_URL = "https://library.cdisc.org/api"


@dataclass(frozen=True)
class Settings:
    api_key: str
    base_url: str = DEFAULT_BASE_URL


def load_settings() -> Settings:
    api_key = os.environ.get("CDISC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "CDISC_API_KEY is not set. Obtain a key from "
            "https://library.cdisc.org and set it in the environment or a .env file."
        )
    base_url = os.environ.get("CDISC_LIBRARY_BASE_URL", DEFAULT_BASE_URL)
    return Settings(api_key=api_key, base_url=base_url)
