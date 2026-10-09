"""Shared helpers for building PDF payloads.

The templates need the logo plus the three pre-rendered decorative PNGs (see
``tools/render_assets.py``). Assets are cached per process because they are
read from disk on every PDF request.
"""

import base64
import os

from flask import current_app

_ASSET_CACHE = {}


def get_asset_base64(filename, folder='img'):
    """Return the base64 of a file under backend/static, or '' if missing."""
    cached = _ASSET_CACHE.get(filename)
    if cached is not None:
        return cached

    static_folder = current_app.static_folder
    if not static_folder:
        return ''
    path = os.path.join(static_folder, folder, filename)
    if not os.path.exists(path):
        current_app.logger.warning('PDF asset missing: %s', path)
        _ASSET_CACHE[filename] = ''
        return ''

    with open(path, 'rb') as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    _ASSET_CACHE[filename] = encoded
    return encoded


def get_pdf_assets():
    """Every asset the PDF templates embed."""
    return {
        'logo_base64': get_asset_base64('logo.png'),
        'swoosh_base64': get_asset_base64('swoosh.png'),
        'footer_base64': get_asset_base64('footer.png'),
        'watermark_base64': get_asset_base64('watermark.png'),
    }
