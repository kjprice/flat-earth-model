"""
Simple probability that the scientists are wrong under a naive fair-coin
model — the "vice versa" scenario: NUM_BIOLOGISTS_DISAGREE heads and
NUM_BIOLOGISTS_AGREE tails.

    P = C(N, N-k) * 0.5^N

On a fair coin this equals the "correct" probability by symmetry — that is
sort of the point: coin-flip assumptions make both tails equally (im)probable
and predict nothing.
"""

from decimal import Decimal, getcontext
from math import comb

from constants import (
    NUM_BIOLOGISTS,
    NUM_BIOLOGISTS_AGREE,
    NUM_BIOLOGISTS_DISAGREE,
)
from fmt import format_prob_decimal, format_reciprocal_int


def compute() -> Decimal:
    getcontext().prec = max(50, 3 * NUM_BIOLOGISTS)
    return (
        Decimal(comb(NUM_BIOLOGISTS, NUM_BIOLOGISTS_DISAGREE))
        * Decimal("0.5") ** NUM_BIOLOGISTS
    )


def main() -> None:
    p = compute()
    print("Simple | P(scientists wrong)")
    print(f"         = {format_prob_decimal(p)}")
    print(f"         ≈ 1 in {format_reciprocal_int(p)}")
    print(
        f"         (fair coin, {NUM_BIOLOGISTS_DISAGREE:,} heads / "
        f"{NUM_BIOLOGISTS_AGREE:,} tails out of {NUM_BIOLOGISTS:,})"
    )


if __name__ == "__main__":
    main()
