"""
All tunable constants for the evolution-probability demos.

Edit these freely; every script reads from here so results update in lockstep.
"""

# --- Survey ---------------------------------------------------------------

# How many biologists were polled, and what fraction said "yes, evolution is true".
NUM_BIOLOGISTS: int = 100
PERCENT_BIOLOGISTS_AGREE: float = 0.99

# Derived headcounts.
NUM_BIOLOGISTS_AGREE: int = round(NUM_BIOLOGISTS * PERCENT_BIOLOGISTS_AGREE)
NUM_BIOLOGISTS_DISAGREE: int = NUM_BIOLOGISTS - NUM_BIOLOGISTS_AGREE


# --- Priors ---------------------------------------------------------------

# Naive prior: before seeing any data, evolution is a 50/50 coin flip.
# Used both by the simple scripts (as the output) and by Bayes (as the prior).
PRIOR_EVOLUTION_TRUE: float = 0.5


# --- Bayesian likelihoods -------------------------------------------------

# P(a single scientist says "yes" | evolution is true)
P_YES_GIVEN_TRUE: float = 0.95
# P(a single scientist says "yes" | evolution is false)
P_YES_GIVEN_FALSE: float = 0.05
