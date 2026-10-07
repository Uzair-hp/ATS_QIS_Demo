"""
Validation helpers for quotation/invoice payloads.
"""

import math


def is_finite_number(value):
    """Check if a value is a finite number (not NaN, not infinity)."""
    try:
        f = float(value)
        return math.isfinite(f)
    except (ValueError, TypeError):
        return False


def parse_finite_float(value, field_name, default=None):
    """
    Parse a value as float, rejecting NaN and infinity.
    Returns the parsed float or raises ValueError with descriptive message.
    """
    if value is None:
        if default is not None:
            return default
        raise ValueError(f'{field_name} is required')
    
    try:
        f = float(value)
    except (ValueError, TypeError):
        raise ValueError(f'{field_name} must be a valid number')
    
    if not math.isfinite(f):
        raise ValueError(f'{field_name} must be a finite number (not NaN or infinity)')
    
    # Reject extremely large values that could cause issues
    if abs(f) > 1e12:
        raise ValueError(f'{field_name} value is too large')
    
    return f


def parse_finite_int(value, field_name, default=None, min_val=None, max_val=None):
    """
    Parse a value as int, rejecting non-integer values.
    Returns the parsed int or raises ValueError with descriptive message.
    """
    if value is None:
        if default is not None:
            return default
        raise ValueError(f'{field_name} is required')
    
    try:
        # First check if it's a float that's not a whole number
        f = float(value)
        if not math.isfinite(f):
            raise ValueError(f'{field_name} must be a finite number')
        if f != int(f):
            raise ValueError(f'{field_name} must be an integer')
        i = int(f)
    except (ValueError, TypeError):
        raise ValueError(f'{field_name} must be a valid integer')
    
    if min_val is not None and i < min_val:
        raise ValueError(f'{field_name} must be at least {min_val}')
    if max_val is not None and i > max_val:
        raise ValueError(f'{field_name} must be at most {max_val}')
    
    return i


def parse_item_quantity(value, field_name='quantity'):
    """Parse and validate item quantity."""
    return parse_finite_float(value, field_name, default=1.0)


def parse_item_rate(value, field_name='rate'):
    """Parse and validate item rate."""
    return parse_finite_float(value, field_name, default=0.0)


def validate_client_id(client_id):
    """Validate client_id is a valid integer."""
    if client_id is None:
        raise ValueError('client_id is required')
    return parse_finite_int(client_id, 'client_id', min_val=1)


def validate_discount(discount, discount_type):
    """Validate discount value based on type."""
    val = parse_finite_float(discount, 'discount', default=0.0)
    if discount_type == 'percent' and (val < 0 or val > 100):
        raise ValueError('discount percent must be between 0 and 100')
    if discount_type == 'flat' and val < 0:
        raise ValueError('discount amount cannot be negative')
    return val


def validate_gst_percent(gst_percent):
    """Validate GST percent."""
    val = parse_finite_float(gst_percent, 'gst_percent', default=0.0)
    if val < 0 or val > 100:
        raise ValueError('gst_percent must be between 0 and 100')
    return val


def validate_valid_days(valid_days):
    """Validate valid_days."""
    return parse_finite_int(valid_days, 'valid_days', default=15, min_val=1, max_val=3650)


def validate_due_days(due_days, default=15):
    """Validate due_days."""
    return parse_finite_int(due_days, 'due_days', default=default, min_val=1, max_val=3650)


def validate_advance_amount(advance_amount):
    """Validate advance_amount."""
    return parse_finite_float(advance_amount, 'advance_amount', default=0.0)


def validate_item_name(name):
    """Validate item name is not empty after stripping."""
    if name is None:
        return ''
    name = str(name).strip()
    if not name:
        return ''
    return name


def validation_error_response(message):
    """Standard validation error response."""
    from flask import jsonify
    return jsonify({'error': message}), 400