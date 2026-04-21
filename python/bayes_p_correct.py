"""
Bayesian posterior that evolution is TRUE given the biologist consensus.

Treats each of NUM_BIOLOGISTS as an independent "test" with
  P(yes | true)  = P_YES_GIVEN_TRUE
  P(yes | false) = P_YES_GIVEN_FALSE
and updates the 50/50 prior on the observed split (k agree, N-k disagree).

All arithmetic is done with Decimal at high precision so the output can be
rendered as a long decimal (0.999...995190...) without losing any of the
leading nines to float rounding.
"""

from decimal import Decimal, getcontext

from constants import (
    NUM_BIOLOGISTS,
    NUM_BIOLOGISTS_AGREE,
    NUM_BIOLOGISTS_DISAGREE,
    P_YES_GIVEN_FALSE,
    P_YES_GIVEN_TRUE,
    PRIOR_EVOLUTION_TRUE,
)
from fmt import format_prob_decimal


def posteriors() -> tuple[Decimal, Decimal]:
    """Returns (P(evolution true | data), P(evolution false | data))."""
    getcontext().prec = max(50, 3 * NUM_BIOLOGISTS)
    k = NUM_BIOLOGISTS_AGREE
    m = NUM_BIOLOGISTS_DISAGREE
    p_t = Decimal(str(P_YES_GIVEN_TRUE))
    p_f = Decimal(str(P_YES_GIVEN_FALSE))
    prior = Decimal(str(PRIOR_EVOLUTION_TRUE))

    lh_true = p_t**k * (1 - p_t) ** m
    lh_false = p_f**k * (1 - p_f) ** m

    joint_true = prior * lh_true
    joint_false = (1 - prior) * lh_false

    norm = joint_true + joint_false
    return joint_true / norm, joint_false / norm


def compute() -> Decimal:
    p_true, _ = posteriors()
    return p_true


def main() -> None:
    p_true, _ = posteriors()
    print("Bayes  | P(evolution true)")
    print(f"         = {format_prob_decimal(p_true)}")
    print(
        f"         (prior {PRIOR_EVOLUTION_TRUE:.2f}, "
        f"{NUM_BIOLOGISTS_AGREE:,}/{NUM_BIOLOGISTS:,} agree, "
        f"likelihoods {P_YES_GIVEN_TRUE}/{P_YES_GIVEN_FALSE})"
    )


if __name__ == "__main__":
    main()
