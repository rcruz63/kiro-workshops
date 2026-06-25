# Requirements Document

## Introduction

Flappy Kiro is a retro, browser-based endless scroller game inspired by Flappy Bird. The player guides a ghost character ("Kiro") through a continuous series of pipe obstacles. Each pipe consists of an upper segment and a lower segment separated by a vertical gap that the ghost must pass through. The ghost is affected by constant downward gravity, and the player applies upward thrust ("flaps") to keep it aloft. The game presents a sky-blue backdrop with decorative clouds, tracks the player's current score, and persists a high score across play sessions. The game ends when the ghost collides with a pipe or leaves the vertical play boundaries, after which the player can restart. Audio feedback accompanies flaps and game-over events.

## Glossary

- **Game**: The complete Flappy Kiro browser application that manages state, rendering, input, scoring, and audio.
- **Ghost**: The player-controlled character sprite (rendered from `ghosty.png`) that moves vertically in response to gravity and player flap input.
- **Flap**: A player-initiated input action that applies an instantaneous upward velocity to the Ghost.
- **Gravity**: The constant downward acceleration applied to the Ghost on every simulation update.
- **Pipe_Pair**: An obstacle composed of an upper pipe segment and a lower pipe segment separated by a vertical Gap, scrolling horizontally from the right edge toward the left edge.
- **Gap**: The vertical opening between the upper and lower segments of a Pipe_Pair through which the Ghost passes.
- **Play_Field**: The bounded rectangular region in which gameplay occurs, having a top boundary and a bottom boundary.
- **Score**: The count of Pipe_Pairs the Ghost has successfully passed during the current play session.
- **High_Score**: The greatest Score achieved across play sessions, persisted in browser local storage.
- **Game_State**: The current mode of the Game, one of: Ready, Playing, or Game_Over.
- **Flap_Sound**: The audio asset (`jump.wav`) played when a Flap occurs.
- **Game_Over_Sound**: The audio asset (`game_over.wav`) played when the Game transitions to Game_Over.
- **Local_Storage**: The browser persistence mechanism used to store the High_Score across sessions.

## Requirements

### Requirement 1: Game Initialization

**User Story:** As a player, I want the game to load in a ready state, so that I can see the play field and start playing.

#### Acceptance Criteria

1. WHEN the Game finishes loading, THE Game SHALL enter the Ready state within 3 seconds of the page load event.
2. WHILE the Game is in the Ready state, THE Game SHALL render the Ghost at a fixed horizontal position of 30% of the Play_Field width measured from the left edge, and at the vertical center (50% of the Play_Field height).
3. WHILE the Game is in the Ready state, THE Game SHALL render the sky-blue background covering 100% of the Play_Field area.
4. WHILE the Game is in the Ready state, THE Game SHALL render at least 1 cloud decoration within the Play_Field.
5. WHEN the Game enters the Ready state, THE Game SHALL set the Score to 0.
6. WHEN the Game finishes loading, THE Game SHALL load the High_Score from Local_Storage as a non-negative integer.
7. IF no High_Score value exists in Local_Storage, THEN THE Game SHALL set the High_Score to 0.
8. IF the High_Score value in Local_Storage is missing, non-numeric, negative, or otherwise not a valid non-negative integer, THEN THE Game SHALL set the High_Score to 0.

### Requirement 2: Starting Gameplay

**User Story:** As a player, I want to start the game with an input action, so that the ghost begins responding to my controls.

#### Acceptance Criteria

1. WHILE the Game is in the Ready state, WHEN the player performs a Flap input, THE Game SHALL transition to the Playing state on the next simulation update.
2. WHEN the Game transitions to the Playing state from the Ready state, THE Game SHALL set the Ghost vertical velocity to the same fixed upward value applied by a Flap input.
3. WHEN the Game transitions to the Playing state from the Ready state, THE Game SHALL play the Flap_Sound.
4. WHILE the Game is in the Ready state, IF the player performs an input that is not a Flap input, THEN THE Game SHALL remain in the Ready state.

### Requirement 3: Ghost Movement and Gravity

**User Story:** As a player, I want the ghost to fall under gravity and rise when I flap, so that I can control its vertical position.

#### Acceptance Criteria

1. WHILE the Game is in the Playing state, THE Game SHALL increase the Ghost downward vertical velocity by a constant Gravity acceleration of 1800 pixels per second squared on every simulation update.
2. WHILE the Game is in the Playing state, WHEN the player performs a Flap input, THE Game SHALL set the Ghost vertical velocity to a fixed upward velocity of 500 pixels per second directed toward the top boundary of the Play_Field.
3. WHILE the Game is in the Playing state, WHEN the player performs a Flap input, THE Game SHALL play the Flap_Sound.
4. WHILE the Game is in the Playing state, THE Game SHALL update the Ghost vertical position based on the Ghost vertical velocity on every simulation update, where each simulation update corresponds to one rendered frame at the 60 frames-per-second target.
5. WHILE the Game is in the Playing state, IF the Ghost downward vertical velocity would exceed 900 pixels per second, THEN THE Game SHALL limit the Ghost downward vertical velocity to 900 pixels per second.

### Requirement 4: Pipe Generation and Scrolling

**User Story:** As a player, I want a continuous stream of pipes to scroll toward me, so that the game provides an endless challenge.

#### Acceptance Criteria

