"""
Bayesian posterior that evolution is FALSE given the biologist consensus.

Math lives in bayes_p_correct.posteriors; this script just prints the
"false" half.
"""

from bayes_p_correct import posteriors
from constants import (
    NUM_BIOLOGISTS,
    NUM_BIOLOGISTS_AGREE,
    P_YES_GIVEN_FALSE,
    P_YES_GIVEN_TRUE,
    PRIOR_EVOLUTION_TRUE,
)
from fmt import format_prob_decimal, format_reciprocal_int


def compute():
    _, p_false = posteriors()
    return p_false


def main() -> None:
    _, p_false = posteriors()
    print("Bayes  | P(evolution false)")
    print(f"         = {format_prob_decimal(p_false)}")
    print(f"         ≈ 1 in {format_reciprocal_int(p_false)}")
    print(
        f"         (prior {1 - PRIOR_EVOLUTION_TRUE:.2f}, "
        f"{NUM_BIOLOGISTS_AGREE:,}/{NUM_BIOLOGISTS:,} agree, "
        f"likelihoods {P_YES_GIVEN_TRUE}/{P_YES_GIVEN_FALSE})"
    )


if __name__ == "__main__":
    main()
