import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path(__file__).parent / "logs"
LOG_FILE = LOG_DIR / "app.log"
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

FORMATO = "%(asctime)s %(levelname)-8s %(name)s - %(message)s"


def configurar_logging() -> None:
    """Configura logging a consola y a archivo rotativo (logs/app.log)."""
    LOG_DIR.mkdir(exist_ok=True)

    handler_archivo = RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    handler_consola = logging.StreamHandler()

    logging.basicConfig(
        level=LOG_LEVEL,
        format=FORMATO,
        handlers=[handler_consola, handler_archivo],
    )

    # uvicorn ya define sus propios loggers; los dejamos con el mismo formato/nivel.
    for nombre in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(nombre).setLevel(LOG_LEVEL)
