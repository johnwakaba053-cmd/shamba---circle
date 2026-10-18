// My Farm's lighter surface: the page re-points the shared shamba-bg /
// shamba-card / shamba-line tokens at a soft neutral, white and a pale
// line, scoped to its own wrapper, so every component inside it (the
// header's tabs and fade, PriceCard, the dashboard cards) picks up the
// same palette without forking any of them. Green, ochre, rust, blue and
// ink are unchanged. A full class string so Tailwind can see it.
export const MY_FARM_SURFACE =
  "[--shamba-bg:#f5f6f1] [--shamba-card:#ffffff] [--shamba-line:#e3e6da]";
