# Conversation Agent

Handles durable in-mission conversation and minimizes clarifying questions.

It checks whether the mission is missing genuinely blocking setup facts and
extracts clear labeled or route/date answers into persisted mission context.
Clear corrections rebuild affected derived output while preserving the durable
conversation. Other follow-ups become one or two focused research queries;
explicit verification/deep-research language enables bounded Tavily enrichment.

Ambiguous messages remain attached to the mission and produce only the
still-blocking questions instead of guessed setup values.
