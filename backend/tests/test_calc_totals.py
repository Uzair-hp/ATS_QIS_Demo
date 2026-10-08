"""Totals maths must agree between the server and the browser print sheet.

The print sheet recomputes totals client-side (frontend/src/lib/quotation.js)
instead of trusting the API. These cases pin the server behaviour so the
frontend can be asserted against them.
"""

import pytest

from routes.quotations import _build_items, _calc_totals


@pytest.mark.parametrize('sub_total,discount_val,discount_type,gst_percent,expected', [
    # (sub_total, discount, type, gst%, (disc_amt, gst_amt, total))
    (200.0, 0.0, 'flat', 18.0, (0.0, 36.0, 236.0)),
    (200.0, 20.0, 'flat', 18.0, (20.0, 32.4, 212.4)),
    (200.0, 10.0, 'percent', 18.0, (20.0, 32.4, 212.4)),
    (1000.0, 0.0, 'flat', 0.0, (0.0, 0.0, 1000.0)),
    # Discount larger than the subtotal must clamp the net at zero, not go negative.
    (100.0, 150.0, 'flat', 18.0, (150.0, 0.0, 0.0)),
    # A 0% rate must produce no GST line at all (the `if gst_percent` guard).
    (100.0, 0.0, 'flat', 0.0, (0.0, 0.0, 100.0)),
])
def test_calc_totals(sub_total, discount_val, discount_type, gst_percent, expected):
    assert _calc_totals(sub_total, discount_val, discount_type, gst_percent) == expected


@pytest.mark.parametrize('qtys,rates,expected_total', [
    ([2.0], [100.0], 200.0),
    # Fractional rupees: the subtotal must keep its decimals. Rounding the sum
    # to whole rupees here is the bug the print sheet used to have.
    ([3.0], [33.33], 99.99),
    ([1.0, 1.0], [33.33, 33.33], 66.66),
    ([1.5], [10.005], 15.01),
    ([10.0], [0.07], 0.7),
])
def test_build_items_keeps_subtotal_precision(ctx, qtys, rates, expected_total):
    """sub_total is the sum of per-line 2dp amounts, never pre-rounded."""
    from models import Quotation, QuotationItem

    q = Quotation(quotation_number='X')
    names = [f'Item {i}' for i in range(len(qtys))]
    total = _build_items(q, names, [''] * len(qtys), qtys, rates,
                         [''] * len(qtys), QuotationItem)
    assert round(total, 2) == expected_total


def test_calc_totals_matches_stored_quotation(ctx, sample):
    """The stored record and a fresh recomputation must agree."""
    q = sample['quotation']
    disc, gst, total = _calc_totals(q.sub_total, q.discount, q.discount_type,
                                    q.gst_percent)
    assert (disc, gst, total) == (q.discount_amount, q.gst_amount, q.total_amount)