1. WHILE the Game is in the Playing state, THE Game SHALL move each Pipe_Pair horizontally toward the left edge of the Play_Field at a fixed scroll speed such that a Pipe_Pair traverses the full Play_Field width in 4.0 seconds (±0.5 seconds).
2. WHILE the Game is in the Playing state, WHEN the most recently generated Pipe_Pair has moved 50% (±5%) of the Play_Field width from the right edge, THE Game SHALL generate a new Pipe_Pair entering from the right edge of the Play_Field.
3. WHEN the Game transitions to the Playing state from the Ready state, THE Game SHALL generate the first Pipe_Pair entering from the right edge of the Play_Field.
4. WHEN a new Pipe_Pair is generated, THE Game SHALL position its Gap at a randomly selected vertical location such that the Gap remains at least 10% of the Play_Field height away from both the top boundary and the bottom boundary.
5. WHEN a new Pipe_Pair is generated, THE Game SHALL set the vertical size of its Gap to 25% (±2%) of the Play_Field height.
6. WHEN the right-most edge of a Pipe_Pair crosses the left boundary of the Play_Field, THE Game SHALL remove that Pipe_Pair from the Game.

### Requirement 5: Scoring

**User Story:** As a player, I want to earn points for each pipe I pass, so that I can measure my progress.

#### Acceptance Criteria

1. WHILE the Game is in the Playing state, WHEN the Ghost horizontal position passes the trailing (right-most) edge of a Pipe_Pair that has not yet been marked as scored, THE Game SHALL increase the Score by 1.
2. WHILE the Game is in the Playing state, WHEN a Pipe_Pair causes the Score to increase, THE Game SHALL mark that Pipe_Pair as scored so that the same Pipe_Pair does not increase the Score more than once.
3. WHILE the Game is in the Playing state, THE Game SHALL display the current Score as a non-negative integer within the Play_Field.
4. WHILE the Game is in the Playing state, WHEN the Score increases, THE Game SHALL update the displayed Score to the new value within one simulation update.
5. WHILE the Game is in the Playing state, THE Game SHALL display the High_Score as a non-negative integer within the Play_Field.

### Requirement 6: Collision and Boundaries

**User Story:** As a player, I want the game to end when the ghost hits a pipe or leaves the play field, so that there is a fail condition.

#### Acceptance Criteria

1. WHILE the Game is in the Playing state, IF any part of the Ghost's rendered bounds intersects the rendered bounds of the upper segment or lower segment of any Pipe_Pair, THEN THE Game SHALL transition to the Game_Over state.
2. WHILE the Game is in the Playing state, IF the bottom edge of the Ghost's rendered bounds reaches or passes the bottom boundary of the Play_Field, THEN THE Game SHALL transition to the Game_Over state.
3. WHILE the Game is in the Playing state, IF the top edge of the Ghost's rendered bounds reaches or passes the top boundary of the Play_Field, THEN THE Game SHALL transition to the Game_Over state.
4. WHILE the Game is in the Playing state, WHEN the Ghost's rendered bounds pass through the Gap of a Pipe_Pair without intersecting either the upper segment or the lower segment of that Pipe_Pair, THE Game SHALL remain in the Playing state.

### Requirement 7: Game Over and High Score Persistence

**User Story:** As a player, I want my best score saved and a way to play again, so that I can try to beat my record.

#### Acceptance Criteria

1. WHEN the Game transitions to the Game_Over state, THE Game SHALL play the Game_Over_Sound exactly one time.
2. WHEN the Game transitions to the Game_Over state, THE Game SHALL stop applying Gravity to the Ghost on subsequent simulation updates.
3. WHEN the Game transitions to the Game_Over state, THE Game SHALL stop scrolling all Pipe_Pairs such that no Pipe_Pair changes horizontal position on subsequent simulation updates.
4. WHEN the Game transitions to the Game_Over state, IF the Score is strictly greater than the High_Score, THEN THE Game SHALL set the High_Score to the Score.
5. WHEN the Game sets the High_Score to the Score, THE Game SHALL store the High_Score in Local_Storage.
6. IF storing the High_Score in Local_Storage fails, THEN THE Game SHALL retain the updated High_Score for the remainder of the current session and continue to the Game_Over state without interrupting display or input handling.
7. WHILE the Game is in the Game_Over state, THE Game SHALL display the final Score and the High_Score within the Play_Field.
8. WHILE the Game is in the Game_Over state, WHEN the player performs a restart input (a keyboard key press or a pointer click within the Play_Field), THE Game SHALL set the Score to 0.
9. WHILE the Game is in the Game_Over state, WHEN the player performs a restart input, THE Game SHALL remove all Pipe_Pairs from the Game.
10. WHILE the Game is in the Game_Over state, WHEN the player performs a restart input, THE Game SHALL reposition the Ghost to the fixed horizontal position used in the Ready state and transition to the Ready state.

### Requirement 8: Rendering and Visual Presentation

**User Story:** As a player, I want a retro visual style matching the reference design, so that the game feels cohesive and recognizable.

#### Acceptance Criteria

1. WHILE the Game is in the Ready, Playing, or Game_Over state, THE Game SHALL render the Ghost using the `ghosty.png` sprite asset.
2. WHILE the Game is in the Ready, Playing, or Game_Over state, THE Game SHALL render the entire Play_Field background area in sky-blue.
3. WHILE the Game is in the Ready, Playing, or Game_Over state, THE Game SHALL render between 2 and 6 cloud decorations within the Play_Field background.
4. THE Game SHALL render each Pipe_Pair with a green upper segment and a green lower segment, each segment spanning the full horizontal width of the Pipe_Pair.
5. WHILE the Game is in the Playing state, THE Game SHALL render frame updates at a target rate of 60 frames per second and SHALL sustain a measured rate of at least 30 frames per second.
6. IF the `ghosty.png` sprite asset fails to load, THEN THE Game SHALL render the Ghost as a solid placeholder shape occupying the Ghost's bounding area and SHALL continue gameplay without interruption.
