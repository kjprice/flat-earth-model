"""
Simple probability that the scientists are correct under a naive fair-coin
model of scientist opinion.

Treat each biologist as an independent fair coin: P(heads/evolutionist) =
P(tails/creationist) = 0.5. What is the probability of observing exactly
this split — NUM_BIOLOGISTS_AGREE heads and NUM_BIOLOGISTS_DISAGREE tails?

    P = C(N, k) * 0.5^N
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
        Decimal(comb(NUM_BIOLOGISTS, NUM_BIOLOGISTS_AGREE))
        * Decimal("0.5") ** NUM_BIOLOGISTS
    )


def main() -> None:
    p = compute()
    print("Simple | P(scientists correct)")
    print(f"         = {format_prob_decimal(p)}")
    print(f"         ≈ 1 in {format_reciprocal_int(p)}")
    print(
        f"         (fair coin, {NUM_BIOLOGISTS_AGREE:,} heads / "
        f"{NUM_BIOLOGISTS_DISAGREE:,} tails out of {NUM_BIOLOGISTS:,})"
    )


if __name__ == "__main__":
    main()
