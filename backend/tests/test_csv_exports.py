"""CSV export coverage.

The exports were built when the models had far fewer columns, so the ATS-specific
fields (subject, GST, HSN, delivery address, terms) never made it into the CSV.
These tests pin the headers we actually want to ship.
"""

import csv
import io

EXPECTED_INVOICE_COLUMNS = [
    'Invoice Number', 'Client Name', 'Client Company', 'Subject',
    'Date Created', 'Due Date', 'Voucher Number', 'Reference Quotation',
    'Sub Total', 'Discount', 'Discount Type', 'Discount Amount', 'GST %',
    'GST Amount', 'Total Amount', 'Amount Received', 'Balance Due',
    'Payment Mode', 'Payment Terms', 'Delivery Address', 'Status',
]

EXPECTED_QUOTATION_COLUMNS = [
    'Quotation Number', 'Client Name', 'Client Company', 'Subject',
    'Date Created', 'Valid Until', 'Estimated Timeline', 'Sub Total',
    'Discount', 'Discount Type', 'Discount Amount', 'GST %', 'GST Amount',
    'Total Amount', 'Payment Terms', 'Delivery Address', 'Notes', 'Status',
]

EXPECTED_CLIENT_COLUMNS = [
    'Client Name', 'Company Name', 'GST Number', 'Email', 'Phone', 'Address',
    'Total Billed', 'Outstanding',
]


def _rows(resp):
    assert resp.status_code == 200
    text = resp.get_data(as_text=True)
    return list(csv.reader(io.StringIO(text)))


def test_invoice_export_headers(login, ctx, sample):
    rows = _rows(login.get('/api/invoices/export'))
    assert rows[0] == EXPECTED_INVOICE_COLUMNS


def test_quotation_export_headers(login, ctx, sample):
    rows = _rows(login.get('/api/quotations/export'))
    assert rows[0] == EXPECTED_QUOTATION_COLUMNS


def test_client_export_headers(login, ctx, sample):
    rows = _rows(login.get('/api/clients/export'))
    assert rows[0] == EXPECTED_CLIENT_COLUMNS


def test_quotation_export_carries_values(login, ctx, sample):
    rows = _rows(login.get('/api/quotations/export'))
    assert len(rows) >= 2
    header, row = rows[0], rows[1]
    record = dict(zip(header, row))
    assert record['Quotation Number'] == 'ATS-QT-2026-001'
    assert record['Client Company'] == 'NAVAL DOCKYARD KOLABA'
    assert record['Subject'] == 'BOOM BARRIER'
    # Percentages use %g, matching the PDF templates: no trailing ".0".
    assert record['GST %'] == '18'
    assert record['GST Amount'] == '32.40'
    assert record['Total Amount'] == '212.40'
    assert record['Payment Terms'] == '50% Advance'


def test_client_export_carries_gst_number(login, ctx, sample):
    rows = _rows(login.get('/api/clients/export'))
    record = dict(zip(rows[0], rows[1]))
    assert record['GST Number'] == '27AAAAA0000A1Z5'


def test_exports_require_login(client, ctx, sample):
    for path in ('/api/invoices/export', '/api/quotations/export',
                 '/api/clients/export'):
        assert client.get(path).status_code in (302, 401, 403, 308), path
