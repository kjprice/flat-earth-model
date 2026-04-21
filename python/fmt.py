"""Shared number formatting helpers."""

from decimal import Decimal


def format_prob_decimal(d: Decimal, sig_figs: int = 10) -> str:
    """Render a Decimal probability as a long fixed-point decimal.

    Picks enough decimal places to show ``sig_figs`` significant digits past
    the leading zeros (for p << 1) or leading nines (for p ≈ 1). The whole
    point is to avoid scientific notation and let the zero/nine run speak.
    """
    if d == 0:
        return "0"
    if d == 1:
        return "1"
    if d > Decimal("0.5"):
        complement = Decimal(1) - d
        if complement == 0:
            return f"{d:.200f}"
        # adjusted() = position of the most-significant digit, e.g. -126.
        exp = complement.adjusted()
    else:
        exp = d.adjusted()
    places = max(sig_figs, -exp + sig_figs)
    return f"{d:.{places}f}"


def format_reciprocal_int(d: Decimal) -> str:
    """1/d rounded to nearest integer, comma-separated. Requires 0 < d < 1."""
    if d == 0:
        return "∞"
    recip = Decimal(1) / d
    as_int = int(recip.to_integral_value())
    return f"{as_int:,}"
