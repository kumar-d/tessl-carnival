# Ring Toss

Land rings on the necks of the bottles on the table before you run out.

## How to play

- Every ring flies from the launcher in the lower-left corner. The arrow shows where it is
  aimed, and the meter beside it shows how hard it will throw. A line above the table
  sums up the controls: hold to charge, drag to aim, release to throw.
- Press and hold on the game with the mouse button or a finger to charge the throw. The
  meter fills while you hold, and stops at full strength.
- While you hold, move the mouse or drag your finger to swing the arrow. Release to throw.
- The ring flies in an arc and comes down where the angle and the strength take it: the
  steeper the arrow, the further up the table, and the more charge, the further it goes.
  Pointing at a bottle only sets the angle, so you have to judge the strength too.
- If the browser cancels your press, for example when a touch turns into a system gesture,
  no ring is thrown and none is used.
- You have 10 rings a round, and one ring flies at a time: you can't charge another until
  it lands.
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

- `game.ts`: the game logic (`createState`, `aimAt`, `startCharge`, `releaseCharge`,
  `cancelCharge`, `throwRing`, `landingPoint`, `step`, `landRing`, `scoreForRow`) and the
  `ringToss` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
