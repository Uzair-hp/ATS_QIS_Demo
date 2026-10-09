"""Company settings: profile fields and the stamp upload."""

import base64
import io

import pytest

from routes.settings import MAX_STAMP_BYTES

# A 1x1 PNG, used to exercise MIME sniffing.
PNG_1PX = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8'
    'z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
)


def _upload(post_csrf, **fields):
    return post_csrf('/api/settings/', **fields)


def test_stamp_upload_stores_blob_and_sniffed_mime(post_csrf, ctx):
    resp = _upload(post_csrf, stamp_image=(io.BytesIO(PNG_1PX), 'stamp.png'))
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    assert body['stamp_mime'] == 'image/png'
    assert body['stamp_image']


def test_stamp_upload_sniffs_jpeg(post_csrf, ctx):
    jpeg = b'\xff\xd8\xff\xe0\x00\x10JFIF' + b'\x00' * 32
    resp = _upload(post_csrf, stamp_image=(io.BytesIO(jpeg), 'stamp.jpg'))
    assert resp.status_code == 200
    assert resp.get_json()['stamp_mime'] == 'image/jpeg'


def test_stamp_upload_sniffs_svg(post_csrf, ctx):
    svg = b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'
    resp = _upload(post_csrf, stamp_image=(io.BytesIO(svg), 's.svg'))
    assert resp.get_json()['stamp_mime'] == 'image/svg+xml'


def test_stamp_upload_sniffs_webp(post_csrf, ctx):
    webp = b'RIFF\x24\x00\x00\x00WEBPVP8 ' + b'\x00' * 16
    resp = _upload(post_csrf, stamp_image=(io.BytesIO(webp), 's.webp'))
    assert resp.get_json()['stamp_mime'] == 'image/webp'


# A file that merely claims to be an image in its filename or Content-Type must
# be refused: the bytes go straight into a data URI in the printed PDF.
def test_stamp_upload_rejects_non_image(post_csrf, ctx):
    resp = _upload(post_csrf, stamp_image=(io.BytesIO(b'<script>alert(1)</script>'), 'stamp.png'))
    assert resp.status_code == 400
    assert 'PNG' in resp.get_json()['error']


def test_stamp_upload_rejects_oversized_file(post_csrf, ctx):
    big = PNG_1PX + b'\x00' * (MAX_STAMP_BYTES + 1)
    resp = _upload(post_csrf, stamp_image=(io.BytesIO(big), 'stamp.png'))
    assert resp.status_code == 400
    assert 'too large' in resp.get_json()['error']


def test_stamp_upload_rejects_empty_file(post_csrf, ctx):
    resp = _upload(post_csrf, stamp_image=(io.BytesIO(b''), 'stamp.png'))
    assert resp.status_code == 400


def test_remove_stamp_clears_blob_and_mime(post_csrf, ctx, sample):
    assert _upload(post_csrf, stamp_image=(io.BytesIO(PNG_1PX), 's.png')
                   ).get_json()['stamp_image']

    resp = _upload(post_csrf, remove_stamp=1)
    assert resp.status_code == 200
    assert resp.get_json()['stamp_image'] is None
    assert resp.get_json()['stamp_mime'] is None


def test_settings_require_login(client, ctx, sample):
    assert client.get('/api/settings/').status_code in (302, 401, 403, 308)


def test_bank_and_gst_fields_round_trip(post_csrf, login, ctx):
    _upload(post_csrf, bank_name='HDFC Bank', bank_ifsc='HDFC0001234',
            gst_number='27BTHPT0851K1Z9', msme_number='UDYAM-MH-1')
    body = login.get('/api/settings/').get_json()
    assert body['bank_name'] == 'HDFC Bank'
    assert body['gst_number'] == '27BTHPT0851K1Z9'
    assert body['msme_number'] == 'UDYAM-MH-1'
