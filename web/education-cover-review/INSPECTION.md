# Education guide covers — download and inspection record

Status: **originals downloaded for inspection only.** Nothing has been
cropped, optimised, uploaded or set in the database.

## Downloads (2026-10-12)

Each file page was re-checked through the Commons API immediately before
downloading: licence, SHA-1, restriction notices and deletion/copyvio tags.
All five were unchanged and carried no such tags.

| File (`originals/`) | Commons file | Bytes | Pixels | SHA-1 (Commons = download) | Embedded metadata |
|---|---|---|---|---|---|
| `1-indigenous-chicken.jpg` | Improved Kenyan Kienyeji Chickens.jpg | 2,857,590 | 1824×2395 | `e0c9fc40…6d1570` ✔ | 7 EXIF tags, **GPS location present** |
| `2-rabbits.jpg` | Breeding Rabbits at home.jpg | 1,848,937 | 5008×3336 | `2bbd3aaa…56d3a72` ✔ | 8 EXIF tags, no GPS |
| `3-beekeeping.jpg` | Beehives in Kenya.jpg | 250,561 | 1296×972 | `ad73ba4c…52d2e352` ✔ | 5 EXIF tags, no GPS |
| `4-avocado.jpg` | AVOCADO GRAFTED.jpg | 255,796 | 960×1280 | `27acf24c…9ccd152` ✔ | none |
| `5-maize.jpg` | Maize on a Mount Kenya farm.jpg | 1,138,446 | 4288×2848 | `b79fed00…2be4ee283e367a5451b272be` ✔ | 18 EXIF tags, no GPS |

`originals/SHA1SUMS` holds the full hashes; `sha1sum -c SHA1SUMS` → all OK.
The maize original first returned HTTP 429 (Wikimedia rate limit,
`Retry-After: 600`); it was retried once after 11 minutes and succeeded.

`originals/` is git-ignored (see `.gitignore`): the chicken original carries
the photographer's GPS position and must never be committed or uploaded.
Prepared copies will have all metadata stripped.

## Inspection

`contact-sheet.png`: every original with the centred 16:9 crop in red and
a proposed crop in green.

| # | Subject and quality | People | 16:9 crop |
|---|---|---|---|
| 1 Chicken | Sharp close-up: white rooster and a red-brown hen behind chicken wire, being fed fresh greens; more birds behind. Good light. | One hand holding the greens, bottom of frame — no face, not identifiable. | Portrait: keeps 43 % of the height. **Centred crop cuts through the rooster's comb and eye.** Proposed crop (near the top) keeps both birds' heads and the greens, drops the hand. |
| 2 Rabbits | Excellent: two fawn rabbits in a wire-floored hutch, sharp focus, shallow depth of field. | None. | Keeps 84 %. Proposed crop trims a sliver of ear tip and the hutch floor; nothing important lost. |
| 3 Beekeeping | Rows of green-and-yellow top-bar hives hung from a pole frame in a fenced apiary, forest behind. Older compact-camera quality (2007), slightly soft, but clear. | None. | Keeps 75 %. Either crop keeps the hives; only sky and foreground grass lost. |
| 4 Avocado | Shade-net nursery with rows of avocado seedlings in black polybags. | **One identifiable woman, posed full-length at the centre — the main subject.** | Keeps 42 %; any 16:9 crop centres on her. |
| 5 Maize | Sharp close-up of a maize tassel with leaves; blurred farmhouse and trees behind. High quality. | None. | Keeps 85 %. Tassel tip touches the top edge, so the crop must sit at the top (proposed); centred crop clips the tip. |

## Avocado: not suitable as chosen

- **Grafting is not visible.** At 960×1280 the seedlings show no graft
  unions, tape or cut stems; nothing in the photo shows grafting, and the
  file page gives no description beyond its title.
- **An identifiable person is the main subject**, with no consent or
  model release recorded. That fails the pilot's rule (no identifiable
  people without consent), and cropping her out leaves a seedling bed with
  shade net.
- It is also the lowest-resolution file (960 px wide).

Recommendation: replace it. The strongest candidate already found is
[Avocado newly grafted seedlings.jpg](https://commons.wikimedia.org/wiki/File:Avocado_newly_grafted_seedlings.jpg)
(Porto Neto, CC BY-SA 4.0, 3120×4160; Brazil nursery, so alt text must not
say Kenya).

## Avocado replacement — inspected, pending approval

Downloaded as `originals/4b-avocado-replacement.jpg` (5,717,544 bytes).
Re-checked first: CC BY-SA 4.0, own work by Porto Neto, taken 2023-05-30
at the Agroplan Mudas nursery, Pacajus, Ceará, Brazil (the file page
publishes the nursery's coordinates); no deletion, copyvio or
personality-rights tags. SHA-1 `88bc3dc7…8a21` matches Commons ✔.
Embedded: 5 EXIF tags, no GPS, orientation tag 6 (stored 4160×3120,
displays upright as 3120×4160).

- **Grafting: clearly visible.** Dozens of seedlings in black nursery bags,
  each scion wrapped in clear grafting film; the avocado seeds show at the
  base of several bags.
- **People: none.**
- **Quality:** good phone photo, sharp, even daylight.
- **16:9 crop:** keeps 42 % of the height. The proposed crop (orange on
  `contact-sheet-2.png`, 30 % down) holds the densest band of wrapped
  grafts; some wrapped tips at the very top and a few lower seedlings are
  lost, but the grafting is still obvious.
- **Caveat:** Brazil, not Kenya — alt text says so.

Approved crops for 1, 2, 3 and 5 were prepared; the avocado replacement
and its crop were then approved and prepared too (crop 0, 722, 3120, 2477
of the upright image). All five are recorded in `prepared/ATTRIBUTION.md`
and shown in `contact-sheet-final.png`.
