# Ring Toss

Land rings on the necks of the bottles on the table before you run out.

## How to play

- With a mouse, move to aim: the circle shows where the ring will land. Click to throw.
- On a touch screen, tap the spot where you want the ring to land: the tap aims and
  throws in one go.
- You have 10 rings a round.
- One ring flies at a time: clicks or taps while a ring is in the air don't throw another.
- A ring that lands on a bottle stays on its neck. A miss shows a red cross.
- The round ends when the tenth ring lands. Click or tap the final score screen to play again.

## Scoring

The bottles stand in a 3×3 grid. A ring that lands on a bottle's neck scores by row:

| Row    | Points |
| ------ | ------ |
| Back   | 30     |
| Middle | 20     |
| Front  | 10     |

A miss scores nothing, and so does a ring on a bottle that already has one: each
bottle scores at most once a round, so the best possible round is 180.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `throwRing`, `step`, `landRing`,
  `scoreForRow`) and the `ringToss` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
