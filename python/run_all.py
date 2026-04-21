"""
Run every probability script and print the results in a single pass.
"""

import bayes_p_correct
import bayes_p_wrong
import simple_p_correct
import simple_p_wrong
from constants import (
    NUM_BIOLOGISTS,
    NUM_BIOLOGISTS_AGREE,
    NUM_BIOLOGISTS_DISAGREE,
    P_YES_GIVEN_FALSE,
    P_YES_GIVEN_TRUE,
    PRIOR_EVOLUTION_TRUE,
)


def main() -> None:
    print("=== Evolution probability demos ===")
    print(
        f"  biologists polled: {NUM_BIOLOGISTS:,}  "
        f"(agree: {NUM_BIOLOGISTS_AGREE:,}, disagree: {NUM_BIOLOGISTS_DISAGREE:,})"
    )
    print(
        f"  prior P(evolution true) = {PRIOR_EVOLUTION_TRUE:.2f}, "
        f"Bayes likelihoods {P_YES_GIVEN_TRUE} / {P_YES_GIVEN_FALSE}"
    )
    print()
    simple_p_correct.main()
    simple_p_wrong.main()
    bayes_p_correct.main()
    bayes_p_wrong.main()


if __name__ == "__main__":
    main()
